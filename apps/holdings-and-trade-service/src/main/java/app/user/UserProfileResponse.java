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
     * Maps a profile and its credential record to a response, leaving out
     * sensitive fields.
     *
     * <p>Email, role and status come from {@code account} rather than
     * {@code user}. The auth service owns those three, and the copies still
     * sitting on the profile row are only as fresh as the last registration -
     * reporting a stale ACTIVE to a deactivated trader is exactly the sort of
     * answer this endpoint should not give.
     *
     * @param user    the profile row
     * @param account the credential record the auth service owns
     * @return the profile response
     */
    public static UserProfileResponse from(User user, UserAccount account) {
        return new UserProfileResponse(user.getUserId(), account.getEmail(),
                user.getFirstName(), user.getMiddleName(), user.getLastName(), user.getAddress(),
                user.getDateOfBirth(), user.getTraderLevel(), user.getAvailableFunds(),
                account.getUserRole(), account.getAccountStatus(), user.getCreatedAt());
    }
}
