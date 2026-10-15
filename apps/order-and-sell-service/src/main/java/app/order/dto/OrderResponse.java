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
 * @param accountId        owned account, for projecting its simulated positions
 * @param instrumentId     instrument traded, for matching execution history to the catalogue
 * @param status           validation, open, filled, rejected or cancelled lifecycle state
 * @param orderType        BUY or SELL
 * @param quantity         units requested
 * @param indicativePrice  the price the client submitted with the order
 * @param bufferPercent    the owner's saved execution buffer snapshotted at acceptance
 * @param rejectionReason  rejection or cancellation explanation, or null when none applies
 * @param submittedAt      when the order was received
 * @param simulatedAt      selected replay time, or null when real execution time should be displayed
 * @param resolvedAt       when the order reached a final status, if it has
 * @param executionType Market, Limit, Stop or Stop-Limit condition
 * @param limitPrice immutable limit price for Limit and Stop-Limit orders, otherwise null
 * @param stopPrice immutable activation price for Stop and Stop-Limit orders, otherwise null
 * @param referencePrice authoritative submission quote, null for legacy orders
 * @param referenceAt simulated submission quote position, null for legacy orders
 * @param sessionId immutable simulation session identifier, null for legacy orders
 * @param triggerPrice authoritative activation quote, null before triggering or for legacy orders
 * @param triggeredAt latched simulated stop activation position
 * @param evaluatedAt last successfully evaluated simulated position
 * @param reservedCash cash held for this open BUY order; released on resolution
 * @param reservedShares shares held for this open SELL order; released on resolution
 * @param executionPrice actual fill quote, null before filling
 * @param rejectionCode machine-readable rejection or cancellation reason, or null
 */
public record OrderResponse(
        Integer orderId,
        Integer instrumentId,
        Integer accountId,
        @io.swagger.v3.oas.annotations.media.Schema(allowableValues = {"PENDING", "ACCEPTED", "FILLED", "REJECTED", "CANCELLED"})
        String status,
        String orderType,
        BigDecimal quantity,
        BigDecimal indicativePrice,
        BigDecimal bufferPercent,
        String rejectionReason,
        OffsetDateTime submittedAt,
        OffsetDateTime resolvedAt,
        OffsetDateTime simulatedAt,
        String executionType,
        BigDecimal limitPrice,
        BigDecimal stopPrice,
        BigDecimal referencePrice,
        OffsetDateTime referenceAt,
        Long sessionId,
        OffsetDateTime triggeredAt,
        BigDecimal triggerPrice,
        OffsetDateTime evaluatedAt,
        BigDecimal reservedCash,
        BigDecimal reservedShares,
        BigDecimal executionPrice,
        String rejectionCode
) {
    /**
     * Builds a response from a persisted order.
     *
     * @param order the persisted order
     * @return the response describing the order
     */
    public static OrderResponse from(Order order) {
        return new OrderResponse(
                order.getOrderId(),
                order.getInstrumentId(),
                order.getAccountId(),
                order.getStatus(),
                order.getOrderType(),
                order.getQuantity(),
                order.getIndicativePrice(),
                order.getBufferPercent(),
                order.getRejectionReason(),
                order.getSubmittedAt(),
                order.getResolvedAt(),
                order.getSimulatedAt(),
                order.getExecutionType(),
                order.getLimitPrice(),
                order.getStopPrice(),
                order.getReferencePrice(),
                order.getReferenceAt(),
                order.getSessionId(),
                order.getTriggeredAt(),
                order.getTriggerPrice(),
                order.getEvaluatedAt(),
                order.getReservedCash(),
                order.getReservedShares(),
                order.getExecutionPrice(),
                order.getRejectionCode()
        );
    }
}


