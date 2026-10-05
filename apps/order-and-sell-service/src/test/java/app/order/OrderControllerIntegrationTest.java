package app.order;

import app.account.Account;
import app.account.AccountRepository;
import app.holding.HoldingRepository;
import app.instrument.Instrument;
import app.instrument.InstrumentRepository;
import app.order.audit.AuditTrail;
import app.order.audit.AuditTrailRepository;
import app.order.execution.CashTransaction;
import app.order.execution.CashTransactionRepository;
import app.order.execution.Fill;
import app.order.execution.FillRepository;
import app.order.execution.HoldingMovement;
import app.order.execution.HoldingMovementRepository;
import app.user.User;
import app.support.UserAccountFixture;
import app.user.UserRepository;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.web.context.WebApplicationContext;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.webAppContextSetup;

/**
 * Submits orders through {@code POST /api/orders} and checks the response contract and the ledger
 * rows a fill leaves behind: one fill, one cash transaction, one holding movement, and the audit
 * trail of status changes. Both endpoints are scoped to the caller, so this also covers what a
 * token cannot reach: another user's account on submission (DUA-63), and another user's orders on
 * listing.
 */
@SpringBootTest
@ActiveProfiles("test")
@Tag("integration")
class OrderControllerIntegrationTest {

    @Autowired private WebApplicationContext webApplicationContext;
    @Autowired private UserRepository userRepository;
    @Autowired private AccountRepository accountRepository;
    @Autowired private InstrumentRepository instrumentRepository;
    @Autowired private OrderRepository orderRepository;
    @Autowired private HoldingRepository holdingRepository;
    @Autowired private FillRepository fillRepository;
    @Autowired private CashTransactionRepository cashTransactionRepository;
    @Autowired private HoldingMovementRepository holdingMovementRepository;
    @Autowired private AuditTrailRepository auditTrailRepository;
    @Autowired private JdbcTemplate jdbcTemplate;

    private MockMvc mockMvc;
    private User user;
    private Account account;
    private Instrument instrument;
    private UUID userId;

    @BeforeEach
    void setUp() {
        mockMvc = webAppContextSetup(webApplicationContext).apply(springSecurity()).build();
        auditTrailRepository.deleteAll();
        holdingMovementRepository.deleteAll();
        cashTransactionRepository.deleteAll();
        fillRepository.deleteAll();
        holdingRepository.deleteAll();
        orderRepository.deleteAll();
        accountRepository.deleteAll();
        instrumentRepository.deleteAll();
        userRepository.deleteAll();
        UserAccountFixture.deleteAll(jdbcTemplate);

        // The auth service creates the account before it ever issues a token, so
        // a test without one is exercising a state production cannot reach.
        userId = UUID.randomUUID();
        UserAccountFixture.createActiveAccount(jdbcTemplate, userId, "orders@example.com");

        user = new User();
        user.setUserId(userId);
        user.setFirstName("Order");
        user.setLastName("Tester");
        user.setSsn("123-45-6789");
        user.setAddress("1 Main St");
        user.setDateOfBirth(LocalDate.of(1990, 1, 1));
        user.setCreatedAt(OffsetDateTime.now());
        // Cash belongs to the user, not the account (KAN-93)
        user.setAvailableFunds(new BigDecimal("1000.00"));
        user = userRepository.save(user);

        account = new Account();
        account.setUserId(user.getUserId());
        account.setOpenedDate(LocalDate.now());
        account.setCashBalance(BigDecimal.ZERO);
        account = accountRepository.save(account);

        instrument = new Instrument();
        instrument.setTicker("ORDR");
        instrument.setName("Order Test Inc.");
        instrument.setAssetClass("EQUITY");
        instrument.setCurrency("USD");
        instrument = instrumentRepository.save(instrument);
    }

