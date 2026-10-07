package app.user;

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

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    public void cleanDatabase() {
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
        mockMvc.perform(post("/api/auth/register")
                .with(tokenFor(userId, email))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body)))
            .andExpect(status().isCreated());
    }

    @Test void settingsPersistAndCannotChangeAnotherUser() throws Exception {
        UUID alice = UUID.randomUUID(), bob = UUID.randomUUID();
        registerUser(alice, "Alice", "alice@example.com"); registerUser(bob, "Bob", "bob@example.com");
        mockMvc.perform(get("/api/users/me/execution-settings").with(tokenFor(alice, "alice@example.com")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.executionBufferPercent").value(1));
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put("/api/users/me/execution-settings")
                .with(tokenFor(alice, "alice@example.com")).contentType(MediaType.APPLICATION_JSON)
                .content("{\"executionBufferPercent\":1.25,\"userId\":\"" + bob + "\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.executionBufferPercent").value(1.25));
        mockMvc.perform(get("/api/users/me/execution-settings").with(tokenFor(bob, "bob@example.com")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.executionBufferPercent").value(1));
        for (String value : new String[]{"null", "-1", "10.01", "1.001"})
            mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put("/api/users/me/execution-settings")
                    .with(tokenFor(alice, "alice@example.com")).contentType(MediaType.APPLICATION_JSON)
                    .content("{\"executionBufferPercent\":" + value + "}"))
                    .andExpect(status().isBadRequest());
        for (String value : new String[]{"0", "10"})
            mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put("/api/users/me/execution-settings")
                    .with(tokenFor(alice, "alice@example.com")).contentType(MediaType.APPLICATION_JSON)
                    .content("{\"executionBufferPercent\":" + value + "}"))
                    .andExpect(status().isOk());
        mockMvc.perform(get("/api/users/me/execution-settings")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/users/me/execution-settings").with(tokenFor(UUID.randomUUID(), "missing@example.com")))
                .andExpect(status().isNotFound());
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
