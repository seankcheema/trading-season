/**
 * The Kafka side of order processing (DUA-65). {@link app.order.event.TradeEventPublisher}
 * sends one {@code trade-events} message per committed order status change
 * ({@code ACCEPTED}, {@code FILLED}, {@code REJECTED}), keyed by account id and
 * raised as an {@link app.order.event.OrderStatusEvent} only after the owning
 * transaction commits. {@link app.order.event.OrderStatusPusherListener} is the
 * {@code order-status-pusher} consumer group: it forwards each message to the
 * owner's open server-sent event connections, which
 * {@link app.order.event.OrderStatusStreamController} opens and
 * {@link app.order.event.OrderStatusStreamRegistry} tracks (BR-07).
 *
 * <p>The other two consumer groups live elsewhere: {@code portfolio-valuation-capture}
 * in the Holdings and Trade Service and {@code reporting-ingester} in the reporting
 * service. Publisher and consumer are registered only when {@code app.events.enabled}
 * is {@code true}; the stream endpoint is always present.
 */
package app.order.event;
