package app.user;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.oauth2.jwt.Jwt;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@Tag("unit")
class UserControllerUnitTest {

    private static final UUID USER_ID = UUID.fromString("7c9e6679-7425-40de-944b-e07fc1f90ae7");

    @Mock
    private UserService userService;

    @Mock
    private Jwt jwt;

    private UserController controller;

    @BeforeEach
    void setUp() {
        controller = new UserController(userService);
    }

    @Test
    void meReturnsUserProfileResponseForAuthenticatedUser() {
        User user = createTestUser(USER_ID);
        UserAccount account = createTestAccount("test@example.com", "TRADER");
        
        when(jwt.getSubject()).thenReturn(USER_ID.toString());
        when(userService.getOwnAccount(USER_ID)).thenReturn(user);
        when(userService.getUserAccount(USER_ID)).thenReturn(account);

        UserProfileResponse result = controller.me(jwt);

        assertNotNull(result);
        assertEquals(USER_ID, result.userId());
        assertEquals("test@example.com", result.email());
        assertEquals("Test", result.firstName());
        verify(userService).getOwnAccount(USER_ID);
    }

    @Test
    void meThrowsUserNotFoundWhenUserNotRegistered() {
        when(jwt.getSubject()).thenReturn(USER_ID.toString());
        when(userService.getOwnAccount(USER_ID))
                .thenThrow(new UserNotFoundException("Account is not registered"));

        assertThrows(UserNotFoundException.class, () -> controller.me(jwt));
    }

    @Test
    void meExtractsUserIdFromJwtToken() {
        User user = createTestUser(USER_ID);
        UserAccount account = createTestAccount("test@example.com", "TRADER");
        
        when(jwt.getSubject()).thenReturn(USER_ID.toString());
        when(userService.getOwnAccount(USER_ID)).thenReturn(user);
        when(userService.getUserAccount(USER_ID)).thenReturn(account);

        controller.me(jwt);

        verify(userService).getOwnAccount(USER_ID);
    }

    @Test
    void meReturnsProfileWithUserRole() {
        User user = createTestUser(USER_ID);
        UserAccount account = createTestAccount("test@example.com", "TRADER");
        
        when(jwt.getSubject()).thenReturn(USER_ID.toString());
        when(userService.getOwnAccount(USER_ID)).thenReturn(user);
        when(userService.getUserAccount(USER_ID)).thenReturn(account);

        UserProfileResponse result = controller.me(jwt);

        assertEquals("TRADER", result.userRole());
    }

    @Test
    void meReturnsTermsAcceptanceState() {
        User user = createTestUser(USER_ID);
        OffsetDateTime acceptedAt = OffsetDateTime.parse("2026-10-05T20:00:00Z");
        user.setTermsAcceptedAt(acceptedAt);
        UserAccount account = createTestAccount("test@example.com", "TRADER");

        when(jwt.getSubject()).thenReturn(USER_ID.toString());
        when(userService.getOwnAccount(USER_ID)).thenReturn(user);
        when(userService.getUserAccount(USER_ID)).thenReturn(account);

        UserProfileResponse result = controller.me(jwt);

        assertEquals(true, result.termsAccepted());
        assertEquals(acceptedAt, result.termsAcceptedAt());
    }

    @Test
    void acceptTermsReturnsUpdatedProfile() {
        User user = createTestUser(USER_ID);
        OffsetDateTime acceptedAt = OffsetDateTime.parse("2026-10-05T20:00:00Z");
        user.setTermsAcceptedAt(acceptedAt);
        UserAccount account = createTestAccount("test@example.com", "TRADER");

        when(jwt.getSubject()).thenReturn(USER_ID.toString());
        when(userService.acceptTerms(USER_ID)).thenReturn(user);
        when(userService.getUserAccount(USER_ID)).thenReturn(account);

        UserProfileResponse result = controller.acceptTerms(jwt);

        assertEquals(true, result.termsAccepted());
        assertEquals(acceptedAt, result.termsAcceptedAt());
        verify(userService).acceptTerms(USER_ID);
    }

    @Test
    void mePreservesAllUserFields() {
        User user = new User();
        user.setUserId(USER_ID);
        user.setFirstName("John");
        user.setMiddleName("Q");
        user.setLastName("Doe");
        user.setSsn("123-45-6789");
        user.setAddress("123 Main St");
        user.setDateOfBirth(LocalDate.of(1990, 1, 1));
        user.setTraderLevel("ADVANCED");
        user.setAvailableFunds(new BigDecimal("50000.00"));
        UserAccount account = createTestAccount("john@example.com", "TRADER");
        
        when(jwt.getSubject()).thenReturn(USER_ID.toString());
        when(userService.getOwnAccount(USER_ID)).thenReturn(user);
        when(userService.getUserAccount(USER_ID)).thenReturn(account);

        UserProfileResponse result = controller.me(jwt);

        assertEquals("John", result.firstName());
        assertEquals("Q", result.middleName());
        assertEquals("Doe", result.lastName());
        assertEquals("123 Main St", result.address());
        assertEquals(LocalDate.of(1990, 1, 1), result.dateOfBirth());
        assertEquals("ADVANCED", result.traderLevel());
        assertEquals(new BigDecimal("50000.00"), result.availableFunds());
    }

