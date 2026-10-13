package app.user;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import org.hibernate.annotations.Immutable;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * A read-only view of a client's acceptance of one version of the platform
 * terms.
 *
 * <p>Holdings and Trade Service records acceptances in
 * {@code terms_acceptances} and is the only writer. This service reads them to
 * refuse an order from a client who has not accepted the terms in force.
 *
 * <p>Marked {@link Immutable}, and reached only through
 * {@link TermsAcceptanceRepository}, which has no method that writes, so this
 * service cannot record or alter an acceptance.
 */
@Entity
@Immutable
@IdClass(TermsAcceptanceId.class)
@Table(name = "terms_acceptances")
public class TermsAcceptance {

    /**
     * The version of the platform terms in force, named by its effective date.
     * It must equal {@code UserService.CURRENT_TERMS_VERSION} in Holdings and
     * Trade Service and {@code TERMS_VERSION} in the client; change all three
     * together whenever the wording of the terms changes.
     */
    public static final String CURRENT_VERSION = "2026-10-12";

    @Id
    @Column(name = "user_id", updatable = false, nullable = false)
    private UUID userId;

    @Id
    @Column(name = "terms_version", updatable = false, nullable = false)
    private String termsVersion;

    @Column(name = "accepted_at", updatable = false, nullable = false)
    private OffsetDateTime acceptedAt;

    /**
     * Required by Hibernate.
     */
    protected TermsAcceptance() {
    }
}
