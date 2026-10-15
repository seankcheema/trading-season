package app.user;

import jakarta.persistence.Column;
import jakarta.persistence.Id;
import jakarta.persistence.MappedSuperclass;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * The columns of the {@code terms_acceptances} table, keyed by the client and
 * the version of the platform terms they accepted. Each service's
 * {@code TermsAcceptance} entity extends this class.
 */
@MappedSuperclass
public abstract class TermsAcceptanceBase {

    @Id
    @Column(name = "user_id", updatable = false, nullable = false)
    private UUID userId;

    @Id
    @Column(name = "terms_version", updatable = false, nullable = false)
    private String termsVersion;

    @Column(name = "accepted_at", updatable = false, nullable = false)
    private OffsetDateTime acceptedAt;

    /** Creates an instance for a service's entity to extend. */
    protected TermsAcceptanceBase() {
    }

    /**
     * Creates an acceptance.
     *
     * @param userId       the client's user id
     * @param termsVersion the version of the terms the client accepted
     * @param acceptedAt   when the client accepted
     */
    protected TermsAcceptanceBase(UUID userId, String termsVersion, OffsetDateTime acceptedAt) {
        this.userId = userId;
        this.termsVersion = termsVersion;
        this.acceptedAt = acceptedAt;
    }

    /**
     * Returns the client's user id.
     *
     * @return the user id
     */
    public UUID getUserId() {
        return userId;
    }

    /**
     * Returns the version of the terms the client accepted.
     *
     * @return the terms version
     */
    public String getTermsVersion() {
        return termsVersion;
    }

    /**
     * Returns when the client accepted.
     *
     * @return the acceptance time
     */
    public OffsetDateTime getAcceptedAt() {
        return acceptedAt;
    }
}