    @Test
    void meWithDifferentUsers() {
        UUID userId1 = UUID.randomUUID();
        UUID userId2 = UUID.randomUUID();
        UserAccount account1 = createTestAccount("user1@example.com", "TRADER");
        UserAccount account2 = createTestAccount("user2@example.com", "TRADER");
        
        User user1 = createTestUser(userId1);
        User user2 = createTestUser(userId2);
        
        when(userService.getOwnAccount(userId1)).thenReturn(user1);
        when(userService.getOwnAccount(userId2)).thenReturn(user2);
        when(userService.getUserAccount(userId1)).thenReturn(account1);
        when(userService.getUserAccount(userId2)).thenReturn(account2);

        when(jwt.getSubject()).thenReturn(userId1.toString());
        UserProfileResponse response1 = controller.me(jwt);

        when(jwt.getSubject()).thenReturn(userId2.toString());
        UserProfileResponse response2 = controller.me(jwt);

        assertEquals(userId1, response1.userId());
        assertEquals(userId2, response2.userId());
    }

    @Test
    void meCallsServiceWithExtractedUserId() {
        User user = createTestUser(USER_ID);
        UserAccount account = createTestAccount("test@example.com", "TRADER");
        
        when(jwt.getSubject()).thenReturn(USER_ID.toString());
        when(userService.getOwnAccount(USER_ID)).thenReturn(user);
        when(userService.getUserAccount(USER_ID)).thenReturn(account);

        controller.me(jwt);

        verify(userService).getOwnAccount(USER_ID);
    }

    @Test
    void meReturnsUserWithZeroFunds() {
        User user = createTestUser(USER_ID);
        user.setAvailableFunds(BigDecimal.ZERO);
        UserAccount account = createTestAccount("test@example.com", "TRADER");
        
        when(jwt.getSubject()).thenReturn(USER_ID.toString());
        when(userService.getOwnAccount(USER_ID)).thenReturn(user);
        when(userService.getUserAccount(USER_ID)).thenReturn(account);

        UserProfileResponse result = controller.me(jwt);

        assertEquals(BigDecimal.ZERO, result.availableFunds());
    }

    @Test
    void meReturnsUserWithDifferentTraderLevels() {
        String[] levels = {"BEGINNER", "INTERMEDIATE", "ADVANCED"};
        UserAccount account = createTestAccount("test@example.com", "TRADER");
        
        for (String level : levels) {
            User user = createTestUser(USER_ID);
            user.setTraderLevel(level);
            
            when(jwt.getSubject()).thenReturn(USER_ID.toString());
            when(userService.getOwnAccount(USER_ID)).thenReturn(user);
            when(userService.getUserAccount(USER_ID)).thenReturn(account);

            UserProfileResponse result = controller.me(jwt);

            assertEquals(level, result.traderLevel());
        }
    }

    @Test
    void meHandlesNullMiddleName() {
        User user = createTestUser(USER_ID);
        user.setMiddleName(null);
        UserAccount account = createTestAccount("test@example.com", "TRADER");
        
        when(jwt.getSubject()).thenReturn(USER_ID.toString());
        when(userService.getOwnAccount(USER_ID)).thenReturn(user);
        when(userService.getUserAccount(USER_ID)).thenReturn(account);

        UserProfileResponse result = controller.me(jwt);

        assertNull(result.middleName());
    }

    @Test
    void meWithEmptyEmail() {
        User user = createTestUser(USER_ID);
        UserAccount account = createTestAccount("", "TRADER");
        
        when(jwt.getSubject()).thenReturn(USER_ID.toString());
        when(userService.getOwnAccount(USER_ID)).thenReturn(user);
        when(userService.getUserAccount(USER_ID)).thenReturn(account);

        UserProfileResponse result = controller.me(jwt);

        assertNotNull(result);
    }

    private User createTestUser(UUID userId) {
        User user = new User();
        user.setUserId(userId);
        user.setFirstName("Test");
        user.setLastName("User");
        user.setSsn("123-45-6789");
        user.setAddress("123 Main St");
        user.setDateOfBirth(LocalDate.of(1990, 1, 1));
        user.setTraderLevel("INTERMEDIATE");
        user.setAvailableFunds(new BigDecimal("10000.00"));
        return user;
    }

    private UserAccount createTestAccount(String email, String userRole) {
        return new UserAccount(USER_ID, email, userRole);
    }
}
