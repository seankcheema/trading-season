package app.cash;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

/**
 * Repository for accessing {@link CashTransaction} entities.
 */
public interface CashTransactionRepository extends JpaRepository<CashTransaction, Integer> {

    /**
     * Lists the funding history of every account the given user owns, newest
     * first. Order fills are left out: they are trades rather than funding, and
     * the dashboard lists them from order history instead.
     *
     * <p>The account subquery is what scopes the result to one user, so a caller
     * can never read another user's ledger.
     *
     * @param userId   the owner's UUID, taken from the token's sub claim
     * @param pageable the page to read, used to apply the caller's limit
     * @return the user's deposits and withdrawals, newest first
     */
    @Query("""
            select c from CashTransaction c
            where c.accountId in (select a.id from Account a where a.userId = :userId)
              and c.reason in ('DEPOSIT', 'WITHDRAWAL')
            order by c.createdAt desc, c.cashTransactionId desc
            """)
    List<CashTransaction> findFundingForUser(@Param("userId") UUID userId, Pageable pageable);
}
