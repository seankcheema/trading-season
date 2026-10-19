package app.user;

import app.account.AccountRepository;
import app.cash.CashTransactionRepository;
import app.support.UserAccountFixture;
import tools.jackson.databind.ObjectMapper;
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
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.webAppContextSetup;

@SpringBootTest
@ActiveProfiles("test")
@Tag("integration")
class UserControllerIntegrationTest {

    private MockMvc mockMvc;

    @Autowired
    private WebApplicationContext webApplicationContext;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private TermsAcceptanceRepository termsAcceptanceRepository;

    @Autowired
    private AccountRepository accountRepository;

    @Autowired
    private CashTransactionRepository cashTransactionRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void cleanDatabase() {
        mockMvc = webAppContextSetup(webApplicationContext).apply(springSecurity()).build();
        termsAcceptanceRepository.deleteAll();
        // Registration books the opening funds on the default account, so both go first.
        cashTransactionRepository.deleteAll();
        accountRepository.deleteAll();
        userRepository.deleteAll();
        UserAccountFixture.deleteAll(jdbcTemplate);
    }

    private static RequestPostProcessor tokenFor(UUID userId, String email) {
        return jwt().jwt(token -> token
            .subject(userId.toString())
            .claim("email", email)
            .claim("roles", List.of("TRADER")));
    }

