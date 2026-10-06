package app.user;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

@Tag("unit")
class UserProfileResponseTest {

    private static final UUID USER_ID = UUID.fromString("7c9e6679-7425-40de-944b-e07fc1f90ae7");

    @Test
    void fromMapsProfileAndCredentialFieldsWhenTermsAccepted() {
        OffsetDateTime acceptedAt = OffsetDateTime.parse("2026-10-05T20:00:00Z");
        OffsetDateTime createdAt = OffsetDateTime.parse("2026-01-01T00:00:00Z");
        User user = createUser();
        user.setTermsAcceptedAt(acceptedAt);
        user.setCreatedAt(createdAt);
        UserAccount account = new UserAccount(USER_ID, "test@example.com", "ADMIN");

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
        assertEquals("ADMIN", response.userRole());
        assertTrue(response.termsAccepted());
        assertEquals(acceptedAt, response.termsAcceptedAt());
        assertEquals(createdAt, response.createdAt());
    }

    @Test
    void fromMarksTermsUnacceptedWhenNoTimestampExists() {
        User user = createUser();
        UserAccount account = new UserAccount(USER_ID, "test@example.com", "TRADER");

        UserProfileResponse response = UserProfileResponse.from(user, account);

        assertFalse(response.termsAccepted());
        assertNull(response.termsAcceptedAt());
        assertEquals("TRADER", response.userRole());
    }

    private User createUser() {
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
        return user;
    }
}
