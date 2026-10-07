package app.cash;

import app.account.Account;
import app.account.AccountRepository;
import app.support.UserAccountFixture;
import app.user.User;
import app.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.web.context.WebApplicationContext;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.webAppContextSetup;

/**
 * End-to-end checks for the cash endpoints, with the emphasis on one user never
 * reaching another user's money or funding history.
 */
@SpringBootTest
@ActiveProfiles("test")
@Tag("integration")
class CashTransactionControllerIntegrationTest {

    private static final String ALICE_EMAIL = "alice@example.com";
    private static final String BOB_EMAIL = "bob@example.com";

    private MockMvc mockMvc;

    @Autowired
    private WebApplicationContext webApplicationContext;

    @Autowired
    private CashTransactionRepository cashTransactionRepository;

    @Autowired
    private AccountRepository accountRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JdbcTemplate jdbc;

    private UUID aliceId;
    private UUID bobId;
    private Integer aliceAccountId;
    private Integer bobAccountId;

    @BeforeEach
    public void setUp() {
        mockMvc = webAppContextSetup(webApplicationContext).apply(springSecurity()).build();
        cashTransactionRepository.deleteAll();
        accountRepository.deleteAll();
        userRepository.deleteAll();
        UserAccountFixture.deleteAll(jdbc);

        aliceId = UUID.randomUUID();
        bobId = UUID.randomUUID();
        UserAccountFixture.createActiveAccount(jdbc, aliceId, ALICE_EMAIL);
        UserAccountFixture.createActiveAccount(jdbc, bobId, BOB_EMAIL);
        registerUser(aliceId, "Ada", "Lovelace", new BigDecimal("1000.00"));
        registerUser(bobId, "Grace", "Hopper", new BigDecimal("500.00"));
        aliceAccountId = openAccount(aliceId, "Main Account", LocalDate.of(2026, 1, 1));
        bobAccountId = openAccount(bobId, "Main Account", LocalDate.of(2026, 1, 1));
    }

    private static RequestPostProcessor tokenFor(UUID userId, String email) {
        return jwt().jwt(token -> token
                .subject(userId.toString())
                .claim("email", email)
                .claim("roles", List.of("TRADER")));
    }

    @Test
    void depositCreditsTheCallerAndReportsThePositiveAmount() throws Exception {
        mockMvc.perform(post("/api/me/cash-transactions")
                        .with(tokenFor(aliceId, ALICE_EMAIL))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"amount\":250.50,\"reason\":\"DEPOSIT\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.cashTransactionId").isNumber())
                .andExpect(jsonPath("$.amount").value(250.50))
                .andExpect(jsonPath("$.reason").value("DEPOSIT"))
                .andExpect(jsonPath("$.createdAt").isNotEmpty());

