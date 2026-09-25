package app.user;

import org.springframework.data.repository.Repository;

import java.util.Optional;
import java.util.UUID;

/**
 * Read-only access to the credential records the auth service owns.
 *
 * <p>Extends {@link Repository} rather than {@code JpaRepository} on purpose:
 * that exposes only the methods declared below, so this service has no
 * {@code save} or {@code delete} for {@code user_accounts} at all. Combined with
 * {@link UserAccount} being immutable, writing to the auth service's table is
 * not something a future change can do without noticing.
 */
public interface UserAccountRepository extends Repository<UserAccount, UUID> {

    /**
     * Looks up a credential record by the id from a verified token.
     *
     * @param userId the user UUID, from the token's sub claim
     * @return the record, or empty if the account does not exist
     */
    Optional<UserAccount> findById(UUID userId);
}
