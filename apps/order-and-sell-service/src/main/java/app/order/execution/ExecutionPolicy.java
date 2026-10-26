package app.order.execution;

import app.order.Order;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;

/**
 * Pure, inclusive stock execution conditions and adverse-price protection, and
 * the hours of the simulated session every instrument trades on: Monday to
 * Friday, {@link #SESSION_OPEN} to {@link #SESSION_CLOSE} in {@link #MARKET_ZONE}.
 */
public final class ExecutionPolicy {
    /** The zone the simulated session is defined in. */
    public static final ZoneId MARKET_ZONE = ZoneId.of("America/Chicago");
    /** The first second an order can be placed on a trading day. */
    public static final LocalTime SESSION_OPEN = LocalTime.of(8, 30);
    /** The regular close: orders are refused from this second and day orders expire at it. */
    public static final LocalTime SESSION_CLOSE = LocalTime.of(15, 0);
    private ExecutionPolicy() { }
    /** Returns the submission day's regular market close, independent of wall-clock time.
     * @param order instruction with an authoritative submission position
     * @return {@link #SESSION_CLOSE} in {@link #MARKET_ZONE} on that simulation date */
    public static OffsetDateTime expiresAt(Order order) {
        return order.getReferenceAt().atZoneSameInstant(MARKET_ZONE).toLocalDate()
                .atTime(SESSION_CLOSE).atZone(MARKET_ZONE).toOffsetDateTime();
    }
    /** Tells whether the market is open at an authoritative position (BR-05).
     * @param at a simulated position, in any offset
     * @return true Monday to Friday from the open up to, not including, the close */
    public static boolean isDuringSession(OffsetDateTime at) {
        ZonedDateTime local = at.atZoneSameInstant(MARKET_ZONE);
        DayOfWeek day = local.getDayOfWeek();
        LocalTime time = local.toLocalTime();
        return day != DayOfWeek.SATURDAY && day != DayOfWeek.SUNDAY
                && !time.isBefore(SESSION_OPEN) && time.isBefore(SESSION_CLOSE);
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
    /** Returns the maximum BUY reservation price. A stop BUY cannot fill below its stop, so the
     * buffer is applied to the higher of the stop and the submission quote.
     * @param order snapshotted instruction
     * @return explicit limit or protected BUY maximum */
    public static BigDecimal reservationPrice(Order order) {
        if (order.getLimitPrice() != null) {
            return order.getLimitPrice();
        }
        BigDecimal anchor = order.getReferencePrice();
        if (order.getStopPrice() != null && order.getStopPrice().compareTo(anchor) > 0) {
            anchor = order.getStopPrice();
        }
        return boundary(Order.TYPE_BUY, anchor, order.getBufferPercent());
    }
}
