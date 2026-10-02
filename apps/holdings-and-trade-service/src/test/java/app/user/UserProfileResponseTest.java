package app.user;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

@Tag("unit")
class UserProfileResponseTest {

    private static final UUID USER_ID = UUID.fromString("7c9e6679-7425-40de-944b-e07fc1f90ae7");

    @Test
    void userProfileResponseFromEntity() {
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
        
        UserAccount account = new UserAccount(USER_ID, "test@example.com", "TRADER");

        UserProfileResponse response = UserProfileResponse.from(user, account);

        assertEquals(USER_ID, response.userId());
        assertEquals("test@example.com", response.email());
        assertEquals("John", response.firstName());
        assertEquals("Q", response.middleName());
        assertEquals("Doe", response.lastName());
        assertEquals("123 Main St", response.address());
        assertEquals(LocalDate.of(1990, 1, 1), response.dateOfBirth());
        assertEquals("ADVANCED", response.traderLevel());
        assertEquals(new BigDecimal("50000.00"), response.availableFunds());
        assertEquals("TRADER", response.userRole());
    }

    @Test
    void userProfileResponseIncludesAllUserFields() {
        User user = new User();
        user.setUserId(USER_ID);
        user.setFirstName("John");
        user.setMiddleName("Q");
        user.setLastName("Doe");
        user.setSsn("999-99-9999");
        user.setAddress("123 Main St");
        user.setDateOfBirth(LocalDate.of(1990, 1, 1));
        user.setTraderLevel("ADVANCED");
        user.setAvailableFunds(new BigDecimal("50000.00"));
        
        UserAccount account = new UserAccount(USER_ID, "test@example.com", "TRADER");

        UserProfileResponse response = UserProfileResponse.from(user, account);

        assertNotNull(response);
        assertEquals(USER_ID, response.userId());
        assertEquals("test@example.com", response.email());
    }

    @Test
    void userProfileResponsePreservesAllUserFields() {
        User user = new User();
        user.setUserId(USER_ID);
        user.setFirstName("Alice");
        user.setMiddleName("Marie");
        user.setLastName("Smith");
        user.setSsn("SHOULD_NOT_APPEAR");
        user.setAddress("456 Oak Ave");
        user.setDateOfBirth(LocalDate.of(1985, 5, 15));
        user.setTraderLevel("INTERMEDIATE");
        user.setAvailableFunds(new BigDecimal("25000.75"));
        
        UserAccount account = new UserAccount(USER_ID, "alice@example.com", "TRADER");

        UserProfileResponse response = UserProfileResponse.from(user, account);

        assertNotNull(response);
        assertEquals("alice@example.com", response.email());
        assertEquals("Alice", response.firstName());
        assertEquals("Marie", response.middleName());
        assertEquals("Smith", response.lastName());
        assertEquals("456 Oak Ave", response.address());
        assertEquals(LocalDate.of(1985, 5, 15), response.dateOfBirth());
        assertEquals("INTERMEDIATE", response.traderLevel());
        assertEquals(new BigDecimal("25000.75"), response.availableFunds());
        assertEquals("TRADER", response.userRole());
    }

    @Test
    void userProfileResponseWithZeroFunds() {
        User user = new User();
        user.setUserId(USER_ID);
        user.setFirstName("Test");
        user.setMiddleName("");
        user.setLastName("User");
        user.setSsn("123-45-6789");
        user.setAddress("123 Main St");
        user.setDateOfBirth(LocalDate.now());
        user.setTraderLevel("BEGINNER");
        user.setAvailableFunds(BigDecimal.ZERO);
        
        UserAccount account = new UserAccount(USER_ID, "test@example.com", "TRADER");

        UserProfileResponse response = UserProfileResponse.from(user, account);

        assertEquals(BigDecimal.ZERO, response.availableFunds());
    }

    @Test
    void userProfileResponseWithLargeFunds() {
        User user = new User();
        user.setUserId(USER_ID);
        user.setFirstName("Rich");
        user.setMiddleName("");
        user.setLastName("Trader");
        user.setSsn("123-45-6789");
        user.setAddress("123 Main St");
        user.setDateOfBirth(LocalDate.now());
        user.setTraderLevel("ADVANCED");
        user.setAvailableFunds(new BigDecimal("999999999.99"));
        
        UserAccount account = new UserAccount(USER_ID, "test@example.com", "TRADER");

        UserProfileResponse response = UserProfileResponse.from(user, account);

        assertEquals(new BigDecimal("999999999.99"), response.availableFunds());
    }

    @Test
    void userProfileResponseWithEmptyMiddleName() {
        User user = new User();
        user.setUserId(USER_ID);
        user.setFirstName("John");
        user.setMiddleName("");
        user.setLastName("Doe");
        user.setSsn("123-45-6789");
        user.setAddress("123 Main St");
        user.setDateOfBirth(LocalDate.of(1990, 1, 1));
        user.setTraderLevel("ADVANCED");
        user.setAvailableFunds(new BigDecimal("50000.00"));
        
        UserAccount account = new UserAccount(USER_ID, "test@example.com", "TRADER");

        UserProfileResponse response = UserProfileResponse.from(user, account);

        assertEquals("", response.middleName());
    }

