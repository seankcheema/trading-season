package app.auth;

import app.user.SessionRepository;
import app.user.User;
import app.user.UserRepository;
import app.user.UserSession;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@Tag("unit")
class AuthServiceUnitTest {

    private static final UUID USER_ID = UUID.fromString("7c9e6679-7425-40de-944b-e07fc1f90ae7");

    @Mock
    private UserRepository userRepository;

    private AuthService authService;

    @BeforeEach
    void setUp() {
        authService = new AuthService(userRepository);
    }

    private static RegisterRequest request(String email) {
        return new RegisterRequest(
            email,
            "John",
            "Quincy",
            "Doe",
            "123-45-6789",
            "123 Main St",
            LocalDate.of(1990, 1, 1),
            "INTERMEDIATE",
            new BigDecimal("7500.00")
        );
    }

    @Test
    void registerCreatesAccountKeyedByTokenSubject() {
        AuthenticatedUser caller = new AuthenticatedUser(USER_ID, "test@example.com");
        when(userRepository.existsById(USER_ID)).thenReturn(false);
        when(userRepository.existsByEmailIgnoreCase("test@example.com")).thenReturn(false);
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        User result = authService.register(caller, request("test@example.com"));

        ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(saved.capture());
        User user = saved.getValue();
        assertSame(user, result);
        assertEquals(USER_ID, user.getUserId());
        assertEquals("test@example.com", user.getEmail());
        assertEquals("John", user.getFirstName());
        assertEquals("Quincy", user.getMiddleName());
        assertEquals("Doe", user.getLastName());
        assertEquals("123-45-6789", user.getSsn());
        assertEquals("123 Main St", user.getAddress());
        assertEquals(LocalDate.of(1990, 1, 1), user.getDateOfBirth());
        assertEquals("INTERMEDIATE", user.getTraderLevel());
        assertEquals(new BigDecimal("7500.00"), user.getAvailableFunds());
        assertNotNull(user.getCreatedAt());
    }

    @Test
    void registerAcceptsEmailInDifferentCaseFromToken() {
        AuthenticatedUser caller = new AuthenticatedUser(USER_ID, "Test@Example.com");
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        User result = authService.register(caller, request("test@example.com"));

        assertEquals(USER_ID, result.getUserId());
    }

    @Test
    void registerFailsWhenEmailDoesNotMatchToken() {
        AuthenticatedUser caller = new AuthenticatedUser(USER_ID, "someone-else@example.com");

        assertThrows(ForbiddenException.class,
            () -> authService.register(caller, request("test@example.com")));
        verify(userRepository, never()).save(any());
    }

    @Test
    void registerFailsWhenTokenHasNoEmail() {
        AuthenticatedUser caller = new AuthenticatedUser(USER_ID, null);

        assertThrows(ForbiddenException.class,
            () -> authService.register(caller, request("test@example.com")));
        verify(userRepository, never()).save(any());
    }

    @Test
    void registerFailsWhenAccountAlreadyRegistered() {
        AuthenticatedUser caller = new AuthenticatedUser(USER_ID, "test@example.com");
        when(userRepository.existsById(USER_ID)).thenReturn(true);

        assertThrows(ConflictException.class,
            () -> authService.register(caller, request("test@example.com")));
        verify(userRepository, never()).save(any());
    }

    @Test
    void registerFailsWithDuplicateEmail() {
        AuthenticatedUser caller = new AuthenticatedUser(USER_ID, "test@example.com");
        when(userRepository.existsByEmailIgnoreCase("test@example.com")).thenReturn(true);

        assertThrows(ConflictException.class,
            () -> authService.register(caller, request("test@example.com")));
        verify(userRepository, never()).save(any());
    }

    @Test
    void accountExistsReturnsTrueForRegisteredEmail() {
        when(userRepository.existsByEmailIgnoreCase("test@example.com")).thenReturn(true);

        assertTrue(authService.accountExists("test@example.com"));
    }

    @Test
    void accountExistsReturnsFalseForUnknownEmail() {
        when(userRepository.existsByEmailIgnoreCase("nobody@example.com")).thenReturn(false);

        assertFalse(authService.accountExists("nobody@example.com"));
    }

    @Test
    void accountExistsIgnoresSurroundingWhitespace() {
        when(userRepository.existsByEmailIgnoreCase("test@example.com")).thenReturn(true);

        assertTrue(authService.accountExists("  test@example.com "));
    }
}