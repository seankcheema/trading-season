package app.user;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * The caller's own business account. The SSN is never returned.
 *
 * @param userId         the account id, equal to the token's sub claim
 * @param email          the account email
 * @param firstName      first name
 * @param middleName     middle name, or {@code null}
 * @param lastName       last name
 * @param address        mailing address
 * @param dateOfBirth    date of birth
 * @param traderLevel    BEGINNER, INTERMEDIATE or ADVANCED
 * @param availableFunds cash available for trading
 * @param userRole       ADMIN or TRADER
 * @param accountStatus  ACTIVE or DEACTIVATED
 * @param createdAt      when the account was registered
 */
public record UserProfileResponse(
        UUID userId,
        String email,
        String firstName,
        String middleName,
        String lastName,
        String address,
        LocalDate dateOfBirth,
        String traderLevel,
        BigDecimal availableFunds,
        String userRole,
        String accountStatus,
        OffsetDateTime createdAt
) {

    /**
     * Maps an account to its response, leaving out sensitive fields.
     *
     * @param user the account
     * @return the profile response
     */
    public static UserProfileResponse from(User user) {
        return new UserProfileResponse(user.getUserId(), user.getEmail(),
                user.getFirstName(), user.getMiddleName(), user.getLastName(), user.getAddress(),
                user.getDateOfBirth(), user.getTraderLevel(), user.getAvailableFunds(),
                user.getUserRole(), user.getAccountStatus(), user.getCreatedAt());
    }
}