    private void registerUser(UUID userId, String firstName, String email) throws Exception {
        // These tests mint their own tokens, so they must also create the
        // account row the auth service would have created first. /me now
        // reports role and status from it rather than from the profile copy.
        UserAccountFixture.createActiveAccount(jdbcTemplate, userId, email);

        Map<String, Object> body = Map.of(
            "email", email,
            "firstName", firstName,
            "lastName", "Tester",
            "ssn", "123-45-6789",
            "address", "1 Main St",
            "dateOfBirth", LocalDate.of(1990, 1, 1).toString(),
            "traderLevel", "ADVANCED",
            "availableFunds", new BigDecimal("10000.00"));
        mockMvc.perform(post("/api/registration")
                .with(tokenFor(userId, email))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body)))
            .andExpect(status().isCreated());
    }

    @Test
    void meReturnsOnlyTheCallersOwnAccount() throws Exception {
        UUID aliceId = UUID.randomUUID();
        UUID bobId = UUID.randomUUID();
        registerUser(aliceId, "alice", "alice@example.com");
        registerUser(bobId, "bob", "bob@example.com");

        mockMvc.perform(get("/api/users/me").with(tokenFor(aliceId, "alice@example.com")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.userId").value(aliceId.toString()))
            .andExpect(jsonPath("$.firstName").value("alice"))
            .andExpect(jsonPath("$.traderLevel").value("ADVANCED"))
            .andExpect(jsonPath("$.ssn").doesNotExist());

        mockMvc.perform(get("/api/users/me").with(tokenFor(bobId, "bob@example.com")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.userId").value(bobId.toString()))
            .andExpect(jsonPath("$.firstName").value("bob"));
    }

    @Test
    void meReturnsNotFoundBeforeRegistration() throws Exception {
        mockMvc.perform(get("/api/users/me").with(tokenFor(UUID.randomUUID(), "new@example.com")))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.error").exists());
    }

    @Test
    void meRequiresAccessToken() throws Exception {
        mockMvc.perform(get("/api/users/me"))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.error").exists());
    }

    private static String acceptance(String termsVersion) {
        return "{\"termsVersion\":\"" + termsVersion + "\"}";
    }

    @Test
    void aNewlyRegisteredUserHasNotAcceptedTheTerms() throws Exception {
        UUID aliceId = UUID.randomUUID();
        registerUser(aliceId, "alice", "alice@example.com");

        mockMvc.perform(get("/api/users/me").with(tokenFor(aliceId, "alice@example.com")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.termsAccepted").value(false));
    }

    @Test
    void acceptingTheTermsIsRecordedForTheCallerOnly() throws Exception {
        UUID aliceId = UUID.randomUUID();
        UUID bobId = UUID.randomUUID();
        registerUser(aliceId, "alice", "alice@example.com");
        registerUser(bobId, "bob", "bob@example.com");

        mockMvc.perform(put("/api/users/me/terms-acceptance")
                .with(tokenFor(aliceId, "alice@example.com"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(acceptance(UserService.CURRENT_TERMS_VERSION)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.userId").value(aliceId.toString()))
            .andExpect(jsonPath("$.termsAccepted").value(true))
            .andExpect(jsonPath("$.ssn").doesNotExist());

        mockMvc.perform(get("/api/users/me").with(tokenFor(aliceId, "alice@example.com")))
            .andExpect(jsonPath("$.termsAccepted").value(true));
        mockMvc.perform(get("/api/users/me").with(tokenFor(bobId, "bob@example.com")))
            .andExpect(jsonPath("$.termsAccepted").value(false));
    }

    @Test
    void acceptingTheTermsAgainKeepsTheFirstAcceptance() throws Exception {
        UUID aliceId = UUID.randomUUID();
        registerUser(aliceId, "alice", "alice@example.com");
        TermsAcceptanceId id = new TermsAcceptanceId(aliceId, UserService.CURRENT_TERMS_VERSION);

        mockMvc.perform(put("/api/users/me/terms-acceptance")
                .with(tokenFor(aliceId, "alice@example.com"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(acceptance(UserService.CURRENT_TERMS_VERSION)))
            .andExpect(status().isOk());
        var firstAcceptedAt = termsAcceptanceRepository.findById(id).orElseThrow().getAcceptedAt();

        mockMvc.perform(put("/api/users/me/terms-acceptance")
                .with(tokenFor(aliceId, "alice@example.com"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(acceptance(UserService.CURRENT_TERMS_VERSION)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.termsAccepted").value(true));

        assertEquals(1, termsAcceptanceRepository.count());
        assertEquals(firstAcceptedAt, termsAcceptanceRepository.findById(id).orElseThrow().getAcceptedAt());
    }

    @Test
    void acceptingAVersionThatIsNotInForceIsRefusedAndRecordsNothing() throws Exception {
        UUID aliceId = UUID.randomUUID();
        registerUser(aliceId, "alice", "alice@example.com");

        mockMvc.perform(put("/api/users/me/terms-acceptance")
                .with(tokenFor(aliceId, "alice@example.com"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(acceptance("2020-01-01")))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.error").value("The terms have changed. Reload to read the current version."));

        assertEquals(0, termsAcceptanceRepository.count());
        mockMvc.perform(get("/api/users/me").with(tokenFor(aliceId, "alice@example.com")))
            .andExpect(jsonPath("$.termsAccepted").value(false));
    }

    @Test
    void acceptingWithoutNamingAVersionIsABadRequest() throws Exception {
        UUID aliceId = UUID.randomUUID();
        registerUser(aliceId, "alice", "alice@example.com");

        mockMvc.perform(put("/api/users/me/terms-acceptance")
                .with(tokenFor(aliceId, "alice@example.com"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").exists());

        assertEquals(0, termsAcceptanceRepository.count());
    }

    @Test
    void acceptingTheTermsBeforeRegistrationIsNotFound() throws Exception {
        mockMvc.perform(put("/api/users/me/terms-acceptance")
                .with(tokenFor(UUID.randomUUID(), "new@example.com"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(acceptance(UserService.CURRENT_TERMS_VERSION)))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.error").exists());

        assertEquals(0, termsAcceptanceRepository.count());
    }

    @Test
    void acceptingTheTermsRequiresAccessToken() throws Exception {
        mockMvc.perform(put("/api/users/me/terms-acceptance")
                .contentType(MediaType.APPLICATION_JSON)
                .content(acceptance(UserService.CURRENT_TERMS_VERSION)))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.error").exists());
    }

    @Test
    void tradingPreferencePersistsAndIsIsolatedBetweenUsers() throws Exception {
        UUID alice = UUID.randomUUID(), bob = UUID.randomUUID();
        registerUser(alice, "alice", "alice@example.com"); registerUser(bob, "bob", "bob@example.com");
        mockMvc.perform(get("/api/users/me/execution-settings").with(tokenFor(alice, "alice@example.com")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.executionBufferPercent").value(1));
        mockMvc.perform(put("/api/users/me/execution-settings").with(tokenFor(alice, "alice@example.com"))
                .contentType(MediaType.APPLICATION_JSON).content("{\"executionBufferPercent\":2.25}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.executionBufferPercent").value(2.25));
        mockMvc.perform(get("/api/users/me/execution-settings").with(tokenFor(alice, "different-device@example.com")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.executionBufferPercent").value(2.25));
        mockMvc.perform(get("/api/users/me/execution-settings").with(tokenFor(bob, "bob@example.com")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.executionBufferPercent").value(1));
        assertEquals(0, new BigDecimal("2.25").compareTo(userRepository.findById(alice).orElseThrow().getExecutionBufferPercent()));
    }
    @Test
    void tradingPreferenceRejectsInvalidValuesAndRequiresAuthentication() throws Exception {
        UUID alice = UUID.randomUUID(); registerUser(alice, "alice", "alice@example.com");
        for (String value : List.of("-0.01", "10.01", "1.001", "null", "\"not-a-number\"")) {
            mockMvc.perform(put("/api/users/me/execution-settings").with(tokenFor(alice, "alice@example.com"))
                    .contentType(MediaType.APPLICATION_JSON).content("{\"executionBufferPercent\":" + value + "}"))
                    .andExpect(status().isBadRequest());
        }
        for (String value : List.of("0", "10")) {
            mockMvc.perform(put("/api/users/me/execution-settings").with(tokenFor(alice, "alice@example.com"))
                    .contentType(MediaType.APPLICATION_JSON).content("{\"executionBufferPercent\":" + value + "}"))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.executionBufferPercent").value(Integer.parseInt(value)));
        }
        mockMvc.perform(get("/api/users/me/execution-settings")).andExpect(status().isUnauthorized());
        mockMvc.perform(put("/api/users/me/execution-settings").contentType(MediaType.APPLICATION_JSON)
                .content("{\"executionBufferPercent\":2}")).andExpect(status().isUnauthorized());
    }
}
