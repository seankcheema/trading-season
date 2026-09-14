package com.neueda.leap.auth;

import com.neueda.leap.user.SessionRepository;
import com.neueda.leap.user.User;
import com.neueda.leap.user.UserRepository;
import com.neueda.leap.user.UserSession;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@Tag("unit")
class AuthServiceUnitTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private SessionRepository sessionRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    private AuthService authService;

    @BeforeEach
    void setUp() {
        authService = new AuthService(userRepository, sessionRepository, passwordEncoder);
    }

    @Test
    void registerSuccessfully() {
        RegisterRequest request = new RegisterRequest(
            "testuser", 
            "test@example.com", 
            "Password123!", 
            "John", 
            null, 
            "Doe", 
            "123-45-6789", 
            "123 Main St", 
            LocalDate.of(1990, 1, 1)
        );

        when(userRepository.existsByUsername("testuser")).thenReturn(false);
        when(userRepository.existsByEmail("test@example.com")).thenReturn(false);
        when(passwordEncoder.encode("Password123!")).thenReturn("hashedPassword");
        
        User savedUser = new User();
        savedUser.setUserId(UUID.randomUUID());
        savedUser.setUsername("testuser");
        savedUser.setEmail("test@example.com");
        when(userRepository.save(any(User.class))).thenReturn(savedUser);

        User result = authService.register(request);

        assertNotNull(result);
        assertEquals("testuser", result.getUsername());
        assertEquals("test@example.com", result.getEmail());
    }

    @Test
    void registerFailsWithDuplicateUsername() {
        RegisterRequest request = new RegisterRequest(
            "testuser", 
            "test@example.com", 
            "Password123!", 
            "John", 
            null, 
            "Doe", 
            "123-45-6789", 
            "123 Main St", 
            LocalDate.of(1990, 1, 1)
        );

        when(userRepository.existsByUsername("testuser")).thenReturn(true);

        assertThrows(ConflictException.class, () -> authService.register(request));
    }

    @Test
    void registerFailsWithDuplicateEmail() {
        RegisterRequest request = new RegisterRequest(
            "testuser", 
            "test@example.com", 
            "Password123!", 
            "John", 
            null, 
            "Doe", 
            "123-45-6789", 
            "123 Main St", 
            LocalDate.of(1990, 1, 1)
        );

        when(userRepository.existsByUsername("testuser")).thenReturn(false);
        when(userRepository.existsByEmail("test@example.com")).thenReturn(true);

        assertThrows(ConflictException.class, () -> authService.register(request));
    }

    @Test
    void loginSuccessfully() {
        User user = new User();
        user.setUserId(UUID.randomUUID());
        user.setUsername("testuser");
        user.setPasswordHash("hashedPassword");
        user.setAccountStatus("ACTIVE");
        user.setFailedLoginAttempts(0);
        user.setSessionTimeoutMinutes(30);

        LoginRequest loginRequest = new LoginRequest("testuser", "Password123!");

        when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("Password123!", "hashedPassword")).thenReturn(true);
        
        UserSession savedSession = new UserSession();
        savedSession.setSessionId(UUID.randomUUID());
        savedSession.setUserId(user.getUserId());
        when(sessionRepository.save(any(UserSession.class))).thenReturn(savedSession);

        UserSession result = authService.login(loginRequest);

        assertNotNull(result);
        assertEquals(user.getUserId(), result.getUserId());
    }

    @Test
    void loginFailsWithInvalidPassword() {
        User user = new User();
        user.setUserId(UUID.randomUUID());
        user.setUsername("testuser");
        user.setPasswordHash("hashedPassword");
        user.setAccountStatus("ACTIVE");
        user.setFailedLoginAttempts(0);

        LoginRequest loginRequest = new LoginRequest("testuser", "WrongPassword!");

        when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("WrongPassword!", "hashedPassword")).thenReturn(false);

        assertThrows(UnauthorizedException.class, () -> authService.login(loginRequest));
    }

    @Test
    void loginFailsForNonexistentUser() {
        LoginRequest loginRequest = new LoginRequest("nonexistent", "Password123!");

        when(userRepository.findByUsername("nonexistent")).thenReturn(Optional.empty());

        assertThrows(UnauthorizedException.class, () -> authService.login(loginRequest));
    }

    @Test
    void loginFailsForInactiveAccount() {
        User user = new User();
        user.setUserId(UUID.randomUUID());
        user.setUsername("testuser");
        user.setAccountStatus("INACTIVE");

        LoginRequest loginRequest = new LoginRequest("testuser", "Password123!");

        when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(user));

        assertThrows(UnauthorizedException.class, () -> authService.login(loginRequest));
    }
}
