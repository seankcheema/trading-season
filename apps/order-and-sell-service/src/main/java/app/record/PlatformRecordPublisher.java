package app.record;

import org.apache.kafka.clients.producer.RecordMetadata;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

/**
 * Publishes each {@link PlatformRecord} to the {@value #TOPIC} topic after
 * the transaction that wrote the row.
 *
 * <p>The reporting service has no database connection: this topic and
 * {@code trade-events} are its only sources. The message key is the record's
 * type and id, {@code ORDER_AUDIT:17}, so every state of one row lands on the
 * same partition in order and the topic can be compacted down to the latest
 * state of each row. The body is the record as JSON with its {@code type}
 * added.
 *
 * <p>Publishing can never change the outcome of the write it reports. Like
 * {@link app.order.event.TradeEventPublisher}, this catches everything the
 * send can throw synchronously and logs it, and logs an asynchronous failure
 * in the completion callback. A record raised outside a transaction is sent
 * at once.
 *
 * <p>Absent when {@code app.events.enabled} is {@code false}.
 */
@Component
@ConditionalOnProperty(name = "app.events.enabled", havingValue = "true", matchIfMissing = true)
public class PlatformRecordPublisher {

    /** The topic every committed record is published to. */
    public static final String TOPIC = "platform-records";

    private static final Logger log = LoggerFactory.getLogger(PlatformRecordPublisher.class);

    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;

    /**
     * Creates the publisher.
     *
     * @param kafkaTemplate sends to the broker named by {@code spring.kafka.bootstrap-servers}
     * @param objectMapper  serialises the record body
     */
    public PlatformRecordPublisher(KafkaTemplate<String, String> kafkaTemplate, ObjectMapper objectMapper) {
        this.kafkaTemplate = kafkaTemplate;
        this.objectMapper = objectMapper;
    }

    /**
     * Sends one message for a row once its transaction has committed. Logs
     * the partition and offset the broker assigned, or the failure. Never
     * throws.
     *
     * @param record the row that was committed
     */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onRecord(PlatformRecord record) {
        String key = record.recordType() + ":" + record.recordId();
        try {
            ObjectNode body = objectMapper.createObjectNode();
            body.put("type", record.recordType());
            body.setAll((ObjectNode) objectMapper.valueToTree(record));
            kafkaTemplate.send(TOPIC, key, objectMapper.writeValueAsString(body)).whenComplete((result, failure) -> {
                if (failure == null) {
                    RecordMetadata metadata = result.getRecordMetadata();
                    log.info("Published platform record key={} partition={} offset={}",
                            key, metadata.partition(), metadata.offset());
                } else {
                    log.error("Failed to publish platform record key={}", key, failure);
                }
            });
        } catch (RuntimeException ex) {
            log.error("Failed to publish platform record key={}", key, ex);
        }
    }
}
