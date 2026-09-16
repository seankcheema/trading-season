package com.neueda.leap.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.neueda.leap.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Tag("integration")
class AuthControllerIntegrationTest {

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

    /** A verified token for the given auth-service user, as the resource server would see it. */
    static RequestPostProcessor tokenFor(UUID userId, String email) {
        return jwt().jwt(token -> token
            .subject(userId.toString())
            .claim("email", email)
            .claim("roles", List.of("TRADER")));
    }

    static RegisterRequest registration(String email) {
        return new RegisterRequest(
            email,
            "Alice",
            null,
            "Anderson",
            "123-45-6789",
            "1 Main St",
            LocalDate.of(1990, 1, 1),
            "BEGINNER",
            new BigDecimal("5000.00")
        );
    }

    private ResultActions register(RequestPostProcessor token, Object body) throws Exception {
        var request = post("/api/auth/register")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(body));
        if (token != null) {
            request.with(token);
        }
        return mockMvc.perform(request);
    }

    private ResultActions accountExists(Object body) throws Exception {
        return mockMvc.perform(post("/api/auth/account-exists")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(body)));
    }

    // Registration

    @Test
    void registerSuccessfullyUsesTokenSubjectAsUserId() throws Exception {
        UUID userId = UUID.randomUUID();

        register(tokenFor(userId, "alice@example.com"), registration("alice@example.com"))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.userId").value(userId.toString()))
            .andExpect(jsonPath("$.email").value("alice@example.com"));

        var saved = userRepository.findById(userId).orElseThrow();
        assertEquals("Alice", saved.getFirstName());
        assertEquals("BEGINNER", saved.getTraderLevel());
        assertEquals(0, new BigDecimal("5000.00").compareTo(saved.getAvailableFunds()));
    }

    @Test
    void registerRequiresAccessToken() throws Exception {
        register(null, registration("alice@example.com"))
            .andExpect(status().isUnauthorized())
            .andExpect(header().string(HttpHeaders.WWW_AUTHENTICATE, containsString("Bearer")))
            .andExpect(jsonPath("$.error").exists());

        assertEquals(0, userRepository.count());
    }

    @Test
    void registerRejectsMalformedAccessToken() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                .header(HttpHeaders.AUTHORIZATION, "Bearer not-a-jwt")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(registration("alice@example.com"))))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.error").exists());

        assertEquals(0, userRepository.count());
    }

    @Test
    void registerFailsWhenEmailDoesNotMatchToken() throws Exception {
        register(tokenFor(UUID.randomUUID(), "mallory@example.com"), registration("alice@example.com"))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.error").exists());

        assertEquals(0, userRepository.count());
    }

    @Test
    void registerFailsWhenAccountAlreadyRegistered() throws Exception {
        UUID userId = UUID.randomUUID();
        register(tokenFor(userId, "bob@example.com"), registration("bob@example.com"))
            .andExpect(status().isCreated());

        register(tokenFor(userId, "bob@example.com"), registration("bob@example.com"))
            .andExpect(status().isConflict());
    }

    @Test
    void registerFailsWithDuplicateEmailInDifferentCase() throws Exception {
        register(tokenFor(UUID.randomUUID(), "carol@example.com"), registration("carol@example.com"))
            .andExpect(status().isCreated());

        register(tokenFor(UUID.randomUUID(), "Carol@Example.com"), registration("Carol@Example.com"))
            .andExpect(status().isConflict());
    }

    @Test
    void registerFailsWithInvalidPayload() throws Exception {
        String email = "dave@example.com";
        RegisterRequest invalid = new RegisterRequest(
            email,
            "Dave",
            null,
            "Davis",
            "123456789",  // not XXX-XX-XXXX
            "1 Main St",
            LocalDate.now().plusDays(1),  // not in the past
            "EXPERT",  // not a trader level
            new BigDecimal("4999.99")  // below the minimum
        );

        String error = register(tokenFor(UUID.randomUUID(), email), invalid)
            .andExpect(status().isBadRequest())
            .andReturn().getResponse().getContentAsString();

        for (String field : List.of("ssn", "dateOfBirth", "traderLevel", "availableFunds")) {
            assertTrue(error.contains(field), () -> "expected a validation error for " + field + " in " + error);
        }
        assertEquals(0, userRepository.count());
    }

    @Test
    void registerFailsWhenRequiredFieldsAreMissing() throws Exception {
        String email = "erin@example.com";

        register(tokenFor(UUID.randomUUID(), email), Map.of("email", email))
            .andExpect(status().isBadRequest());

        assertEquals(0, userRepository.count());
    }

    @Test
    void loginEndpointNoLongerExists() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                .with(tokenFor(UUID.randomUUID(), "frank@example.com"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"frank@example.com\",\"password\":\"Password123!\"}"))
            .andExpect(status().isNotFound());
    }

    // Soft account existence check

    @Test
    void accountExistsIsFalseForUnregisteredEmail() throws Exception {
        accountExists(Map.of("email", "nobody@example.com"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.exists").value(false));
    }

    @Test
    void accountExistsIsTrueAfterRegistrationWithoutAccessToken() throws Exception {
        register(tokenFor(UUID.randomUUID(), "gina@example.com"), registration("gina@example.com"))
            .andExpect(status().isCreated());

        accountExists(Map.of("email", "gina@example.com"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.exists").value(true));
    }

    @Test
    void accountExistsIgnoresEmailCase() throws Exception {
        register(tokenFor(UUID.randomUUID(), "hank@example.com"), registration("hank@example.com"))
            .andExpect(status().isCreated());

        accountExists(Map.of("email", "HANK@Example.COM"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.exists").value(true));
    }

    @Test
    void accountExistsRejectsInvalidEmail() throws Exception {
        accountExists(Map.of("email", "not-an-email"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value(containsString("email")));
    }

    @Test
    void accountExistsRejectsMissingEmail() throws Exception {
        accountExists(Map.of())
            .andExpect(status().isBadRequest());
    }
}
