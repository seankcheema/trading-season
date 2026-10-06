package app.holding;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Derives the average price paid for each open position by replaying its movements.
 *
 * <p>This is the moving weighted-average method. A buy blends its price into the
 * average in proportion to quantity. A sell leaves the average of what remains
 * unchanged, because it disposes of shares at the market price rather than
 * changing what the rest cost. Once a sell takes the quantity to zero the position
 * is closed and its history is forgotten, so buying the instrument again starts a
 * fresh average instead of being blended with positions long since sold.
 */
public final class CostBasis {

    private static final int SCALE = 8;

    private CostBasis() {
    }

    /**
     * Replays a ledger into the average price of each position that is still open.
     *
     * @param movements one account's movements, oldest first
     * @return average price paid per share keyed by instrument id; an instrument that
     *         was never bought, or whose position has been sold back to zero, is absent
     */
    public static Map<Integer, BigDecimal> averageCosts(List<PricedMovement> movements) {
        Map<Integer, BigDecimal> quantities = new HashMap<>();
        Map<Integer, BigDecimal> averages = new HashMap<>();
        for (PricedMovement movement : movements) {
            if (movement.instrumentId() == null || movement.quantityDelta() == null) {
                continue;
            }
            Integer instrumentId = movement.instrumentId();
            BigDecimal held = quantities.getOrDefault(instrumentId, BigDecimal.ZERO);
            BigDecimal delta = movement.quantityDelta();
            if (delta.signum() > 0 && movement.quotePrice() != null) {
                BigDecimal average = averages.getOrDefault(instrumentId, BigDecimal.ZERO);
                BigDecimal newQuantity = held.add(delta);
                averages.put(instrumentId, held.multiply(average)
                        .add(delta.multiply(movement.quotePrice()))
                        .divide(newQuantity, SCALE, RoundingMode.HALF_UP));
                quantities.put(instrumentId, newQuantity);
            } else if (delta.signum() < 0) {
                BigDecimal remaining = held.add(delta);
                if (remaining.signum() <= 0) {
                    quantities.remove(instrumentId);
                    averages.remove(instrumentId);
                } else {
                    quantities.put(instrumentId, remaining);
                }
            }
        }
        return averages;
    }
}
