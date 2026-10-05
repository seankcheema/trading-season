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
     * Average price paid per share for each instrument an account has acquired.
     *
     * <p>Weighted by quantity across every acquiring movement, so buying 1 share
     * at 100 and 3 at 200 reports 175 rather than 150. Only positive movements
     * count: a sell disposes of shares at the market price and does not change
     * what the remaining ones cost.
     *
     * <p>Returned as rows of {@code [instrumentId, averageCost]} rather than a
     * projection interface because the caller only indexes it by instrument.
     *
     * @param accountId the account whose positions to price
     * @return one row per acquired instrument; instruments never bought are absent
     */
    @Query("""
            select m.instrumentId, sum(f.quotePrice * m.quantityDelta) / sum(m.quantityDelta)
            from HoldingMovement m
            join Fill f on f.fillId = m.fillId
            where m.accountId = :accountId and m.quantityDelta > 0
            group by m.instrumentId
            """)
    List<Object[]> averageAcquisitionCostByInstrument(@Param("accountId") Integer accountId);
}
