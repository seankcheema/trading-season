package app.order.event;

import app.instrument.Instrument;
import app.order.Order;
import com.fasterxml.jackson.annotation.JsonIgnore;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * One order reaching a committed status: {@code ACCEPTED} when the trading
 * rules passed and the order was recorded as a firm commitment (BR-06), then
 * {@code FILLED} or {@code REJECTED} when execution resolved it. An order the
 * rules reject goes straight to {@code REJECTED}. {@code OrderService} and
 * {@code OrderExecutionService} raise it inside the transaction that made the
 * change, and {@link TradeEventPublisher} sends it to Kafka once that
 * transaction has committed, so a consumer never sees a status the database
 * does not.
 *
 * <p>The record is the message body as well: serialised as JSON it carries
 * every component except {@code accountId}, which travels as the message
 * key so that one account's events share a partition and keep their order.
 * It holds plain values, not entities, because it is handled after the
 * transaction and outside any persistence context.
 *
 * <p>The message is also how the reporting service learns about orders. It
 * has no database connection, so everything it shows of an order is carried
 * here: {@link OrderRecord} holds the order row as it stood at this status,
 * and {@link Execution} the fill and the two ledger postings of a
 * {@code FILLED} order.
 *
 * @param accountId       the account the order was placed against; the message key, not part of the body
 * @param orderId         the order
 * @param status          ACCEPTED, FILLED, REJECTED or CANCELLED; triggering emits an updated ACCEPTED snapshot
 * @param symbol          the instrument's ticker
 * @param side            {@code BUY} or {@code SELL}
 * @param quantity        units ordered
 * @param price           actual fill quote when filled, otherwise the client display price
 * @param rejectionReason why the order was rejected, or {@code null} otherwise
 * @param occurredAt      when the order reached this status
 * @param order           the order row as committed with this status
 * @param execution       the fill and its ledger postings when the status is {@code FILLED}, otherwise {@code null}
 */
public record OrderStatusEvent(
        @JsonIgnore Integer accountId,
        Integer orderId,
        String status,
        String symbol,
        String side,
        BigDecimal quantity,
        BigDecimal price,
        String rejectionReason,
        OffsetDateTime occurredAt,
        OrderRecord order,
        Execution execution) {

    /**
     * The order row behind a status change: what a consumer without access
     * to the {@code orders} table needs to show the order.
     *
     * @param clientReference the idempotency key the client submitted the order under
     * @param instrumentId    the instrument's id
     * @param instrumentName  the instrument's display name
     * @param indicativePrice the price the client saw when submitting
     * @param bufferPercent   the price tolerance the order was submitted with
     * @param submittedAt     when the order was received
     * @param acceptedAt      when the trading rules passed, or {@code null}
     * @param resolvedAt      when the order was filled or rejected, or {@code null}
     * @param simulatedAt     the replay time the client traded at, or {@code null}
     * @param executionType persisted executionType
     * @param limitPrice persisted limitPrice
     * @param stopPrice persisted stopPrice
     * @param referencePrice persisted referencePrice
     * @param referenceAt persisted referenceAt
     * @param sessionId persisted sessionId
     * @param triggerPrice authoritative activation quote, null before triggering or for legacy orders
     * @param triggeredAt persisted triggeredAt
     * @param evaluatedAt persisted evaluatedAt
     * @param reservedCash persisted reservedCash
     * @param reservedShares persisted reservedShares
     * @param executionPrice persisted executionPrice
     * @param rejectionCode persisted rejectionCode
     */
    public record OrderRecord(
            UUID clientReference,
            Integer instrumentId,
            String instrumentName,
            BigDecimal indicativePrice,
            BigDecimal bufferPercent,
            OffsetDateTime submittedAt,
            OffsetDateTime acceptedAt,
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
            String rejectionCode) {
    }

    /**
     * What executing an order wrote: the fill, the cash posting and the
     * holding movement, each with the balance it left, so a consumer can keep
     * the owner's funds and the account's position without reading either
     * table.
     *
     * @param userId            the trader who owns the account, and whose funds the fill moved
     * @param fillId            the fill
     * @param price             the price the order was filled at
     * @param quantity          units filled
     * @param filledAt          when the fill was written
     * @param cashTransactionId the cash ledger row the fill posted
     * @param cashAmount        the signed amount posted: negative for a buy, positive for a sell
     * @param availableFunds    the owning user's available funds after the posting
     * @param holdingMovementId the position ledger row the fill posted
     * @param quantityDelta     the signed change in units held: positive for a buy, negative for a sell
     * @param holdingQuantity   units of the instrument the account holds after the movement
     */
    public record Execution(
            UUID userId,
            Integer fillId,
            BigDecimal price,
            BigDecimal quantity,
            OffsetDateTime filledAt,
            Integer cashTransactionId,
            BigDecimal cashAmount,
            BigDecimal availableFunds,
            Integer holdingMovementId,
            BigDecimal quantityDelta,
            BigDecimal holdingQuantity) {
    }

    /**
     * Captures an order's current status, for a status that executed nothing.
     *
     * @param order      the order after its status change was saved
     * @param instrument the instrument the order trades, for its ticker and name
     * @return the event describing that status
     */
    public static OrderStatusEvent from(Order order, Instrument instrument) {
        return from(order, instrument, null);
    }

    /**
     * Captures an order's current status together with what its execution wrote.
     *
     * @param order      the order after its status change was saved
     * @param instrument the instrument the order trades, for its ticker and name
     * @param execution  the fill and ledger postings of a filled order, or {@code null}
     * @return the event describing that status
     */
    public static OrderStatusEvent from(Order order, Instrument instrument, Execution execution) {
        OffsetDateTime occurredAt = order.getResolvedAt() != null ? order.getResolvedAt()
                : order.getAcceptedAt() != null ? order.getAcceptedAt()
                : order.getSubmittedAt();
        return new OrderStatusEvent(
                order.getAccountId(),
                order.getOrderId(),
                order.getStatus(),
                instrument.getTicker(),
                order.getOrderType(),
                order.getQuantity(),
                execution != null ? execution.price() : order.getIndicativePrice(),
                order.getRejectionReason(),
                occurredAt,
                new OrderRecord(
                        order.getClientReference(),
                        order.getInstrumentId(),
                        instrument.getName(),
                        order.getIndicativePrice(),
                        order.getBufferPercent(),
                        order.getSubmittedAt(),
                        order.getAcceptedAt(),
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
                        order.getRejectionCode()),
                execution);
    }
}
