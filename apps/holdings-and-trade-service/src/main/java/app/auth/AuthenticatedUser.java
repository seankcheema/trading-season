package app.auth;

import org.springframework.security.oauth2.jwt.Jwt;

import java.util.UUID;

/**
 * The caller identified by a verified access token.
 *
 * <p>The user id is the token's {@code sub} claim, which the auth service sets to
 * the account's UUID. The business {@code users} row for this caller uses the
 * same UUID as its primary key, so it is the value every ownership check compares.
 *
 * @param userId the user's UUID from the {@code sub} claim
 * @param email  the account email from the {@code email} claim, or {@code null} if absent
 */
public record AuthenticatedUser(UUID userId, String email) {

    /**
     * Reads the caller from a token that has already passed signature and claim validation.
     *
     * @param jwt the verified token
     * @return the caller
     * @throws IllegalArgumentException if {@code sub} is not a UUID; the decoder
     *                                  rejects such tokens before this is reached
     */
    public static AuthenticatedUser from(Jwt jwt) {
        return new AuthenticatedUser(UUID.fromString(jwt.getSubject()), jwt.getClaimAsString("email"));
    }

    /**
     * Checks whether a claim value is a UUID in canonical string form.
     *
     * @param value the claim value, possibly {@code null}
     * @return {@code true} if the value parses as a UUID
     */
    static boolean isUuid(String value) {
        if (value == null) {
            return false;
        }
        try {
            return UUID.fromString(value).toString().equalsIgnoreCase(value);
        } catch (IllegalArgumentException ex) {
            return false;
        }
    }
}
