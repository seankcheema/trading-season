package app.order.dto;

import app.order.Order;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * The outcome of a submitted order. {@code status} and
 * {@code rejectionReason} together answer the second acceptance criterion:
 * whether the trade executed, and if not, why.
 *
 * @param orderId          the created order's id
 * @param instrumentId     instrument traded, for matching execution history to the catalogue
 * @param status           PENDING, FILLED, or REJECTED (KAN-93); a response
 *                         to a submission is always FILLED or REJECTED
 * @param orderType        BUY or SELL
 * @param quantity         units requested
 * @param indicativePrice  the price the client submitted with the order
 * @param rejectionReason  set only when status is REJECTED
 * @param submittedAt      when the order was received
 * @param simulatedAt      selected replay time, or null when real execution time should be displayed
 * @param resolvedAt       when the order reached a final status, if it has
 */
public record OrderResponse(
        Integer orderId,
        Integer instrumentId,
        String status,
        String orderType,
        BigDecimal quantity,
        BigDecimal indicativePrice,
        String rejectionReason,
        OffsetDateTime submittedAt,
        OffsetDateTime resolvedAt,
        OffsetDateTime simulatedAt
) {
    /** Builds a response from a persisted order. */
    public static OrderResponse from(Order order) {
        return new OrderResponse(
                order.getOrderId(),
                order.getInstrumentId(),
                order.getStatus(),
                order.getOrderType(),
                order.getQuantity(),
                order.getIndicativePrice(),
                order.getRejectionReason(),
                order.getSubmittedAt(),
                order.getResolvedAt(),
                order.getSimulatedAt()
        );
    }
}