    @Test
    void rejectsAnOrderWhenCredentialsDisappearAfterItsTokenWasIssued() throws Exception {
        jdbcTemplate.update("delete from user_accounts where user_id = ?", userId);

        submit("BUY", "10", "20.00")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("REJECTED"))
                .andExpect(jsonPath("$.rejectionReason").value("Credential account does not exist"));
        assertEquals(0, fillRepository.count());
        assertEquals(0, cashTransactionRepository.count());
        assertEquals(0, holdingMovementRepository.count());
    }

    @Test
    void storesSelectedReplayTimeAndKeepsRealAuditTimesForBackdatedOrders() throws Exception {
        for (String replayTime : List.of("2026-01-06T17:00:00Z", "2026-01-05T16:00:00Z")) {
            String payload = body("BUY", "1", "20.00").trim();
            payload = payload.substring(0, payload.length() - 1) + ", \"simulatedAt\": \"" + replayTime + "\"}";
            mockMvc.perform(post("/api/orders").with(tokenFor(user.getUserId()))
                    .contentType(MediaType.APPLICATION_JSON).content(payload))
                    .andExpect(status().isCreated()).andExpect(jsonPath("$.status").value("FILLED"))
                    .andExpect(jsonPath("$.simulatedAt").value(replayTime));
        }
        for (Order order : orderRepository.findAll()) {
            assertTrue(order.getSubmittedAt().isAfter(OffsetDateTime.parse("2026-01-06T17:00:00Z")));
            assertTrue(order.getResolvedAt().isAfter(order.getSimulatedAt()));
        }
    }

    @Test
    void buyThenSellFillsAndLeavesAConsistentLedger() throws Exception {
        submit("BUY", "10", "20.00")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.orderId").value(notNullValue()))
                .andExpect(jsonPath("$.status").value("FILLED"))
                .andExpect(jsonPath("$.orderType").value("BUY"))
                .andExpect(jsonPath("$.quantity").value(10))
                .andExpect(jsonPath("$.indicativePrice").value(20.00))
                .andExpect(jsonPath("$.rejectionReason").value(nullValue()))
                .andExpect(jsonPath("$.submittedAt").value(notNullValue()))
                .andExpect(jsonPath("$.resolvedAt").value(notNullValue()));

        submit("SELL", "4", "25.00")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("FILLED"));

        assertEquals(0, new BigDecimal("900.00").compareTo(
                userRepository.findById(user.getUserId()).orElseThrow().getAvailableFunds()));
        // Execution does not move the account's own cash balance (KAN-93)
        assertEquals(0, BigDecimal.ZERO.compareTo(
                accountRepository.findById(account.getAccountId()).orElseThrow().getCashBalance()));
        assertEquals(0, new BigDecimal("6").compareTo(holdingRepository
                .findByAccountIdAndInstrumentId(account.getAccountId(), instrument.getInstrumentId())
                .orElseThrow().getQuantity()));

        List<Fill> fills = fillRepository.findAll();
        assertEquals(2, fills.size());
        assertTrue(fills.stream().allMatch(fill -> fill.getFilledAt() != null));

        List<BigDecimal> cash = cashTransactionRepository.findAll().stream()
                .sorted(Comparator.comparing(CashTransaction::getCashTransactionId))
                .map(CashTransaction::getAmount).toList();
        assertEquals(0, new BigDecimal("-200.00").compareTo(cash.get(0)));
        assertEquals(0, new BigDecimal("100.00").compareTo(cash.get(1)));

        List<BigDecimal> movements = holdingMovementRepository.findAll().stream()
                .sorted(Comparator.comparing(HoldingMovement::getHoldingMovementId))
                .map(HoldingMovement::getQuantityDelta).toList();
        assertEquals(0, new BigDecimal("10").compareTo(movements.get(0)));
        assertEquals(0, new BigDecimal("-4").compareTo(movements.get(1)));

        List<String> events = auditTrailRepository.findAll().stream()
                .sorted(Comparator.comparing(AuditTrail::getAuditId))
                .map(AuditTrail::getEventType).toList();
        assertEquals(List.of("PENDING", "FILLED", "PENDING", "FILLED"), events);
    }

    @Test
    void sellingTheRemainingPositionClosesItWithoutLosingLedgerHistory() throws Exception {
        submit("BUY", "10", "20.00").andExpect(jsonPath("$.status").value("FILLED"));
        submit("SELL", "4", "25.00").andExpect(jsonPath("$.status").value("FILLED"));
        submit("SELL", "6", "30.00").andExpect(jsonPath("$.status").value("FILLED"));
        assertEquals(0, new BigDecimal("1080.00").compareTo(
                userRepository.findById(userId).orElseThrow().getAvailableFunds()));
        assertEquals(0, BigDecimal.ZERO.compareTo(holdingRepository
                .findByAccountIdAndInstrumentId(account.getAccountId(), instrument.getInstrumentId())
                .orElseThrow().getQuantity()));
        assertEquals(3, fillRepository.count());
        assertEquals(3, cashTransactionRepository.count());
        assertEquals(3, holdingMovementRepository.count());
        assertEquals(6, auditTrailRepository.count());
    }

    @Test
    void insufficientFundsAndHoldingsDoNotWriteExecutionRows() throws Exception {
        submit("BUY", "100", "20.00").andExpect(jsonPath("$.status").value("REJECTED"));
        submit("SELL", "1", "20.00").andExpect(jsonPath("$.status").value("REJECTED"));
        assertEquals(0, fillRepository.count());
        assertEquals(0, cashTransactionRepository.count());
        assertEquals(0, holdingMovementRepository.count());
        assertEquals(0, holdingRepository.count());
        assertEquals(0, new BigDecimal("1000.00").compareTo(
                userRepository.findById(userId).orElseThrow().getAvailableFunds()));
    }

    @Test
    void persistenceFailureRollsBackTheWholeOrderAndItsLedger() throws Exception {
        // Fail after fill and cash writes, exercising the real transaction boundary.
        jdbcTemplate.execute("ALTER TABLE holding_movements ADD CONSTRAINT test_reject_movement CHECK (quantity_delta = 0)");
        try {
            submit("BUY", "1", "20.00").andExpect(status().isConflict());
        } finally {
            jdbcTemplate.execute("ALTER TABLE holding_movements DROP CONSTRAINT test_reject_movement");
        }
        assertEquals(0, orderRepository.count());
        assertEquals(0, fillRepository.count());
        assertEquals(0, cashTransactionRepository.count());
        assertEquals(0, holdingMovementRepository.count());
        assertEquals(0, auditTrailRepository.count());
        assertEquals(0, holdingRepository.count());
        assertEquals(0, new BigDecimal("1000.00").compareTo(
                userRepository.findById(userId).orElseThrow().getAvailableFunds()));
    }

    @Test
    void aTradingRuleRejectionIsASuccessfulResponseDescribingTheFailedTrade() throws Exception {
        submit("SELL", "1", "20.00")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("REJECTED"))
                .andExpect(jsonPath("$.rejectionReason").value(notNullValue()));

        assertTrue(fillRepository.findAll().isEmpty());
    }

    @Test
    void malformedOrdersAreRejectedBeforeReachingTheService() throws Exception {
        mockMvc.perform(post("/api/orders")
                        .with(tokenFor(user.getUserId()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("HOLD", "-1", "20.00")))
                .andExpect(status().isBadRequest());

        assertTrue(orderRepository.findAll().isEmpty());
    }

    @Test
    void submittingAnOrderRequiresAnAccessToken() throws Exception {
        mockMvc.perform(post("/api/orders")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("BUY", "1", "20.00")))
                .andExpect(status().isUnauthorized());

        assertTrue(orderRepository.findAll().isEmpty());
    }

    @Test
    void listingOrdersReturnsTheCallersOwnOrdersNewestFirst() throws Exception {
        submit("BUY", "10", "20.00").andExpect(status().isCreated());
        submit("BUY", "5", "10.00").andExpect(status().isCreated());

        mockMvc.perform(get("/api/orders").with(tokenFor(user.getUserId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].quantity").value(5))
                .andExpect(jsonPath("$[0].status").value("FILLED"))
                .andExpect(jsonPath("$[1].quantity").value(10));
    }

    @Test
    void listingOrdersNeverReturnsAnotherUsersOrders() throws Exception {
        submit("BUY", "10", "20.00").andExpect(status().isCreated());
        UUID strangerId = givenAnOrderBelongingToAnotherUser();

        mockMvc.perform(get("/api/orders").with(tokenFor(user.getUserId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].quantity").value(10));

        mockMvc.perform(get("/api/orders").with(tokenFor(strangerId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].quantity").value(7));
    }

    @Test
    void listingOrdersIsEmptyForACallerWhoHasNotTraded() throws Exception {
        mockMvc.perform(get("/api/orders").with(tokenFor(UUID.randomUUID())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void listingOrdersRequiresAnAccessToken() throws Exception {
        mockMvc.perform(get("/api/orders"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void submittingAnOrderOnSomeoneElsesAccountIsRefused() throws Exception {
        UUID strangerId = givenAnOrderBelongingToAnotherUser();

        // A perfectly valid token, and an accountId that simply isn't theirs.
        submitAs(strangerId, "BUY", "1", "20.00")
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("You do not have access to this account"));

        // Nothing was written: the caller's own orders are unchanged, and so are the owner's.
        assertEquals(1, orderRepository.findAll().size());
        assertEquals(0, new BigDecimal("1000.00").compareTo(
                userRepository.findById(user.getUserId()).orElseThrow().getAvailableFunds()));
    }

    @Test
    void submittingAnOrderOnAnAccountThatDoesNotExistIsNotFound() throws Exception {
        mockMvc.perform(post("/api/orders")
                        .with(tokenFor(user.getUserId()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(bodyFor(account.getAccountId() + 9999,
                                instrument.getInstrumentId(), "BUY", "1", "20.00")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value(notNullValue()));

        assertTrue(orderRepository.findAll().isEmpty());
    }

    @Test
    void submittingAnOrderForAnInstrumentThatDoesNotExistIsABadRequest() throws Exception {
        // Distinct from a non-tradable instrument, which exists and comes back
        // as a 201 carrying a REJECTED order.
        mockMvc.perform(post("/api/orders")
                        .with(tokenFor(user.getUserId()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(bodyFor(account.getAccountId(),
                                instrument.getInstrumentId() + 9999, "BUY", "1", "20.00")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value(notNullValue()));

        assertTrue(orderRepository.findAll().isEmpty());
    }

    @Test
    void resubmittingTheSameClientReferenceExecutesOnce() throws Exception {
        UUID clientReference = UUID.randomUUID();
        String payload = """
                {"accountId": %d, "instrumentId": %d, "orderType": "BUY", "quantity": 10,
                 "indicativePrice": 20.00, "clientReference": "%s"}
                """.formatted(account.getAccountId(), instrument.getInstrumentId(), clientReference);

        String orderId = mockMvc.perform(post("/api/orders")
                        .with(tokenFor(user.getUserId()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("FILLED"))
                .andReturn().getResponse().getContentAsString();

        // The retry answers with the same order, not a second one. Its timestamps
        // are read back from the database and so come back at the column's
        // precision, which is why this compares the order rather than the body.
        mockMvc.perform(post("/api/orders")
                        .with(tokenFor(user.getUserId()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.orderId").value(
                        JsonPath.parse(orderId).read("$.orderId", Integer.class)))
                .andExpect(jsonPath("$.status").value("FILLED"))
                .andExpect(jsonPath("$.quantity").value(10))
                .andExpect(jsonPath("$.rejectionReason").value(nullValue()));

        // The retry returned the first outcome rather than buying twice.
        assertEquals(1, orderRepository.findAll().size());
        assertEquals(1, fillRepository.findAll().size());
        assertEquals(0, new BigDecimal("800.00").compareTo(
                userRepository.findById(user.getUserId()).orElseThrow().getAvailableFunds()));
    }

    /**
     * Saves an order on an account owned by a different user, so a listing can be
     * checked for leakage between owners.
     *
     * @return the other user's id
     */
    private UUID givenAnOrderBelongingToAnotherUser() {
        UUID strangerId = UUID.randomUUID();
        // The profile row no longer carries an email; the account behind it does.
        UserAccountFixture.createActiveAccount(jdbcTemplate, strangerId, "stranger@example.com");

        User stranger = new User();
        stranger.setUserId(strangerId);
        stranger.setFirstName("Someone");
        stranger.setLastName("Else");
        stranger.setSsn("987-65-4321");
        stranger.setAddress("2 Other St");
        stranger.setDateOfBirth(LocalDate.of(1991, 2, 2));
        stranger.setCreatedAt(OffsetDateTime.now());
        stranger = userRepository.save(stranger);

        Account strangerAccount = new Account();
        strangerAccount.setUserId(stranger.getUserId());
        strangerAccount.setOpenedDate(LocalDate.now());
        strangerAccount.setCashBalance(BigDecimal.ZERO);
        strangerAccount = accountRepository.save(strangerAccount);

        Order strangerOrder = new Order();
        strangerOrder.setAccountId(strangerAccount.getAccountId());
        strangerOrder.setInstrumentId(instrument.getInstrumentId());
        strangerOrder.setClientReference(UUID.randomUUID());
        strangerOrder.setOrderType(Order.TYPE_BUY);
        strangerOrder.setStatus(Order.STATUS_PENDING);
        strangerOrder.setQuantity(new BigDecimal("7"));
        strangerOrder.setIndicativePrice(new BigDecimal("20.00"));
        strangerOrder.setSubmittedAt(OffsetDateTime.now());
        orderRepository.save(strangerOrder);

        return stranger.getUserId();
    }

    private static RequestPostProcessor tokenFor(UUID userId) {
        return jwt().jwt(token -> token.subject(userId.toString()));
    }

    private ResultActions submit(String type, String quantity, String price) throws Exception {
        return submitAs(user.getUserId(), type, quantity, price);
    }

    private ResultActions submitAs(UUID callerId, String type, String quantity, String price)
            throws Exception {
        return mockMvc.perform(post("/api/orders")
                .with(tokenFor(callerId))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body(type, quantity, price)));
    }

    private String body(String type, String quantity, String price) {
        return bodyFor(account.getAccountId(), instrument.getInstrumentId(), type, quantity, price);
    }

    private static String bodyFor(Integer accountId, Integer instrumentId, String type,
                                  String quantity, String price) {
        return """
                {"accountId": %d, "instrumentId": %d, "orderType": "%s", "quantity": %s,
                 "indicativePrice": %s, "clientReference": "%s"}
                """.formatted(accountId, instrumentId, type, quantity, price, UUID.randomUUID());
    }
}
