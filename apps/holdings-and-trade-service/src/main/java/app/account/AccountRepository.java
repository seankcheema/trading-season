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
     * Counts every nonzero share position, including negative and fractional quantities.
     * @param accountId account to check
     * @return number of nonzero positions
     */
    @Query(value = "SELECT COUNT(*) FROM holdings WHERE account_id = :accountId AND quantity <> 0", nativeQuery = true)
    long countNonzeroHoldings(Integer accountId);

    /**
     * Counts orders that have not reached a terminal state; ACCEPTED also blocks archiving.
     * @param accountId account to check
     * @return number of unresolved orders
     */
    @Query(value = "SELECT COUNT(*) FROM orders WHERE account_id = :accountId AND status NOT IN ('FILLED', 'REJECTED', 'CANCELLED', 'EXPIRED')", nativeQuery = true)
    long countUnresolvedOrders(Integer accountId);

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
    /** Totals open BUY reservations across every account of a user.
     * @param userId verified owner
     * @return reserved cash */
    @Query("SELECT COALESCE(SUM(o.reservedCash), 0) FROM AccountOrderState o JOIN Account a ON a.id = o.accountId WHERE a.userId = :userId AND o.status = 'ACCEPTED'")
    java.math.BigDecimal reservedCash(UUID userId);
    /** Totals open SELL reservations for one position.
     * @param accountId owned account
     * @param instrumentId instrument
     * @return reserved shares */
    @Query("SELECT COALESCE(SUM(o.reservedShares), 0) FROM AccountOrderState o WHERE o.accountId = :accountId AND o.instrumentId = :instrumentId AND o.status = 'ACCEPTED'")
    java.math.BigDecimal reservedShares(Integer accountId, Integer instrumentId);
}


