package app.dua;

import app.account.Account;
import app.account.AccountRepository;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.webAppContextSetup;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class DuaReadStateTest {
    @Autowired WebApplicationContext application;
    @Autowired AccountRepository accounts;
    @Autowired EntityManager entities;
    private MockMvc mvc;
    private UUID owner;
    private Integer accountId;

    @BeforeEach void setup() {
        mvc = webAppContextSetup(application).apply(springSecurity()).build();
        owner = UUID.randomUUID();
        Account account = new Account();
        account.setUserId(owner); account.setName("Dua"); account.setOpenedDate(LocalDate.of(2026, 1, 1));
        account.setCashBalance(BigDecimal.ZERO); account.setCurrency("USD");
        accountId = accounts.saveAndFlush(account).getAccountId();
    }
    private RequestPostProcessor token(UUID user) {
        return jwt().jwt(j -> j.subject(user.toString()).claim("roles", List.of("TRADER")));
    }
    private String context(String version) {
        return "{\"accountId\":" + accountId + ",\"sessionId\":1,\"insight\":\"stock\",\"symbol\":\"JPM\",\"version\":\"" + version + "\"}";
    }
    @Test void exactVersionsAreIdempotentAndIndependent() throws Exception {
        for (int i = 0; i < 2; i++) mvc.perform(put("/api/me/dua/read-state").with(token(owner))
                .contentType(MediaType.APPLICATION_JSON).content(context("old"))).andExpect(status().isOk());
        mvc.perform(post("/api/me/dua/read-state/query").with(token(owner)).contentType(MediaType.APPLICATION_JSON)
                .content("{\"contexts\":[" + context("old") + "," + context("new") + "]}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].version").value("old"));
        mvc.perform(put("/api/me/dua/read-state").with(token(owner)).contentType(MediaType.APPLICATION_JSON)
                .content(context("new"))).andExpect(status().isOk());
        mvc.perform(post("/api/me/dua/read-state/query").with(token(owner)).contentType(MediaType.APPLICATION_JSON)
                .content("{\"contexts\":[" + context("old") + "," + context("new") + "]}"))
                .andExpect(jsonPath("$.length()").value(2));
    }
    @Test void entityMappingReadsRowsTheRepositoryWrites() throws Exception {
        mvc.perform(put("/api/me/dua/read-state").with(token(owner)).contentType(MediaType.APPLICATION_JSON)
                .content(context("mapped"))).andExpect(status().isOk());
        assertEquals(1, entities.createQuery("SELECT d FROM DuaReadState d", DuaReadState.class).getResultList().size());
    }
    @Test void anotherUserCannotReadOrAcknowledge() throws Exception {
        UUID other = UUID.randomUUID();
        mvc.perform(put("/api/me/dua/read-state").with(token(other)).contentType(MediaType.APPLICATION_JSON)
                .content(context("one"))).andExpect(status().isNotFound());
        mvc.perform(post("/api/me/dua/read-state/query").with(token(other)).contentType(MediaType.APPLICATION_JSON)
                .content("{\"contexts\":[" + context("one") + "]}")).andExpect(status().isNotFound());
    }
    @Test void validatesContextsAndRequiresTraderAuthentication() throws Exception {
        mvc.perform(put("/api/me/dua/read-state").contentType(MediaType.APPLICATION_JSON).content(context("one")))
                .andExpect(status().isUnauthorized());
        mvc.perform(put("/api/me/dua/read-state").with(jwt().authorities(new SimpleGrantedAuthority("ROLE_ADMIN")))
                .contentType(MediaType.APPLICATION_JSON).content(context("one"))).andExpect(status().isForbidden());
        mvc.perform(put("/api/me/dua/read-state").with(token(owner)).contentType(MediaType.APPLICATION_JSON)
                .content(context("one").replace("JPM", ""))).andExpect(status().isBadRequest());
        mvc.perform(put("/api/me/dua/read-state").with(token(owner)).contentType(MediaType.APPLICATION_JSON)
                .content(context("one").replace("stock", "daily"))).andExpect(status().isBadRequest());
        mvc.perform(put("/api/me/dua/read-state").with(token(owner)).contentType(MediaType.APPLICATION_JSON)
                .content(context("one").replace("stock", "invalid"))).andExpect(status().isBadRequest());
        mvc.perform(put("/api/me/dua/read-state").with(token(owner)).contentType(MediaType.APPLICATION_JSON)
                .content(context("one").replace("stock", "daily").replace("JPM", ""))).andExpect(status().isOk());
    }
}
