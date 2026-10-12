package app.registration;

import java.util.UUID;

/**
 * Public profile returned after successful registration.
 *
 * @param userId the new account's id, equal to the auth service user id in the token's sub claim
 * @param email  the registered email
 */
public record RegistrationResponse(
        UUID userId,
        String email
) {
}


