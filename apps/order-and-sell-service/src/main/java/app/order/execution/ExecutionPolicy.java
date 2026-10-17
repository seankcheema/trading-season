package app.order.execution;

import app.order.Order;
import java.math.BigDecimal;
import java.math.RoundingMode;

/** Pure, inclusive stock execution conditions and adverse-price protection. */
public final class ExecutionPolicy {
    private ExecutionPolicy() { }
    /** Returns the submission day's regular market close, independent of wall-clock time.
     * @param order instruction with an authoritative submission position
     * @return 15:00 America/Chicago on that simulation date */
    public static java.time.OffsetDateTime expiresAt(Order order) {
        var zone = java.time.ZoneId.of("America/Chicago");
        return order.getReferenceAt().atZoneSameInstant(zone).toLocalDate()
                .atTime(15, 0).atZone(zone).toOffsetDateTime();
    }
    /** Computes the adverse execution boundary at database price precision.
     * @param side BUY or SELL
     * @param reference authoritative submission quote for Market, or activation quote for Stop
     * @param percent saved percentage
     * @return maximum BUY or minimum SELL price */
    public static BigDecimal boundary(String side, BigDecimal reference, BigDecimal percent) {
        boolean buy = Order.TYPE_BUY.equals(side);
        BigDecimal fraction = percent.movePointLeft(2);
        return reference.multiply(buy ? BigDecimal.ONE.add(fraction) : BigDecimal.ONE.subtract(fraction))
                .setScale(6, buy ? RoundingMode.FLOOR : RoundingMode.CEILING);
    }
    /** Checks a limit, allowing favorable execution.
     * @param side BUY or SELL
     * @param price current quote
     * @param limit explicit limit or buffer boundary
     * @return whether execution respects the bound */
    public static boolean within(String side, BigDecimal price, BigDecimal limit) {
        return Order.TYPE_BUY.equals(side) ? price.compareTo(limit) <= 0 : price.compareTo(limit) >= 0;
    }
    /** Checks the stop activation condition.
     * @param side BUY or SELL
     * @param price current quote
     * @param stop stop price
     * @return whether the stop activates */
    public static boolean triggers(String side, BigDecimal price, BigDecimal stop) {
        return Order.TYPE_BUY.equals(side) ? price.compareTo(stop) >= 0 : price.compareTo(stop) <= 0;
    }
    /** Returns the maximum BUY reservation price.
     * @param order snapshotted instruction
     * @return explicit limit or protected BUY maximum */
    public static BigDecimal reservationPrice(Order order) {
        return order.getLimitPrice() != null ? order.getLimitPrice()
                : boundary(Order.TYPE_BUY, order.getReferencePrice(), order.getBufferPercent());
    }
}
