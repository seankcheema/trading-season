package app.order.execution;

import app.order.Order;
import java.math.BigDecimal;

/** Pure adverse-price protection shared by preflight and execution. */
public final class ExecutionPolicy {
    private ExecutionPolicy() { }

    /** Tests the supported percentage range and precision.
     * @param buffer percentage
     * @return whether the percentage is between zero and ten with at most two decimals */
    public static boolean validBuffer(BigDecimal buffer) {
        return buffer != null && buffer.signum() >= 0 && buffer.compareTo(BigDecimal.TEN) <= 0
                && buffer.stripTrailingZeros().scale() <= 2;
    }

    /** Calculates the highest buy or lowest sell price.
     * @param side BUY or SELL
     * @param indicative client reference price
     * @param buffer adverse movement percentage
     * @return inclusive price boundary */
    public static BigDecimal boundary(String side, BigDecimal indicative, BigDecimal buffer) {
        BigDecimal fraction = buffer.movePointLeft(2);
        return indicative.multiply(Order.TYPE_BUY.equals(side)
                ? BigDecimal.ONE.add(fraction) : BigDecimal.ONE.subtract(fraction));
    }

    /** Assesses a quote against protection and available resources.
     * @param side BUY or SELL
     * @param quantity requested shares
     * @param price server quote
     * @param boundary inclusive price boundary
     * @param funds available user cash
     * @param held account holding quantity
     * @return failure code, or null on success */
    public static String failure(String side, BigDecimal quantity, BigDecimal price,
                                 BigDecimal boundary, BigDecimal funds, BigDecimal held) {
        boolean buy = Order.TYPE_BUY.equals(side);
        if ((buy && price.compareTo(boundary) > 0) || (!buy && price.compareTo(boundary) < 0))
            return "PRICE_OUTSIDE_BUFFER";
        if (buy && quantity.multiply(price).compareTo(funds) > 0) return "INSUFFICIENT_FUNDS";
        if (!buy && quantity.compareTo(held) > 0) return "INSUFFICIENT_HOLDINGS";
        return null;
    }

    /** Maps assessment failures to safe explanations.
     * @param code failure code
     * @return explanation */
    public static String reason(String code) {
        return switch (code) {
            case "PRICE_OUTSIDE_BUFFER" -> "Execution price is outside your buffer. Refresh the price and try again.";
            case "INSUFFICIENT_FUNDS" -> "BR-09: insufficient funds at execution time";
            case "INSUFFICIENT_HOLDINGS" -> "Insufficient holdings at execution time";
            case "INVALID_BUFFER" -> "Set your execution buffer to 0–10%, with at most two decimal places.";
            default -> "Market price unavailable. Please try again.";
        };
    }
}
