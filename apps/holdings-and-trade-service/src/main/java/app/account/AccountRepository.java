package app.account;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Repository interface for accessing Account entities.
 * AccountRepository
 */

public interface AccountRepository extends JpaRepository<Account, Integer> {
    /**
     * Loads an account with a row lock held until the enclosing transaction completes.
     * commits. Use this, not the standard findById method, which does not lock the row.
     * The caller is about to check the cash balance or perform an update, so a row lock is necessary to prevent concurrent modifications.
     * @param accountId the ID of the account to load
     * @return an Optional containing the account if found, or empty if not found
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT a FROM Account a WHERE a.id = :accountId")
    Optional<Account> findByIdForUpdate(Integer accountId);

    /**
     * Finds all accounts belonging to a user, ordered by opened date descending.
     *
     * @param userId the owner's UUID
     * @return a list of accounts owned by this user
     */
    List<Account> findByUserIdOrderByOpenedDateDesc(UUID userId);

    /**
     * Finds a specific account if it belongs to the given user.
     *
     * @param accountId the account ID
     * @param userId    the owner's UUID
     * @return the account if it exists and belongs to this user, empty otherwise
     */
    Optional<Account> findByIdAndUserId(Integer accountId, UUID userId);

    /**
     * Finds the user's first account: the default one opened at sign-up unless it
     * has since been closed. Cash belongs to the user and every account shares
     * it, so this is the account a deposit or withdrawal is booked against.
     *
     * @param userId the owner's UUID
     * @return the user's earliest account, or empty if they have none
     */
    Optional<Account> findFirstByUserIdOrderByOpenedDateAscIdAsc(UUID userId);
}


