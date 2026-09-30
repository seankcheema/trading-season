package app.holding;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

/**
 * Repository for reading {@link HoldingMovement} entities.
 */
public interface HoldingMovementRepository extends JpaRepository<HoldingMovement, Integer> {

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
