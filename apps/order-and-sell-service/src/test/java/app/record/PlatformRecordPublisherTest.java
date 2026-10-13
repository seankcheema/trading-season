package app.record;

import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.clients.producer.RecordMetadata;
import org.apache.kafka.common.KafkaException;
import org.apache.kafka.common.TopicPartition;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.concurrent.CompletableFuture;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@Tag("unit")
class PlatformRecordPublisherTest {

    private static final String TOPIC = PlatformRecordPublisher.TOPIC;
    private static final OffsetDateTime RECORDED_AT =
            OffsetDateTime.of(2026, 10, 5, 9, 30, 0, 0, ZoneOffset.UTC);

    @Mock
    private KafkaTemplate<String, String> kafkaTemplate;

    private final JsonMapper jsonMapper = new JsonMapper();
    private PlatformRecordPublisher publisher;

    @BeforeEach
    void setUp() {
        publisher = new PlatformRecordPublisher(kafkaTemplate, jsonMapper);
    }

    private static AuditEntryRecord auditEntry() {
        return new AuditEntryRecord(17, 7, "EXECUTION_FAILED", "IllegalStateException: no owner", RECORDED_AT);
    }

    private static CompletableFuture<SendResult<String, String>> acknowledged(String key) {
        RecordMetadata metadata = new RecordMetadata(new TopicPartition(TOPIC, 1), 0, 7, 0L, 0, 0);
        return CompletableFuture.completedFuture(
                new SendResult<>(new ProducerRecord<>(TOPIC, key, "{}"), metadata));
    }

    private JsonNode sentBody(String key) {
        ArgumentCaptor<String> body = ArgumentCaptor.forClass(String.class);
        verify(kafkaTemplate).send(eq(TOPIC), eq(key), body.capture());
        return jsonMapper.readTree(body.getValue());
    }

    @Test
    void sendsAnAuditEntryKeyedByItsTypeAndId() {
        when(kafkaTemplate.send(eq(TOPIC), eq("ORDER_AUDIT:17"), anyString()))
                .thenReturn(acknowledged("ORDER_AUDIT:17"));

        publisher.onRecord(auditEntry());

        JsonNode json = sentBody("ORDER_AUDIT:17");
        assertEquals("ORDER_AUDIT", json.get("type").stringValue());
        assertEquals(17, json.get("auditId").intValue());
        assertEquals(7, json.get("orderId").intValue());
        assertEquals("EXECUTION_FAILED", json.get("eventType").stringValue());
        assertEquals("IllegalStateException: no owner", json.get("detail").stringValue());
        assertTrue(RECORDED_AT.isEqual(OffsetDateTime.parse(json.get("recordedAt").stringValue())));
        // The key parts are not repeated in the body under their accessor names.
        assertFalse(json.has("recordType"), json.toString());
        assertFalse(json.has("recordId"), json.toString());
    }

    @Test
    void aBrokerFailureReportedAsynchronouslyIsLoggedNotThrown() {
        when(kafkaTemplate.send(eq(TOPIC), eq("ORDER_AUDIT:17"), anyString()))
                .thenReturn(CompletableFuture.failedFuture(new KafkaException("broker rejected the record")));

        assertDoesNotThrow(() -> publisher.onRecord(auditEntry()));
    }

    @Test
    void aSendThatThrowsSynchronouslyIsLoggedNotThrown() {
        when(kafkaTemplate.send(eq(TOPIC), eq("ORDER_AUDIT:17"), anyString()))
                .thenThrow(new KafkaException("no brokers reachable"));

        assertDoesNotThrow(() -> publisher.onRecord(auditEntry()));
    }
}