    @Test
    void userProfileResponseWithDifferentTraderLevels() {
        String[] levels = {"BEGINNER", "INTERMEDIATE", "ADVANCED", "PROFESSIONAL"};
        
        for (String level : levels) {
            User user = new User();
            user.setUserId(USER_ID);
            user.setFirstName("Test");
            user.setMiddleName("");
            user.setLastName("User");
            user.setSsn("123-45-6789");
            user.setAddress("123 Main St");
            user.setDateOfBirth(LocalDate.now());
            user.setTraderLevel(level);
            user.setAvailableFunds(new BigDecimal("10000.00"));
            
            UserAccount account = new UserAccount(USER_ID, "test@example.com", "TRADER");

            UserProfileResponse response = UserProfileResponse.from(user, account);

            assertEquals(level, response.traderLevel());
        }
    }

    @Test
    void userProfileResponseMultipleUsers() {
        UUID userId1 = UUID.randomUUID();
        UUID userId2 = UUID.randomUUID();

        User user1 = new User();
        user1.setUserId(userId1);
        user1.setFirstName("User");
        user1.setMiddleName("One");
        user1.setLastName("Test");
        user1.setSsn("123-45-6789");
        user1.setAddress("123 Main St");
        user1.setDateOfBirth(LocalDate.of(1990, 1, 1));
        user1.setTraderLevel("ADVANCED");
        user1.setAvailableFunds(new BigDecimal("50000.00"));
        
        UserAccount account1 = new UserAccount(userId1, "user1@example.com", "TRADER");

        User user2 = new User();
        user2.setUserId(userId2);
        user2.setFirstName("User");
        user2.setMiddleName("Two");
        user2.setLastName("Test");
        user2.setSsn("987-65-4321");
        user2.setAddress("456 Oak Ave");
        user2.setDateOfBirth(LocalDate.of(1985, 5, 15));
        user2.setTraderLevel("INTERMEDIATE");
        user2.setAvailableFunds(new BigDecimal("25000.00"));
        
        UserAccount account2 = new UserAccount(userId2, "user2@example.com", "TRADER");

        UserProfileResponse response1 = UserProfileResponse.from(user1, account1);
        UserProfileResponse response2 = UserProfileResponse.from(user2, account2);

        assertEquals(userId1, response1.userId());
        assertEquals(userId2, response2.userId());
        assertEquals("user1@example.com", response1.email());
        assertEquals("user2@example.com", response2.email());
        assertEquals("One", response1.middleName());
        assertEquals("Two", response2.middleName());
    }

    @Test
    void userProfileResponseWithNullMiddleName() {
        User user = new User();
        user.setUserId(USER_ID);
        user.setFirstName("John");
        user.setMiddleName(null);
        user.setLastName("Doe");
        user.setSsn("123-45-6789");
        user.setAddress("123 Main St");
        user.setDateOfBirth(LocalDate.of(1990, 1, 1));
        user.setTraderLevel("ADVANCED");
        user.setAvailableFunds(new BigDecimal("50000.00"));
        
        UserAccount account = new UserAccount(USER_ID, "test@example.com", "TRADER");

        UserProfileResponse response = UserProfileResponse.from(user, account);

        assertNull(response.middleName());
    }


    @Test
    void userProfileResponseWithAdminRole() {
        User user = new User();
        user.setUserId(USER_ID);
        user.setFirstName("Admin");
        user.setMiddleName("");
        user.setLastName("User");
        user.setSsn("123-45-6789");
        user.setAddress("123 Main St");
        user.setDateOfBirth(LocalDate.now());
        user.setTraderLevel("PROFESSIONAL");
        user.setAvailableFunds(new BigDecimal("100000.00"));
        
        UserAccount account = new UserAccount(USER_ID, "test@example.com", "ADMIN");

        UserProfileResponse response = UserProfileResponse.from(user, account);

        assertEquals("ADMIN", response.userRole());
    }

    @Test
    void userAccountGetUserId() {
        UserAccount account = new UserAccount(USER_ID, "test@example.com", "TRADER");
        
        assertEquals(USER_ID, account.getUserId());
    }

    @Test
    void userAccountGetUserIdWithDifferentIds() {
        UUID id1 = UUID.randomUUID();
        UUID id2 = UUID.randomUUID();
        
        UserAccount account1 = new UserAccount(id1, "user1@example.com", "TRADER");
        UserAccount account2 = new UserAccount(id2, "user2@example.com", "ADMIN");
        
        assertEquals(id1, account1.getUserId());
        assertEquals(id2, account2.getUserId());
    }




}
