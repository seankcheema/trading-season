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
import app.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.web.context.WebApplicationContext;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.webAppContextSetup;

/**
 * Submits orders through {@code POST /api/orders} and checks the response contract and the ledger
 * rows a fill leaves behind: one fill, one cash transaction, one holding movement, and the audit
 * trail of status changes.
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

    private MockMvc mockMvc;
    private Account account;
    private Instrument instrument;

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

        User user = new User();
        user.setUserId(UUID.randomUUID());
        user.setFirstName("Order");
        user.setLastName("Tester");
        user.setEmail("orders@example.com");
        user.setSsn("123-45-6789");
        user.setAddress("1 Main St");
        user.setDateOfBirth(LocalDate.of(1990, 1, 1));
        user.setCreatedAt(OffsetDateTime.now());
        user = userRepository.save(user);

        account = new Account();
        account.setUserId(user.getUserId());
        account.setOpenedDate(LocalDate.now());
        account.setCashBalance(new BigDecimal("1000.00"));
        account = accountRepository.save(account);

        instrument = new Instrument();
        instrument.setTicker("ORDR");
        instrument.setName("Order Test Inc.");
        instrument.setAssetClass("EQUITY");
        instrument.setCurrency("USD");
        instrument = instrumentRepository.save(instrument);
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
        assertEquals(List.of("SUBMITTED", "ACCEPTED", "FILLED", "SUBMITTED", "ACCEPTED", "FILLED"), events);
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
                        .with(jwt())
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

    private ResultActions submit(String type, String quantity, String price) throws Exception {
        return mockMvc.perform(post("/api/orders")
                .with(jwt())
                .contentType(MediaType.APPLICATION_JSON)
                .content(body(type, quantity, price)));
    }

    private String body(String type, String quantity, String price) {
        return """
                {"accountId": %d, "instrumentId": %d, "orderType": "%s", "quantity": %s,
                 "indicativePrice": %s, "clientReference": "%s"}
                """.formatted(account.getAccountId(), instrument.getInstrumentId(), type, quantity, price,
                UUID.randomUUID());
    }
}
