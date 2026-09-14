package com.neueda.leap.auth;

import java.util.UUID;

/**
 * Public profile returned after successful registration.
 *
 * @param userId   the new user's id
 * @param username the registered username
 * @param email    the registered email
 */
public record RegisterResponse(
        UUID userId,
        String username,
        String email
) {
}
