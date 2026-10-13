package app.user;

import jakarta.validation.constraints.NotBlank;

/**
 * A client's statement that they accept the platform terms.
 *
 * <p>The client names the version it displayed so the acceptance is recorded
 * against the wording the user actually read.
 *
 * @param termsVersion the version of the terms shown to the user
 */
public record AcceptTermsRequest(@NotBlank String termsVersion) {
}
