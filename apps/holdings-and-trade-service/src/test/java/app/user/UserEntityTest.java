package app.user;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

@Tag("unit")
class UserEntityTest {

    private static final UUID USER_ID = UUID.fromString("7c9e6679-7425-40de-944b-e07fc1f90ae7");

    @Test
    void userEntitySessionTimeoutMinutesGetterAndSetter() {
        User user = new User();
        user.setUserId(USER_ID);
        user.setFirstName("Test");
        user.setLastName("User");
        
        user.setSessionTimeoutMinutes(30);
        
        assertEquals(30, user.getSessionTimeoutMinutes());
    }

    @Test
    void userEntitySessionTimeoutMinutesDefaultValue() {
        User user = new User();
        user.setUserId(USER_ID);
        user.setFirstName("Test");
        user.setLastName("User");
        
        assertEquals(10, user.getSessionTimeoutMinutes());
    }

    @Test
    void userEntitySessionTimeoutMinutesMultipleUpdates() {
        User user = new User();
        user.setUserId(USER_ID);
        user.setFirstName("Test");
        user.setLastName("User");
        
        user.setSessionTimeoutMinutes(15);
        assertEquals(15, user.getSessionTimeoutMinutes());
        
        user.setSessionTimeoutMinutes(45);
        assertEquals(45, user.getSessionTimeoutMinutes());
    }

    @Test
    void userEntityExecutionBufferPercentGetterAndSetter() {
        User user = new User();
        user.setUserId(USER_ID);
        user.setFirstName("Test");
        user.setLastName("User");
        
        BigDecimal bufferPercent = new BigDecimal("5.50");
        user.setExecutionBufferPercent(bufferPercent);
        
        assertEquals(bufferPercent, user.getExecutionBufferPercent());
    }

    @Test
    void userEntityExecutionBufferPercentDefaultValue() {
        User user = new User();
        user.setUserId(USER_ID);
        user.setFirstName("Test");
        user.setLastName("User");
        
        assertEquals(BigDecimal.ONE, user.getExecutionBufferPercent());
    }

    @Test
    void userEntityExecutionBufferPercentMultipleUpdates() {
        User user = new User();
        user.setUserId(USER_ID);
        user.setFirstName("Test");
        user.setLastName("User");
        
        user.setExecutionBufferPercent(new BigDecimal("2.50"));
        assertEquals(new BigDecimal("2.50"), user.getExecutionBufferPercent());
        
        user.setExecutionBufferPercent(new BigDecimal("10.00"));
        assertEquals(new BigDecimal("10.00"), user.getExecutionBufferPercent());
    }

    @Test
    void userEntityLastActivityAtGetterAndSetter() {
        User user = new User();
        user.setUserId(USER_ID);
        user.setFirstName("Test");
        user.setLastName("User");
        
        OffsetDateTime now = OffsetDateTime.now();
        user.setLastActivityAt(now);
        
        assertEquals(now, user.getLastActivityAt());
    }

    @Test
    void userEntityLastActivityAtDefaultNull() {
        User user = new User();
        user.setUserId(USER_ID);
        user.setFirstName("Test");
        user.setLastName("User");
        
        assertNull(user.getLastActivityAt());
    }

    @Test
    void userEntityLastActivityAtCanBeSetToNull() {
        User user = new User();
        user.setUserId(USER_ID);
        user.setFirstName("Test");
        user.setLastName("User");
        
        OffsetDateTime now = OffsetDateTime.now();
        user.setLastActivityAt(now);
        assertEquals(now, user.getLastActivityAt());
        
        user.setLastActivityAt(null);
        assertNull(user.getLastActivityAt());
    }

    @Test
    void userEntityAllSessionFieldsTogether() {
        User user = new User();
        user.setUserId(USER_ID);
        user.setFirstName("John");
        user.setLastName("Doe");
        
        user.setSessionTimeoutMinutes(60);
        user.setExecutionBufferPercent(new BigDecimal("3.25"));
        OffsetDateTime lastActivity = OffsetDateTime.now();
        user.setLastActivityAt(lastActivity);
        
        assertEquals(60, user.getSessionTimeoutMinutes());
        assertEquals(new BigDecimal("3.25"), user.getExecutionBufferPercent());
        assertEquals(lastActivity, user.getLastActivityAt());
    }

    @Test
    void userEntitySessionTimeoutMinutesPreservedAcrossOtherSetters() {
        User user = new User();
        user.setUserId(USER_ID);
        user.setFirstName("Test");
        user.setLastName("User");
        user.setSessionTimeoutMinutes(25);
        
        user.setAddress("123 Main St");
        user.setTraderLevel("ADVANCED");
        
        assertEquals(25, user.getSessionTimeoutMinutes());
    }

    @Test
    void userEntityExecutionBufferPercentPreservedAcrossOtherSetters() {
        User user = new User();
        user.setUserId(USER_ID);
        user.setFirstName("Test");
        user.setLastName("User");
        BigDecimal buffer = new BigDecimal("4.50");
        user.setExecutionBufferPercent(buffer);
        
        user.setAvailableFunds(new BigDecimal("50000.00"));
        user.setDateOfBirth(LocalDate.of(1990, 1, 1));
        
        assertEquals(buffer, user.getExecutionBufferPercent());
    }

    @Test
    void userEntityLastActivityAtPreservedAcrossOtherSetters() {
        User user = new User();
        user.setUserId(USER_ID);
        user.setFirstName("Test");
        user.setLastName("User");
        OffsetDateTime lastActivity = OffsetDateTime.now();
        user.setLastActivityAt(lastActivity);
        
        user.setMiddleName("Q");
        user.setSsn("123-45-6789");
        
        assertEquals(lastActivity, user.getLastActivityAt());
    }
}
