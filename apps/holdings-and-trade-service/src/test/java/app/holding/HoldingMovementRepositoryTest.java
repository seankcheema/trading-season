package app.holding;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Checks the cost basis a position is reported with, which is derived from the
 * movement ledger and the fills it points at rather than stored anywhere.
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
@Tag("integration")
class HoldingMovementRepositoryTest {

    @Autowired
    private HoldingMovementRepository holdingMovementRepository;

    @Autowired
    private FillRepository fillRepository;

    @Autowired
    private HoldingRepository holdingRepository;

    @Test
    void averageCostIsWeightedByQuantityAcrossEveryAcquisition() {
        // 1 share at 100 and 3 at 200 averages 175, not 150.
        acquire(1, 100, new BigDecimal("100.00"), BigDecimal.ONE);
        acquire(1, 100, new BigDecimal("200.00"), new BigDecimal("3"));

        assertEquals(new BigDecimal("175.00"), costOf(1).get(100));
    }

    @Test
    void averageCostRestartsAfterAPositionIsSoldOut() {
        acquire(1, 100, new BigDecimal("100.00"), new BigDecimal("4"));
        move(1, 100, new BigDecimal("150.00"), new BigDecimal("-4"));
        acquire(1, 100, new BigDecimal("300.00"), new BigDecimal("2"));

        assertEquals(new BigDecimal("300.00"), costOf(1).get(100));
    }

    @Test
    void aPositionSoldOutHasNoCost() {
        acquire(1, 100, new BigDecimal("100.00"), new BigDecimal("4"));
        move(1, 100, new BigDecimal("150.00"), new BigDecimal("-4"));

        assertTrue(costOf(1).isEmpty());
    }

    @Test
    void averageCostIgnoresDisposals() {
        acquire(1, 100, new BigDecimal("100.00"), new BigDecimal("4"));
        // A sell at a different price disposes of shares; it does not change what the
        // remaining ones cost.
        move(1, 100, new BigDecimal("500.00"), new BigDecimal("-2"));

        assertEquals(new BigDecimal("100.00"), costOf(1).get(100));
    }

    @Test
    void filledBuyAndPartialSellExposeRemainingQuantityAtAcquisitionCost() {
        acquire(808, 100, new BigDecimal("20.00"), new BigDecimal("10"));
        move(808, 100, new BigDecimal("25.00"), new BigDecimal("-4"));
        Holding position = new Holding();
        position.setAccountId(808);
        position.setInstrumentId(100);
        position.setQuantity(new BigDecimal("6"));
        position.setUpdatedAt(java.time.OffsetDateTime.now());
        holdingRepository.saveAndFlush(position);

        Holding read = holdingRepository.findByAccountIdAndInstrumentId(808, 100).orElseThrow();
        assertEquals(0, new BigDecimal("6").compareTo(read.getQuantity()));
        assertEquals(new BigDecimal("20.00"), costOf(808).get(100));
        assertTrue(costOf(809).isEmpty());
    }

    @Test
    void averageCostIsReportedPerInstrument() {
        acquire(1, 100, new BigDecimal("280.10"), new BigDecimal("4"));
        acquire(1, 101, new BigDecimal("610.50"), new BigDecimal("3"));

        Map<Integer, BigDecimal> costs = costOf(1);

        assertEquals(new BigDecimal("280.10"), costs.get(100));
        assertEquals(new BigDecimal("610.50"), costs.get(101));
    }

    @Test
    void movementsOfOtherAccountsAreNotMixedIn() {
        acquire(1, 100, new BigDecimal("100.00"), BigDecimal.ONE);
        acquire(2, 100, new BigDecimal("900.00"), BigDecimal.ONE);

        assertEquals(new BigDecimal("100.00"), costOf(1).get(100));
        assertEquals(new BigDecimal("900.00"), costOf(2).get(100));
    }

    @Test
    void anAccountWithNoMovementsHasNoCosts() {
        assertTrue(holdingMovementRepository.pricedMovements(404).isEmpty());
    }

    @Test
    void movementRoundTripsEveryMappedField() {
        Fill fill = new Fill();
        fill.setQuotePrice(new BigDecimal("12.34"));
        Integer fillId = fillRepository.save(fill).getFillId();

        HoldingMovement movement = new HoldingMovement();
        movement.setAccountId(7);
        movement.setInstrumentId(100);
        movement.setFillId(fillId);
        movement.setQuantityDelta(new BigDecimal("2.5000"));
        HoldingMovement saved = holdingMovementRepository.save(movement);

        assertEquals(7, saved.getAccountId());
        assertEquals(100, saved.getInstrumentId());
        assertEquals(fillId, saved.getFillId());
        assertEquals(new BigDecimal("2.5000"), saved.getQuantityDelta());
        assertEquals(fillId, fillRepository.findById(fillId).orElseThrow().getFillId());
        assertEquals(new BigDecimal("12.34"),
                fillRepository.findById(fillId).orElseThrow().getQuotePrice());
        movement.setHoldingMovementId(saved.getHoldingMovementId());
        assertEquals(saved.getHoldingMovementId(), movement.getHoldingMovementId());
    }

    private Map<Integer, BigDecimal> costOf(Integer accountId) {
        Map<Integer, BigDecimal> costs = new HashMap<>();
        CostBasis.averageCosts(holdingMovementRepository.pricedMovements(accountId))
                .forEach((instrumentId, cost) -> costs.put(instrumentId, cost.setScale(2, RoundingMode.HALF_UP)));
        return costs;
    }

    private void acquire(Integer accountId, Integer instrumentId, BigDecimal price, BigDecimal quantity) {
        move(accountId, instrumentId, price, quantity);
    }

    private void move(Integer accountId, Integer instrumentId, BigDecimal price, BigDecimal quantityDelta) {
        Fill fill = new Fill();
        fill.setQuotePrice(price);
        Integer fillId = fillRepository.save(fill).getFillId();

        HoldingMovement movement = new HoldingMovement();
        movement.setAccountId(accountId);
        movement.setInstrumentId(instrumentId);
        movement.setFillId(fillId);
        movement.setQuantityDelta(quantityDelta);
        holdingMovementRepository.save(movement);
    }
}
