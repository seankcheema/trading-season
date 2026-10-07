package app.account;

import tools.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.web.context.WebApplicationContext;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.webAppContextSetup;

@SpringBootTest
@ActiveProfiles("test")
@Tag("integration")
class AccountControllerIntegrationTest {

    private MockMvc mockMvc;

    @Autowired
    private WebApplicationContext webApplicationContext;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private AccountRepository accountRepository;

    @Autowired
    private app.holding.HoldingRepository holdingRepository;

    // JUnit invokes this lifecycle hook through reflection.
    @BeforeEach
    public void setUp() {
        mockMvc = webAppContextSetup(webApplicationContext).apply(springSecurity()).build();
        holdingRepository.deleteAll();
        accountRepository.deleteAll();
    }

    private static RequestPostProcessor tokenFor(UUID userId, String email) {
        return jwt().jwt(token -> token
            .subject(userId.toString())
            .claim("email", email)
            .claim("roles", List.of("TRADER")));
    }

    @Test
    void deletionArchivesWithoutRemovingHoldingsAndAllowsNameReuse() throws Exception {
        UUID owner = UUID.randomUUID();
        Account account = new Account();
        account.setUserId(owner);
        account.setName("Reusable");
        account.setOpenedDate(LocalDate.now());
        account = accountRepository.save(account);
        int id = account.getId();
        app.holding.Holding holding = new app.holding.Holding();
        holding.setAccountId(id);
        holding.setInstrumentId(100);
        holding.setQuantity(BigDecimal.ZERO);
        holding.setUpdatedAt(java.time.OffsetDateTime.now());
        holdingRepository.save(holding);
        mockMvc.perform(delete("/api/accounts/" + id)).andExpect(status().isUnauthorized());
        mockMvc.perform(delete("/api/accounts/" + id).with(tokenFor(UUID.randomUUID(), "other@example.com")))
                .andExpect(status().isForbidden());
        mockMvc.perform(delete("/api/accounts/" + id).with(tokenFor(owner, "owner@example.com")))
                .andExpect(status().isNoContent());
        org.junit.jupiter.api.Assertions.assertNotNull(accountRepository.findById(id).orElseThrow().getArchivedAt());
        org.junit.jupiter.api.Assertions.assertEquals(1, holdingRepository.findByAccountId(id).size());
        mockMvc.perform(delete("/api/accounts/" + id).with(tokenFor(owner, "owner@example.com")))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/me/accounts").with(tokenFor(owner, "owner@example.com")))
                .andExpect(content().json("[]"));
        mockMvc.perform(get("/api/accounts/" + id).with(tokenFor(owner, "owner@example.com")))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/me/accounts").with(tokenFor(owner, "owner@example.com"))
                .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Reusable\"}"))
                .andExpect(status().isCreated());
    }

    @Test
    void openPositionRefusesDeletionAndMissingAccountReturns404() throws Exception {
        UUID owner = UUID.randomUUID();
        Account account = new Account();
        account.setUserId(owner);
        account.setName("Invested");
        account.setOpenedDate(LocalDate.now());
        int id = accountRepository.save(account).getId();
        app.holding.Holding holding = new app.holding.Holding();
        holding.setAccountId(id);
        holding.setInstrumentId(100);
        holding.setQuantity(BigDecimal.ONE);
        holding.setUpdatedAt(java.time.OffsetDateTime.now());
        holdingRepository.save(holding);
        mockMvc.perform(delete("/api/accounts/" + id).with(tokenFor(owner, "owner@example.com")))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.error").value("Close all positions before deleting this account"));
        org.junit.jupiter.api.Assertions.assertNull(accountRepository.findById(id).orElseThrow().getArchivedAt());
        mockMvc.perform(delete("/api/accounts/2147483647").with(tokenFor(owner, "owner@example.com")))
                .andExpect(status().isNotFound());
    }

    @Test
    void listAccountsReturnsOnlyAuthenticatedUserAccounts() throws Exception {
        UUID aliceId = UUID.randomUUID();
        UUID bobId = UUID.randomUUID();

        // Create accounts for Alice (with different dates to ensure ordering)
        Account aliceAccount1 = new Account();
        aliceAccount1.setUserId(aliceId);
        aliceAccount1.setName("Alice Account 1");
        aliceAccount1.setOpenedDate(LocalDate.of(2026, 1, 1));
        aliceAccount1.setCashBalance(BigDecimal.valueOf(1000));
        aliceAccount1.setCurrency("USD");
        accountRepository.save(aliceAccount1);

        Account aliceAccount2 = new Account();
        aliceAccount2.setUserId(aliceId);
        aliceAccount2.setName("Alice Account 2");
        aliceAccount2.setOpenedDate(LocalDate.of(2026, 1, 15));
        aliceAccount2.setCashBalance(BigDecimal.valueOf(2000));
        aliceAccount2.setCurrency("USD");
        accountRepository.save(aliceAccount2);

        // Create account for Bob
        Account bobAccount = new Account();
        bobAccount.setUserId(bobId);
        bobAccount.setName("Bob Account");
        bobAccount.setOpenedDate(LocalDate.now());
        bobAccount.setCashBalance(BigDecimal.valueOf(3000));
        bobAccount.setCurrency("USD");
        accountRepository.save(bobAccount);

        // Alice retrieves her accounts
        mockMvc.perform(get("/api/me/accounts")
                .with(tokenFor(aliceId, "alice@example.com")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(2))
            .andExpect(jsonPath("$[0].name").value("Alice Account 2")) // Newest first
            .andExpect(jsonPath("$[1].name").value("Alice Account 1"))
            .andExpect(jsonPath("$[*].userId", org.hamcrest.Matchers.everyItem(
                    org.hamcrest.Matchers.equalTo(aliceId.toString()))));

        // Bob retrieves his accounts (should only see his own)
        mockMvc.perform(get("/api/me/accounts")
                .with(tokenFor(bobId, "bob@example.com")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].name").value("Bob Account"));
    }

    @Test
    void getAccountReturnsAccountWhenOwned() throws Exception {
        UUID userId = UUID.randomUUID();
        Account account = new Account();
        account.setUserId(userId);
        account.setName("Test Account");
        account.setOpenedDate(LocalDate.of(2026, 1, 15));
        account.setCashBalance(BigDecimal.valueOf(5000.50));
        account.setCurrency("USD");
        Account saved = accountRepository.save(account);

        mockMvc.perform(get("/api/accounts/" + saved.getId())
                .with(tokenFor(userId, "user@example.com")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.accountId").value(saved.getId()))
            .andExpect(jsonPath("$.userId").value(userId.toString()))
            .andExpect(jsonPath("$.name").value("Test Account"))
            .andExpect(jsonPath("$.cashBalance").value(5000.50))
            .andExpect(jsonPath("$.currency").value("USD"));
    }

    @Test
    void getAccountReturns403WhenNotOwned() throws Exception {
        UUID ownerId = UUID.randomUUID();
        UUID otherId = UUID.randomUUID();

        Account account = new Account();
        account.setUserId(ownerId);
        account.setName("Someone Else's Account");
        account.setOpenedDate(LocalDate.now());
        account.setCashBalance(BigDecimal.valueOf(1000));
        account.setCurrency("USD");
        Account saved = accountRepository.save(account);

        // Other user tries to access
        mockMvc.perform(get("/api/accounts/" + saved.getId())
                .with(tokenFor(otherId, "other@example.com")))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.error").exists());
    }

    @Test
    void getAccountReturns404WhenNotFound() throws Exception {
        UUID userId = UUID.randomUUID();

        // Create an account first so we know a valid ID that isn't ours exists
        // Then try to access an account with ID + 10000 that definitely doesn't exist
        mockMvc.perform(get("/api/accounts/999999")
                .with(tokenFor(userId, "user@example.com")))
            .andExpect(status().isNotFound());
    }

    @Test
    void listHoldingsReturnsHoldingsForAccount() throws Exception {
        UUID userId = UUID.randomUUID();
        Account account = new Account();
        account.setUserId(userId);
        account.setName("Portfolio");
        account.setOpenedDate(LocalDate.now());
        account.setCashBalance(BigDecimal.valueOf(5000));
        account.setCurrency("USD");
        Account savedAccount = accountRepository.save(account);

        // Create holdings
        app.holding.Holding holding1 = new app.holding.Holding();
        holding1.setAccountId(savedAccount.getId());
        holding1.setInstrumentId(100);
        holding1.setQuantity(BigDecimal.valueOf(10));
        holding1.setUpdatedAt(java.time.OffsetDateTime.now());
        holdingRepository.save(holding1);

        app.holding.Holding holding2 = new app.holding.Holding();
        holding2.setAccountId(savedAccount.getId());
        holding2.setInstrumentId(101);
        holding2.setQuantity(BigDecimal.valueOf(5.5));
        holding2.setUpdatedAt(java.time.OffsetDateTime.now());
        holdingRepository.save(holding2);

        mockMvc.perform(get("/api/accounts/" + savedAccount.getId() + "/holdings")
                .with(tokenFor(userId, "user@example.com")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(2))
            .andExpect(jsonPath("$[0].instrumentId").exists())
            .andExpect(jsonPath("$[0].quantity").exists())
            .andExpect(jsonPath("$[1].instrumentId").exists());
    }

    @Test
    void listHoldingsReturns403WhenNotOwned() throws Exception {
        UUID ownerId = UUID.randomUUID();
        UUID otherId = UUID.randomUUID();

        Account account = new Account();
        account.setUserId(ownerId);
        account.setName("Private Account");
        account.setOpenedDate(LocalDate.now());
        account.setCashBalance(BigDecimal.valueOf(1000));
        account.setCurrency("USD");
        Account saved = accountRepository.save(account);

        mockMvc.perform(get("/api/accounts/" + saved.getId() + "/holdings")
                .with(tokenFor(otherId, "other@example.com")))
            .andExpect(status().isForbidden());
    }

    @Test
    void listHoldingsReturnsEmptyWhenNoHoldings() throws Exception {
        UUID userId = UUID.randomUUID();
        Account account = new Account();
        account.setUserId(userId);
        account.setName("Empty Account");
        account.setOpenedDate(LocalDate.now());
        account.setCashBalance(BigDecimal.valueOf(1000));
        account.setCurrency("USD");
        Account saved = accountRepository.save(account);

        mockMvc.perform(get("/api/accounts/" + saved.getId() + "/holdings")
                .with(tokenFor(userId, "user@example.com")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void createAccountReturns201AndCreatesAccount() throws Exception {
        UUID userId = UUID.randomUUID();
        Map<String, String> request = Map.of("name", "New Trading Account");

        mockMvc.perform(post("/api/me/accounts")
                .with(tokenFor(userId, "user@example.com"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.userId").value(userId.toString()))
            .andExpect(jsonPath("$.name").value("New Trading Account"))
            .andExpect(jsonPath("$.currency").value("USD"))
            .andExpect(jsonPath("$.accountId").exists());

        // Verify account was saved to database
        List<Account> accounts = accountRepository.findByUserIdOrderByOpenedDateDesc(userId);
        assert accounts.size() == 1;
        assert accounts.get(0).getName().equals("New Trading Account");
        assert accounts.get(0).getUserId().equals(userId);
    }

    @Test
    void createAccountMultipleForSameUser() throws Exception {
        UUID userId = UUID.randomUUID();

        Map<String, String> request1 = Map.of("name", "Account One");
        mockMvc.perform(post("/api/me/accounts")
                .with(tokenFor(userId, "user@example.com"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request1)))
            .andExpect(status().isCreated());

        Map<String, String> request2 = Map.of("name", "Account Two");
        mockMvc.perform(post("/api/me/accounts")
                .with(tokenFor(userId, "user@example.com"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request2)))
            .andExpect(status().isCreated());

        List<Account> accounts = accountRepository.findByUserIdOrderByOpenedDateDesc(userId);
        assert accounts.size() == 2;
    }

    @Test
    void updateAccountNameReturnsUpdatedAccount() throws Exception {
        UUID userId = UUID.randomUUID();
        Account account = new Account();
        account.setUserId(userId);
        account.setName("Old Name");
        account.setOpenedDate(LocalDate.now());
        account.setCashBalance(BigDecimal.valueOf(1000));
        account.setCurrency("USD");
        Account saved = accountRepository.save(account);

        Map<String, String> request = Map.of("name", "Renamed Account");
        mockMvc.perform(put("/api/me/accounts/" + saved.getId())
                .with(tokenFor(userId, "user@example.com"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value("Renamed Account"));

        // Verify database was updated
        Account updated = accountRepository.findById(saved.getId()).orElseThrow();
        assert updated.getName().equals("Renamed Account");
    }

    @Test
    void updateAccountNameReturns403WhenNotOwned() throws Exception {
        UUID ownerId = UUID.randomUUID();
        UUID otherId = UUID.randomUUID();

        Account account = new Account();
        account.setUserId(ownerId);
        account.setName("Original Name");
        account.setOpenedDate(LocalDate.now());
        account.setCashBalance(BigDecimal.valueOf(1000));
        account.setCurrency("USD");
        Account saved = accountRepository.save(account);

        Map<String, String> request = Map.of("name", "Hacked Name");
        mockMvc.perform(put("/api/me/accounts/" + saved.getId())
                .with(tokenFor(otherId, "other@example.com"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isForbidden());

        // Verify database was NOT changed
        Account unchanged = accountRepository.findById(saved.getId()).orElseThrow();
        assert unchanged.getName().equals("Original Name");
    }

    @Test
    void endpointRequiresAuthentication() throws Exception {
        mockMvc.perform(get("/api/me/accounts"))
            .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/accounts/1"))
            .andExpect(status().isUnauthorized());

        mockMvc.perform(post("/api/me/accounts")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\": \"Test\"}"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void crossUserDataIsolation() throws Exception {
        UUID aliceId = UUID.randomUUID();
        UUID bobId = UUID.randomUUID();

        // Alice creates account
        Account aliceAccount = new Account();
        aliceAccount.setUserId(aliceId);
        aliceAccount.setName("Alice Private");
        aliceAccount.setOpenedDate(LocalDate.now());
        aliceAccount.setCashBalance(BigDecimal.valueOf(10000));
        aliceAccount.setCurrency("USD");
        Account aliceSaved = accountRepository.save(aliceAccount);

        // Bob cannot view Alice's account
        mockMvc.perform(get("/api/accounts/" + aliceSaved.getId())
                .with(tokenFor(bobId, "bob@example.com")))
            .andExpect(status().isForbidden());

        // Bob cannot update Alice's account
        Map<String, String> request = Map.of("name", "Hacked");
        mockMvc.perform(put("/api/me/accounts/" + aliceSaved.getId())
                .with(tokenFor(bobId, "bob@example.com"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isForbidden());

        // Bob cannot view Alice's holdings
        mockMvc.perform(get("/api/accounts/" + aliceSaved.getId() + "/holdings")
                .with(tokenFor(bobId, "bob@example.com")))
            .andExpect(status().isForbidden());

        // Alice can still access her own account
        mockMvc.perform(get("/api/accounts/" + aliceSaved.getId())
                .with(tokenFor(aliceId, "alice@example.com")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value("Alice Private"));
    }
}
