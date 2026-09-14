package com.neueda.leap.auth;

import jakarta.validation.constraints.NotBlank;

/**
 * Credentials submitted when logging in.
 *
 * @param username the account username
 * @param password the account password
 */
public record LoginRequest(
        @NotBlank String username,
        @NotBlank String password
) {
}
