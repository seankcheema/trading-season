package app.order.event;

import org.apache.kafka.clients.producer.RecordMetadata;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import tools.jackson.databind.ObjectMapper;

/**
 * Publishes each {@link OrderStatusEvent} to the {@value #TOPIC} topic
 * after the transaction that committed the status change.
 *
 * <p>The message key is the account id, so Kafka places all of one account's
 * events on the same partition in submission order. The body is the event
 * serialised as JSON.
 *
 * <p>Publishing can never change the outcome of an order. Spring rethrows an
 * exception from an after-commit listener to the caller even though the
 * transaction is already committed, so this method catches everything the
 * send can throw synchronously and logs it; an asynchronous failure arrives
 * in the completion callback and is logged there. A broker that is down
 * delays the response by at most the producer's {@code max.block.ms}. The
 * order, its fill and its audit trail are already durable by then (BR-09).
 *
 * <p>Absent when {@code app.events.enabled} is {@code false}, which the test
 * profile sets so that contexts without a broker never try to reach one.
 */
@Component
@ConditionalOnProperty(name = "app.events.enabled", havingValue = "true", matchIfMissing = true)
public class TradeEventPublisher {

    /** The topic every committed order status change is published to. */
    public static final String TOPIC = "trade-events";

    private static final Logger log = LoggerFactory.getLogger(TradeEventPublisher.class);

    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;

    /**
     * Creates the publisher.
     *
     * @param kafkaTemplate sends to the broker named by {@code spring.kafka.bootstrap-servers}
     * @param objectMapper  serialises the event body
     */
    public TradeEventPublisher(KafkaTemplate<String, String> kafkaTemplate, ObjectMapper objectMapper) {
        this.kafkaTemplate = kafkaTemplate;
        this.objectMapper = objectMapper;
    }

    /**
     * Sends one message for an order status change once its transaction has
     * committed. Logs the partition and offset the broker assigned, or the
     * failure. Never throws.
     *
     * @param event the order status that was committed
     */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onOrderStatus(OrderStatusEvent event) {
        String key = String.valueOf(event.accountId());
        try {
            String value = objectMapper.writeValueAsString(event);
            kafkaTemplate.send(TOPIC, key, value).whenComplete((result, failure) -> {
                if (failure == null) {
                    RecordMetadata metadata = result.getRecordMetadata();
                    log.info("Published trade event orderId={} status={} key={} partition={} offset={}",
                            event.orderId(), event.status(), key, metadata.partition(), metadata.offset());
                } else {
                    log.error("Failed to publish trade event orderId={} key={}", event.orderId(), key, failure);
                }
            });
        } catch (RuntimeException ex) {
            log.error("Failed to publish trade event orderId={} key={}", event.orderId(), key, ex);
        }
    }
}
