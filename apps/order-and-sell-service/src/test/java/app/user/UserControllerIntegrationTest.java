package app.user;

import app.support.UserAccountFixture;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
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

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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
    private UserRepository userRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void cleanDatabase() {
        mockMvc = webAppContextSetup(webApplicationContext).apply(springSecurity()).build();
        userRepository.deleteAll();
        UserAccountFixture.deleteAll(jdbcTemplate);
    }

    private static RequestPostProcessor tokenFor(UUID userId, String email) {
        return jwt().jwt(token -> token
            .subject(userId.toString())
            .claim("email", email)
            .claim("roles", List.of("TRADER")));
    }

    private void registerUser(UUID userId, String firstName, String email) {
        // These tests mint their own tokens, so they must also create the
        // account row the auth service would have created first. /me now
        // reports role and status from it rather than from the profile copy.
        // The profile row is saved directly: registration belongs to Holdings
        // and Trade, so this service has no endpoint that creates it.
        UserAccountFixture.createActiveAccount(jdbcTemplate, userId, email);

        User user = new User();
        user.setUserId(userId);
        user.setFirstName(firstName);
        user.setLastName("Tester");
        user.setSsn("123-45-6789");
        user.setAddress("1 Main St");
        user.setDateOfBirth(LocalDate.of(1990, 1, 1));
        user.setTraderLevel("ADVANCED");
        user.setAvailableFunds(new BigDecimal("10000.00"));
        user.setCreatedAt(OffsetDateTime.now());
        userRepository.save(user);
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
}
