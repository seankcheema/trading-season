package app.order.event;

import app.instrument.Instrument;
import app.order.Order;
import com.fasterxml.jackson.annotation.JsonIgnore;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

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
 * @param accountId       the account the order was placed against; the message key, not part of the body
 * @param orderId         the order
 * @param status          {@code ACCEPTED}, {@code FILLED} or {@code REJECTED}
 * @param symbol          the instrument's ticker
 * @param side            {@code BUY} or {@code SELL}
 * @param quantity        units ordered
 * @param price           the price the order was filled at, or would be; currently the indicative price
 * @param rejectionReason why the order was rejected, or {@code null} otherwise
 * @param occurredAt      when the order reached this status
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
        OffsetDateTime occurredAt) {

    /**
     * Captures an order's current status.
     *
     * @param order      the order after its status change was saved
     * @param instrument the instrument the order trades, for its ticker
     * @return the event describing that status
     */
    public static OrderStatusEvent from(Order order, Instrument instrument) {
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
                order.getIndicativePrice(),
                order.getRejectionReason(),
                occurredAt);
    }
}
