package app.order.event;

import app.instrument.Instrument;
import app.order.Order;
import com.fasterxml.jackson.annotation.JsonIgnore;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * One order reaching its final status, {@code FILLED} or {@code REJECTED}.
 * {@code OrderService} raises it inside the submission transaction and
 * {@link TradeEventPublisher} sends it to Kafka once that transaction has
 * committed, so a consumer never sees an order the database does not.
 *
 * <p>The record is the message body as well: serialised as JSON it carries
 * every component except {@code accountId}, which travels as the message
 * key so that one account's events share a partition and keep their order.
 * It holds plain values, not entities, because it is handled after the
 * transaction and outside any persistence context.
 *
 * @param accountId       the account the order was placed against; the message key, not part of the body
 * @param orderId         the resolved order
 * @param status          {@code FILLED} or {@code REJECTED}
 * @param symbol          the instrument's ticker
 * @param side            {@code BUY} or {@code SELL}
 * @param quantity        units ordered
 * @param price           the price the order was filled at, or would have been; currently the indicative price
 * @param rejectionReason why the order was rejected, or {@code null} when it filled
 * @param occurredAt      when the order reached its final status
 */
public record OrderResolvedEvent(
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
     * Captures a resolved order.
     *
     * @param order      the order in its final status
     * @param instrument the instrument the order traded, for its ticker
     * @return the event describing that outcome
     */
    public static OrderResolvedEvent from(Order order, Instrument instrument) {
        return new OrderResolvedEvent(
                order.getAccountId(),
                order.getOrderId(),
                order.getStatus(),
                instrument.getTicker(),
                order.getOrderType(),
                order.getQuantity(),
                order.getIndicativePrice(),
                order.getRejectionReason(),
                order.getResolvedAt());
    }
}
