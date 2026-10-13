package app.user;

import java.io.Serializable;
import java.util.UUID;

/**
 * Identifies one acceptance: a client and the version of the platform terms
 * they accepted.
 *
 * @param userId       the client's user id
 * @param termsVersion the version of the terms, such as {@code 2026-10-12}
 */
public record TermsAcceptanceId(UUID userId, String termsVersion) implements Serializable {
}
