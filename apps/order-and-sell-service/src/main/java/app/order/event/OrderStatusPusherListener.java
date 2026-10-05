package app.order.event;

import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

/**
 * Consumer group {@value #GROUP_ID}: the seam where order outcomes will be
 * pushed to the owning client's browser so the status changes without a
 * refresh (BR-07). Until that is built this listener only logs what it
 * receives, which is enough to show that the group gets every event
 * independently of {@link ReportingIngesterListener} and resumes from its
 * committed offset after a restart.
 *
 * <p>Absent when {@code app.events.enabled} is {@code false}.
 */
@Component
@ConditionalOnProperty(name = "app.events.enabled", havingValue = "true", matchIfMissing = true)
public class OrderStatusPusherListener {

    /** The consumer group this listener commits offsets under. */
    public static final String GROUP_ID = "order-status-pusher";

    private static final Logger log = LoggerFactory.getLogger(OrderStatusPusherListener.class);

    /**
     * Logs one received trade event.
     *
     * @param record the message, keyed by account id with the JSON event as value
     */
    @KafkaListener(topics = TradeEventPublisher.TOPIC, groupId = GROUP_ID)
    public void onTradeEvent(ConsumerRecord<String, String> record) {
        log.info("Consumer group {} received key={} partition={} offset={} value={}",
                GROUP_ID, record.key(), record.partition(), record.offset(), record.value());
    }
}
