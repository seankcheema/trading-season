package app.user;

import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Repository interface for accessing TermsAcceptance entities.
 */
public interface TermsAcceptanceRepository extends JpaRepository<TermsAcceptance, TermsAcceptanceId> {
}
