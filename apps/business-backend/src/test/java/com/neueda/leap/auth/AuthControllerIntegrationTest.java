package com.neueda.leap.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.neueda.leap.user.SessionRepository;
import com.neueda.leap.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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

    @Autowired
    private SessionRepository sessionRepository;

    @BeforeEach
    void cleanDatabase() {
        sessionRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void registerSuccessfully() throws Exception {
        RegisterRequest request = new RegisterRequest(
            "alice",
            "alice@example.com",
            "Password123!",
            "Alice",
            null,
            "Anderson",
            "123-45-6789",
            "1 Main St",
            LocalDate.of(1990, 1, 1)
        );

        mockMvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.username").value("alice"))
            .andExpect(jsonPath("$.email").value("alice@example.com"));
    }

    @Test
    void registerFailsWithDuplicateUsername() throws Exception {
        RegisterRequest request1 = new RegisterRequest(
            "bob",
            "bob@example.com",
            "Password123!",
            "Bob",
            null,
            "Brown",
            "123-45-6789",
            "1 Main St",
            LocalDate.of(1990, 1, 1)
        );

        mockMvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request1)))
            .andExpect(status().isCreated());

        RegisterRequest request2 = new RegisterRequest(
            "bob",
            "bob2@example.com",
            "Password123!",
            "Bob",
            null,
            "Brown",
            "123-45-6789",
            "1 Main St",
            LocalDate.of(1990, 1, 1)
        );

        mockMvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request2)))
            .andExpect(status().isConflict());
    }

    @Test
    void registerFailsWithInvalidPayload() throws Exception {
        RegisterRequest invalid = new RegisterRequest(
            "ab",  // too short
            "not-an-email",
            "short",
            "Alice",
            null,
            "Anderson",
            "123-45-6789",
            "1 Main St",
            LocalDate.of(1990, 1, 1)
        );

        mockMvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(invalid)))
            .andExpect(status().isBadRequest());
    }

    @Test
    void loginSuccessfully() throws Exception {
        RegisterRequest registerRequest = new RegisterRequest(
            "carol",
            "carol@example.com",
            "Password123!",
            "Carol",
            null,
            "Clark",
            "123-45-6789",
            "1 Main St",
            LocalDate.of(1990, 1, 1)
        );

        mockMvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(registerRequest)))
            .andExpect(status().isCreated());

        LoginRequest loginRequest = new LoginRequest("carol", "Password123!");

        mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(loginRequest)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.sessionId").exists())
            .andExpect(jsonPath("$.expiresAt").exists());
    }

    @Test
    void loginFailsWithWrongPassword() throws Exception {
        RegisterRequest registerRequest = new RegisterRequest(
            "dave",
            "dave@example.com",
            "Password123!",
            "Dave",
            null,
            "Davis",
            "123-45-6789",
            "1 Main St",
            LocalDate.of(1990, 1, 1)
        );

        mockMvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(registerRequest)))
            .andExpect(status().isCreated());

        LoginRequest loginRequest = new LoginRequest("dave", "WrongPassword!");

        mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(loginRequest)))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void loginFailsForNonexistentUser() throws Exception {
        LoginRequest loginRequest = new LoginRequest("nonexistent", "Password123!");

        mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(loginRequest)))
            .andExpect(status().isUnauthorized());
    }
}
