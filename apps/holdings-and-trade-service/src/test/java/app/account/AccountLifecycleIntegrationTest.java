package app.account;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.context.WebApplicationContext;
import java.time.LocalDate;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.webAppContextSetup;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class AccountLifecycleIntegrationTest {
    @Autowired AccountRepository accounts;
    @Autowired JdbcTemplate jdbc;
    @Autowired WebApplicationContext context;
    MockMvc mvc;
    UUID owner;
    Account account;
    @BeforeEach void setup() {
        mvc = webAppContextSetup(context).apply(springSecurity()).build();
        owner = UUID.randomUUID();
        account = create("Spare"); create("Keep");
    }
    Account create(String name) {
        Account a = new Account(); a.setUserId(owner); a.setName(name); a.setOpenedDate(LocalDate.now());
        return accounts.saveAndFlush(a);
    }
    String path() { return "/api/me/accounts/" + account.getId(); }
    @Test void archivesAndRetainsReadsWhileRejectingDuplicateAndRename() throws Exception {
        mvc.perform(post(path() + "/archive").with(jwt().jwt(t -> t.subject(owner.toString()))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("ARCHIVED"))
            .andExpect(jsonPath("$.archivedAt").isNotEmpty());
        mvc.perform(get("/api/me/accounts").with(jwt().jwt(t -> t.subject(owner.toString()))))
            .andExpect(jsonPath("$.length()").value(1));
        mvc.perform(get("/api/me/accounts/archived").with(jwt().jwt(t -> t.subject(owner.toString()))))
            .andExpect(jsonPath("$[0].accountId").value(account.getId()));
        mvc.perform(get("/api/accounts/" + account.getId()).with(jwt().jwt(t -> t.subject(owner.toString()))))
            .andExpect(status().isOk());
        mvc.perform(post(path() + "/archive").with(jwt().jwt(t -> t.subject(owner.toString()))))
            .andExpect(status().isConflict());
        mvc.perform(put(path()).contentType("application/json").content("{\"name\":\"Changed\"}")
            .with(jwt().jwt(t -> t.subject(owner.toString())))).andExpect(status().isConflict());
    }
    @Test void deletionNeedsConfirmationAndRepeatedDeleteIsConflict() throws Exception {
        mvc.perform(delete(path()).with(jwt().jwt(t -> t.subject(owner.toString())))).andExpect(status().isBadRequest());
        mvc.perform(delete(path()).param("confirmed", "true").with(jwt().jwt(t -> t.subject(owner.toString()))))
            .andExpect(status().isNoContent());
        mvc.perform(delete(path()).param("confirmed", "true").with(jwt().jwt(t -> t.subject(owner.toString()))))
            .andExpect(status().isConflict());
    }
    @Test void ownershipAndAuthenticationGuardEveryLifecyclePath() throws Exception {
        for (String suffix : new String[]{"/archive", ""}) {
            var request = suffix.isEmpty() ? delete(path()).param("confirmed", "true") : post(path() + suffix);
            mvc.perform(request).andExpect(status().isUnauthorized());
            mvc.perform(request.with(jwt().jwt(t -> t.subject(UUID.randomUUID().toString()))))
                .andExpect(status().isForbidden());
        }
        mvc.perform(get(path() + "/eligibility").with(jwt().jwt(t -> t.subject(UUID.randomUUID().toString()))))
            .andExpect(status().isForbidden());
        mvc.perform(get("/api/me/accounts/archived").with(jwt().jwt(t -> t.subject(UUID.randomUUID().toString()))))
            .andExpect(jsonPath("$.length()").value(0));
    }
    @Test void theOwnerSeesWhatBlocksArchivingAndDeleting() throws Exception {
        mvc.perform(get(path() + "/eligibility").with(jwt().jwt(t -> t.subject(owner.toString()))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.archiveBlockers").isArray())
            .andExpect(jsonPath("$.deleteBlockers").isArray());
    }
    @Test void fractionalAndNegativeSharesAndOpenOrdersAreNotEmpty() throws Exception {
        jdbc.update("INSERT INTO holdings(account_id,instrument_id,quantity,updated_at) VALUES (?,1,-0.0001,CURRENT_TIMESTAMP)", account.getId());
        mvc.perform(post(path() + "/archive").with(jwt().jwt(t -> t.subject(owner.toString()))))
            .andExpect(status().isConflict()).andExpect(jsonPath("$.error").value("Account contains active holdings"));
        jdbc.update("DELETE FROM holdings WHERE account_id = ?", account.getId());
        jdbc.update("INSERT INTO orders(order_id,account_id,status) VALUES (900000,?,'ACCEPTED')", account.getId());
        mvc.perform(post(path() + "/archive").with(jwt().jwt(t -> t.subject(owner.toString()))))
            .andExpect(status().isConflict()).andExpect(jsonPath("$.error").value("Pending orders must be resolved."));
        jdbc.update("UPDATE orders SET status = 'FILLED' WHERE order_id=900000");
        jdbc.update("INSERT INTO cash_transactions(account_id,amount,reason,created_at) VALUES (?,10,'DEPOSIT',CURRENT_TIMESTAMP)", account.getId());
        jdbc.update("INSERT INTO cash_transactions(account_id,amount,reason,created_at) VALUES (?,-10,'WITHDRAWAL',CURRENT_TIMESTAMP)", account.getId());
        mvc.perform(delete(path()).param("confirmed","true").with(jwt().jwt(t -> t.subject(owner.toString()))))
            .andExpect(status().isNoContent());
        assertEquals("ARCHIVED", accounts.findById(account.getId()).orElseThrow().getStatus());
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM orders WHERE account_id=?", Integer.class, account.getId()));
        assertEquals(2, jdbc.queryForObject("SELECT COUNT(*) FROM cash_transactions WHERE account_id=?", Integer.class, account.getId()));
    }
}
