package app.user;

import org.springframework.data.repository.Repository;

/**
 * Read-only access to the terms acceptances Holdings and Trade Service records.
 *
 * <p>Extends {@link Repository} rather than {@code JpaRepository} on purpose:
 * that exposes only the method declared below, so this service has no
 * {@code save} or {@code delete} for {@code terms_acceptances} at all.
 */
public interface TermsAcceptanceRepository extends Repository<TermsAcceptance, TermsAcceptanceId> {

    /**
     * Whether the client has accepted the given version of the terms.
     *
     * @param id the client and the version
     * @return {@code true} if that acceptance is on record
     */
    boolean existsById(TermsAcceptanceId id);
}