        assertEquals(new BigDecimal("1250.50"), fundsOf(aliceId));
    }

    @Test
    void withdrawalDebitsTheCallerAndStillReportsAPositiveAmount() throws Exception {
        mockMvc.perform(post("/api/me/cash-transactions")
                        .with(tokenFor(aliceId, ALICE_EMAIL))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"amount\":100.00,\"reason\":\"WITHDRAWAL\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.amount").value(100.00))
                .andExpect(jsonPath("$.reason").value("WITHDRAWAL"));

        assertEquals(new BigDecimal("900.00"), fundsOf(aliceId));
    }

    @Test
    void withdrawingMoreThanTheCallerHasIsUnprocessableAndChangesNothing() throws Exception {
        mockMvc.perform(post("/api/me/cash-transactions")
                        .with(tokenFor(bobId, BOB_EMAIL))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"amount\":500.01,\"reason\":\"WITHDRAWAL\"}"))
                .andExpect(status().is(422))
                .andExpect(jsonPath("$.error").value("Insufficient funds"));

        assertEquals(new BigDecimal("500.00"), fundsOf(bobId));
        assertEquals(0, cashTransactionRepository.count());
    }

    @Test
    void anAmountThatIsNotPositiveIsRejected() throws Exception {
        mockMvc.perform(post("/api/me/cash-transactions")
                        .with(tokenFor(aliceId, ALICE_EMAIL))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"amount\":0,\"reason\":\"DEPOSIT\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("amount: must be greater than 0"));

        assertEquals(new BigDecimal("1000.00"), fundsOf(aliceId));
    }

    @Test
    void anUnknownReasonIsRejected() throws Exception {
        mockMvc.perform(post("/api/me/cash-transactions")
                        .with(tokenFor(aliceId, ALICE_EMAIL))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"amount\":10,\"reason\":\"ORDER_FILL\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("reason: must be DEPOSIT or WITHDRAWAL"));
    }

    @Test
    void anAmountFinerThanWholeCentsIsRejected() throws Exception {
        mockMvc.perform(post("/api/me/cash-transactions")
                        .with(tokenFor(aliceId, ALICE_EMAIL))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"amount\":1.234,\"reason\":\"DEPOSIT\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("amount: must be in whole cents"));
    }

    @Test
    void historyListsOnlyTheCallerOwnTransactionsNewestFirst() throws Exception {
        record(aliceAccountId, new BigDecimal("100.00"), "DEPOSIT", "2026-03-01T10:00:00Z");
        record(aliceAccountId, new BigDecimal("-40.00"), "WITHDRAWAL", "2026-03-02T10:00:00Z");
        record(bobAccountId, new BigDecimal("999.00"), "DEPOSIT", "2026-03-03T10:00:00Z");

        mockMvc.perform(get("/api/me/cash-transactions").with(tokenFor(aliceId, ALICE_EMAIL)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].reason").value("WITHDRAWAL"))
                .andExpect(jsonPath("$[0].amount").value(40.00))
                .andExpect(jsonPath("$[1].reason").value("DEPOSIT"))
                .andExpect(jsonPath("$[1].amount").value(100.00));

        // Bob sees his own row and none of Alice's.
        mockMvc.perform(get("/api/me/cash-transactions").with(tokenFor(bobId, BOB_EMAIL)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].amount").value(999.00));
    }

    @Test
    void historyLeavesOutOrderFillsBecauseTheyAreTradesRatherThanFunding() throws Exception {
        record(aliceAccountId, new BigDecimal("100.00"), "DEPOSIT", "2026-03-01T10:00:00Z");
        recordOrderFill(aliceAccountId, new BigDecimal("-25.00"), "2026-03-02T10:00:00Z");

        mockMvc.perform(get("/api/me/cash-transactions").with(tokenFor(aliceId, ALICE_EMAIL)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].reason").value("DEPOSIT"));
    }

    @Test
    void historyHonoursTheLimit() throws Exception {
        record(aliceAccountId, new BigDecimal("1.00"), "DEPOSIT", "2026-03-01T10:00:00Z");
        record(aliceAccountId, new BigDecimal("2.00"), "DEPOSIT", "2026-03-02T10:00:00Z");
        record(aliceAccountId, new BigDecimal("3.00"), "DEPOSIT", "2026-03-03T10:00:00Z");

        mockMvc.perform(get("/api/me/cash-transactions")
                        .param("limit", "2")
                        .with(tokenFor(aliceId, ALICE_EMAIL)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].amount").value(3.00));
    }

    @Test
    void aNewUserHasNoFundingHistory() throws Exception {
        UUID newcomerId = UUID.randomUUID();
        UserAccountFixture.createActiveAccount(jdbc, newcomerId, "new@example.com");
        registerUser(newcomerId, "Newly", "Registered", BigDecimal.ZERO);
        openAccount(newcomerId, "Main Account", LocalDate.now());

        mockMvc.perform(get("/api/me/cash-transactions").with(tokenFor(newcomerId, "new@example.com")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void cashEndpointsRejectAnUnauthenticatedCaller() throws Exception {
        mockMvc.perform(get("/api/me/cash-transactions"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(post("/api/me/cash-transactions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"amount\":10,\"reason\":\"DEPOSIT\"}"))
                .andExpect(status().isUnauthorized());

        assertEquals(new BigDecimal("1000.00"), fundsOf(aliceId));
    }

    @Test
    void aCallerCannotMoveAnotherUserFundsByNamingTheirAccount() throws Exception {
        // The request body has no account field, and an attempt to smuggle one in is
        // ignored: the ledger row and the balance both follow the token's subject.
        mockMvc.perform(post("/api/me/cash-transactions")
                        .with(tokenFor(bobId, BOB_EMAIL))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"amount\":10,\"reason\":\"WITHDRAWAL\",\"accountId\":"
                                + aliceAccountId + "}"))
                .andExpect(status().isCreated());

        assertEquals(new BigDecimal("1000.00"), fundsOf(aliceId));
        assertEquals(new BigDecimal("490.00"), fundsOf(bobId));
        assertEquals(bobAccountId,
                cashTransactionRepository.findAll().get(0).getAccountId());
    }

    @Test
    void movingCashBeforeRegisteringAProfileIsNotFound() throws Exception {
        UUID strangerId = UUID.randomUUID();
        UserAccountFixture.createActiveAccount(jdbc, strangerId, "stranger@example.com");

        mockMvc.perform(post("/api/me/cash-transactions")
                        .with(tokenFor(strangerId, "stranger@example.com"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"amount\":10,\"reason\":\"DEPOSIT\"}"))
                .andExpect(status().isNotFound());
    }

    private BigDecimal fundsOf(UUID userId) {
        return userRepository.findById(userId).orElseThrow().getAvailableFunds();
    }

    private void registerUser(UUID userId, String firstName, String lastName, BigDecimal funds) {
        User user = new User();
        user.setUserId(userId);
        user.setFirstName(firstName);
        user.setLastName(lastName);
        user.setSsn("000-00-0000");
        user.setAddress("1 Test Street");
        user.setDateOfBirth(LocalDate.of(1990, 1, 1));
        user.setTraderLevel("BEGINNER");
        user.setAvailableFunds(funds);
        user.setCreatedAt(OffsetDateTime.now());
        userRepository.save(user);
    }

    private Integer openAccount(UUID userId, String name, LocalDate openedDate) {
        Account account = new Account();
        account.setUserId(userId);
        account.setName(name);
        account.setOpenedDate(openedDate);
        account.setCashBalance(BigDecimal.ZERO);
        account.setCurrency("USD");
        return accountRepository.save(account).getAccountId();
    }

    private void record(Integer accountId, BigDecimal amount, String reason, String createdAt) {
        CashTransaction transaction = new CashTransaction();
        transaction.setAccountId(accountId);
        transaction.setAmount(amount);
        transaction.setReason(reason);
        transaction.setCreatedAt(OffsetDateTime.parse(createdAt));
        cashTransactionRepository.save(transaction);
    }

    private void recordOrderFill(Integer accountId, BigDecimal amount, String createdAt) {
        CashTransaction transaction = new CashTransaction();
        transaction.setAccountId(accountId);
        transaction.setAmount(amount);
        transaction.setReason("ORDER_FILL");
        transaction.setCreatedAt(OffsetDateTime.parse(createdAt));
        cashTransactionRepository.save(transaction);
    }
}
