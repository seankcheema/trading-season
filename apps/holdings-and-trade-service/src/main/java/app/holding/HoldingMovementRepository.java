package app.holding;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

/**
 * Repository for reading {@link HoldingMovement} entities.
 */
public interface HoldingMovementRepository extends JpaRepository<HoldingMovement, Integer> {

    /** Checks the existing ledger for successful purchases.
     * @param accountId account to check
     * @return whether any successful acquisition exists in its ledger */
    @Query("select (count(m) > 0) from HoldingMovement m where m.accountId = :accountId and m.quantityDelta > 0")
    boolean hasAcquisitions(@Param("accountId") Integer accountId);

    /** Reads the first successful investment from existing execution timestamps.
     * @param accountId account whose investment start to read
     * @return first acquisition time, or null when none is recorded */
    @Query("select min(f.filledAt) from HoldingMovement m join Fill f on f.fillId = m.fillId where m.accountId = :accountId and m.quantityDelta > 0")
    java.time.Instant firstAcquisitionAt(@Param("accountId") Integer accountId);

    /** Lists accounts eligible for valuation capture.
     * @return accounts with acquisition history, including liquidated accounts */
    @Query("select distinct m.accountId from HoldingMovement m where m.quantityDelta > 0")
    List<Integer> acquiredAccountIds();

    /**
     * An account's whole movement ledger with the price each movement executed at.
     *
     * <p>Buys and sells are both returned, in the order they were recorded, because
     * the cost of an open position depends on when earlier positions were closed;
     * see {@link CostBasis}.
     *
     * @param accountId the account whose ledger to read
     * @return every movement of the account, oldest first
     */
    @Query("""
            select new app.holding.PricedMovement(m.instrumentId, m.quantityDelta, f.quotePrice)
            from HoldingMovement m
            join Fill f on f.fillId = m.fillId
            where m.accountId = :accountId
            order by m.holdingMovementId
            """)
    List<PricedMovement> pricedMovements(@Param("accountId") Integer accountId);
}
