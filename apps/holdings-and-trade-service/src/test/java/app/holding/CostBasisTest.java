package app.holding;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@Tag("unit")
class CostBasisTest {

    private static PricedMovement move(int instrumentId, String quantity, String price) {
        return new PricedMovement(instrumentId, new BigDecimal(quantity), new BigDecimal(price));
    }

    private static void assertCost(String expected, Map<Integer, BigDecimal> costs, int instrumentId) {
        assertEquals(0, new BigDecimal(expected).compareTo(costs.get(instrumentId)),
                "cost was " + costs.get(instrumentId));
    }

    @Test
    void buysAreWeightedByQuantity() {
        assertCost("175", CostBasis.averageCosts(List.of(move(1, "1", "100"), move(1, "3", "200"))), 1);
    }

    @Test
    void aPartialSellLeavesTheAverageUnchanged() {
        assertCost("100", CostBasis.averageCosts(List.of(move(1, "4", "100"), move(1, "-2", "500"))), 1);
    }

    @Test
    void buyingAfterAPartialSellBlendsWithOnlyTheSharesStillHeld() {
        // 4 at 100, sell 2 leaves 2 at 100; 2 more at 200 averages 150, not 133.33.
        assertCost("150", CostBasis.averageCosts(
                List.of(move(1, "4", "100"), move(1, "-2", "500"), move(1, "2", "200"))), 1);
    }

    @Test
    void sellingEverythingForgetsThePosition() {
        assertTrue(CostBasis.averageCosts(List.of(move(1, "4", "100"), move(1, "-4", "500"))).isEmpty());
    }

    @Test
    void buyingAgainAfterSellingEverythingStartsAFreshAverage() {
        assertCost("300", CostBasis.averageCosts(
                List.of(move(1, "4", "100"), move(1, "-4", "500"), move(1, "2", "300"))), 1);
    }

    @Test
    void instrumentsAreTrackedIndependently() {
        Map<Integer, BigDecimal> costs = CostBasis.averageCosts(List.of(
                move(1, "2", "100"), move(2, "5", "50"), move(1, "-2", "120"), move(2, "5", "70")));

        assertTrue(!costs.containsKey(1));
        assertCost("60", costs, 2);
    }

    @Test
    void movementsWithNoInstrumentOrQuantityAreSkipped() {
        Map<Integer, BigDecimal> costs = CostBasis.averageCosts(List.of(
                new PricedMovement(null, BigDecimal.ONE, BigDecimal.TEN),
                new PricedMovement(1, null, BigDecimal.TEN),
                new PricedMovement(1, BigDecimal.ONE, null)));

        assertTrue(costs.isEmpty());
    }

    @Test
    void sellingMoreThanWasBoughtClosesThePosition() {
        assertTrue(CostBasis.averageCosts(List.of(move(1, "1", "100"), move(1, "-5", "100"))).isEmpty());
    }
}
