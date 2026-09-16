package com.neueda.leap.auth;

/**
 * Result of the soft account existence check.
 *
 * @param exists whether a business account is registered with the email, ignoring case
 */
public record AccountExistsResponse(
        boolean exists
) {
}
