package app.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Email submitted to check whether a business account already exists. Sent in the
 * body rather than the query string so the address stays out of access logs.
 *
 * @param email the email address to look up
 */
public record AccountExistsRequest(
        @NotBlank @Email @Size(max = 100) String email
) {
}
