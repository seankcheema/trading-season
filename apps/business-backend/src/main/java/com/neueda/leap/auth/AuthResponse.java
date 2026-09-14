package com.neueda.leap.auth;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Response returned after a successful login, identifying the new session.
 *
 * @param sessionId the id of the newly issued session
 * @param expiresAt when the session expires
 */
public record AuthResponse(
        UUID sessionId,
        OffsetDateTime expiresAt
) {
}
