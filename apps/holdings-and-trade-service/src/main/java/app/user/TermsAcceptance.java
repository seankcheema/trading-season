package app.user;

import jakarta.persistence.Entity;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import org.hibernate.annotations.Immutable;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * A client's acceptance of one version of the platform terms.
 *
 * <p>Each acceptance is its own row in {@code terms_acceptances}, keyed by the
 * client and the version, so a client has at most one acceptance per version
 * and a new version of the terms starts with none.
 *
 * <p>Marked {@link Immutable} because an acceptance is a record of something
 * that happened: it is inserted once and Hibernate discards any attempt to
 * update it.
 */
@Entity
@Immutable
@IdClass(TermsAcceptanceId.class)
@Table(name = "terms_acceptances")
public class TermsAcceptance extends TermsAcceptanceBase {

    /**
     * Required by Hibernate.
     */
    protected TermsAcceptance() {
    }

    /**
     * Creates an acceptance.
     *
     * @param userId       the client's user id
     * @param termsVersion the version of the terms the client accepted
     * @param acceptedAt   when the client accepted
     */
    public TermsAcceptance(UUID userId, String termsVersion, OffsetDateTime acceptedAt) {
        super(userId, termsVersion, acceptedAt);
    }
}
