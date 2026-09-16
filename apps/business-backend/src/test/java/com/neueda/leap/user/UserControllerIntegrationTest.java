package com.neueda.leap.user;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

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

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Tag("integration")
class UserControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @BeforeEach
    void cleanDatabase() {
        userRepository.deleteAll();
    }

    private static RequestPostProcessor tokenFor(UUID userId, String email) {
        return jwt().jwt(token -> token
            .subject(userId.toString())
            .claim("email", email)
            .claim("roles", List.of("TRADER")));
    }

    private void registerUser(UUID userId, String firstName, String email) throws Exception {
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
