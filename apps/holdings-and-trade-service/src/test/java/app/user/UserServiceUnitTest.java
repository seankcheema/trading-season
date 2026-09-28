package app.user;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@Tag("unit")
class UserServiceUnitTest {

    private static final UUID USER_ID = UUID.fromString("7c9e6679-7425-40de-944b-e07fc1f90ae7");

    @Mock
    private UserRepository userRepository;

    private UserService userService;

    @BeforeEach
    void setUp() {
        userService = new UserService(userRepository);
    }

    @Test
    void getOwnAccountReturnsUserWhenFound() {
        User user = createTestUser(USER_ID);
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user));

        User result = userService.getOwnAccount(USER_ID);

        assertEquals(user, result);
        assertEquals(USER_ID, result.getUserId());
        assertEquals("test@example.com", result.getEmail());
        verify(userRepository).findById(USER_ID);
    }

    @Test
    void getOwnAccountThrowsUserNotFoundWhenNotFound() {
        when(userRepository.findById(USER_ID)).thenReturn(Optional.empty());

        assertThrows(UserNotFoundException.class, 
                () -> userService.getOwnAccount(USER_ID));
        verify(userRepository).findById(USER_ID);
    }

    @Test
    void getOwnAccountCallsRepositoryWithCorrectUserId() {
        UUID differentId = UUID.randomUUID();
        User user = createTestUser(differentId);
        when(userRepository.findById(differentId)).thenReturn(Optional.of(user));

        userService.getOwnAccount(differentId);

        verify(userRepository).findById(differentId);
    }

    @Test
    void getOwnAccountPreservesAllUserFields() {
        User user = new User();
        user.setUserId(USER_ID);
        user.setEmail("john.doe@example.com");
        user.setFirstName("John");
        user.setMiddleName("Q");
        user.setLastName("Doe");
        user.setSsn("123-45-6789");
        user.setAddress("123 Main St");
        user.setDateOfBirth(LocalDate.of(1990, 1, 1));
        user.setTraderLevel("ADVANCED");
        user.setAvailableFunds(new BigDecimal("50000.00"));
        user.setCreatedAt(OffsetDateTime.now());

        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user));

        User result = userService.getOwnAccount(USER_ID);

        assertEquals("John", result.getFirstName());
        assertEquals("Q", result.getMiddleName());
        assertEquals("Doe", result.getLastName());
        assertEquals("123-45-6789", result.getSsn());
        assertEquals("123 Main St", result.getAddress());
        assertEquals(LocalDate.of(1990, 1, 1), result.getDateOfBirth());
        assertEquals("ADVANCED", result.getTraderLevel());
        assertEquals(new BigDecimal("50000.00"), result.getAvailableFunds());
    }

    @Test
    void getOwnAccountWithDifferentUsers() {
        UUID userId1 = UUID.randomUUID();
        UUID userId2 = UUID.randomUUID();
        User user1 = createTestUser(userId1);
        User user2 = createTestUser(userId2);

        when(userRepository.findById(userId1)).thenReturn(Optional.of(user1));
        when(userRepository.findById(userId2)).thenReturn(Optional.of(user2));

        User result1 = userService.getOwnAccount(userId1);
        User result2 = userService.getOwnAccount(userId2);

        assertEquals(userId1, result1.getUserId());
        assertEquals(userId2, result2.getUserId());
        assertNotEquals(result1, result2);
    }

    @Test
    void getOwnAccountUserNotFoundMessageIsCorrect() {
        when(userRepository.findById(USER_ID)).thenReturn(Optional.empty());

        UserNotFoundException exception = assertThrows(UserNotFoundException.class, 
                () -> userService.getOwnAccount(USER_ID));
        
        assertEquals("Account is not registered", exception.getMessage());
    }

    @Test
    void getOwnAccountCallsRepositoryOnlyOnce() {
        User user = createTestUser(USER_ID);
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user));

        userService.getOwnAccount(USER_ID);

        verify(userRepository).findById(USER_ID);
    }

    @Test
    void getOwnAccountHandlesNullEmail() {
        User user = new User();
        user.setUserId(USER_ID);
        user.setEmail(null);
        user.setFirstName("Test");
        user.setLastName("User");
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user));

        User result = userService.getOwnAccount(USER_ID);

        assertNull(result.getEmail());
    }

    @Test
    void getOwnAccountHandlesEmptyStrings() {
        User user = new User();
        user.setUserId(USER_ID);
        user.setEmail("");
        user.setFirstName("");
        user.setMiddleName("");
        user.setLastName("");
        user.setAddress("");
        user.setSsn("");
        user.setTraderLevel("");
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user));

        User result = userService.getOwnAccount(USER_ID);

        assertEquals("", result.getEmail());
        assertEquals("", result.getFirstName());
    }

    @Test
    void getOwnAccountWithAllFieldsPopulated() {
        User user = new User();
        user.setUserId(USER_ID);
        user.setEmail("complete@example.com");
        user.setFirstName("First");
        user.setMiddleName("Middle");
        user.setLastName("Last");
        user.setSsn("123-45-6789");
        user.setAddress("789 Oak Avenue");
        user.setDateOfBirth(LocalDate.of(1980, 3, 15));
        user.setTraderLevel("PROFESSIONAL");
        user.setAvailableFunds(new BigDecimal("250000.00"));
        user.setUserRole("ADMIN");
        user.setAccountStatus("ACTIVE");

        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user));

        User result = userService.getOwnAccount(USER_ID);

        assertEquals(USER_ID, result.getUserId());
        assertEquals("complete@example.com", result.getEmail());
        assertEquals("First", result.getFirstName());
        assertEquals("Middle", result.getMiddleName());
        assertEquals("Last", result.getLastName());
        assertEquals("789 Oak Avenue", result.getAddress());
        assertEquals(LocalDate.of(1980, 3, 15), result.getDateOfBirth());
        assertEquals("PROFESSIONAL", result.getTraderLevel());
        assertEquals(new BigDecimal("250000.00"), result.getAvailableFunds());
        assertEquals("ADMIN", result.getUserRole());
        assertEquals("ACTIVE", result.getAccountStatus());
    }

    private User createTestUser(UUID userId) {
        User user = new User();
        user.setUserId(userId);
        user.setEmail("test@example.com");
        user.setFirstName("Test");
        user.setLastName("User");
        user.setSsn("123-45-6789");
        user.setAddress("123 Main St");
        user.setDateOfBirth(LocalDate.of(1990, 1, 1));
        user.setTraderLevel("INTERMEDIATE");
        user.setAvailableFunds(new BigDecimal("10000.00"));
        user.setUserRole("TRADER");
        user.setAccountStatus("ACTIVE");
        return user;
    }
}
