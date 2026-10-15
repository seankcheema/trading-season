package app.order.event;

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

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@Tag("unit")
class TradeEventPublisherTest {

    private static final String TOPIC = TradeEventPublisher.TOPIC;
    private static final OffsetDateTime RESOLVED_AT =
            OffsetDateTime.of(2026, 10, 5, 9, 30, 0, 0, ZoneOffset.UTC);
    private static final UUID REFERENCE = UUID.fromString("0b9d7c3e-51a4-4f0e-9d2b-6a1f3c8e7d42");
    private static final UUID OWNER = UUID.fromString("7c9e6679-7425-40de-944b-e07fc1f90ae7");

    @Mock
    private KafkaTemplate<String, String> kafkaTemplate;

    private final JsonMapper jsonMapper = new JsonMapper();
    private TradeEventPublisher publisher;

    @BeforeEach
    void setUp() {
        publisher = new TradeEventPublisher(kafkaTemplate, jsonMapper);
    }

    private static OrderStatusEvent filled() {
        return new OrderStatusEvent(42, 7, "FILLED", "TEST", "BUY",
                new BigDecimal("100"), new BigDecimal("50.00"), null, RESOLVED_AT,
                new OrderStatusEvent.OrderRecord(REFERENCE, 3, "Test Corp", new BigDecimal("50.00"),
                        new BigDecimal("0.50"), RESOLVED_AT.minusSeconds(2), RESOLVED_AT.minusSeconds(1),
                        RESOLVED_AT, null, "MARKET", null, null, null, null, null, null, null, BigDecimal.ZERO, BigDecimal.ZERO, null, null),
                new OrderStatusEvent.Execution(OWNER, 9, new BigDecimal("50.00"), new BigDecimal("100"), RESOLVED_AT,
                        14, new BigDecimal("-5000.00"), new BigDecimal("5000.00"),
                        11, new BigDecimal("100"), new BigDecimal("100")));
    }

    private static CompletableFuture<SendResult<String, String>> acknowledged(String key, String value) {
        RecordMetadata metadata = new RecordMetadata(new TopicPartition(TOPIC, 1), 0, 7, 0L, 0, 0);
        return CompletableFuture.completedFuture(
                new SendResult<>(new ProducerRecord<>(TOPIC, key, value), metadata));
    }

    @Test
    void sendsOneMessageKeyedByAccountWithTheOrderAsBody() {
        when(kafkaTemplate.send(eq(TOPIC), eq("42"), anyString()))
                .thenReturn(acknowledged("42", "{}"));

        publisher.onOrderStatus(filled());

        ArgumentCaptor<String> body = ArgumentCaptor.forClass(String.class);
        verify(kafkaTemplate).send(eq(TOPIC), eq("42"), body.capture());
        String json = body.getValue();

        // The account id is the key, not part of the body.
        assertFalse(json.contains("accountId"), json);
        OrderStatusEvent echoed = jsonMapper.readValue(json, OrderStatusEvent.class);
        assertNull(echoed.accountId());
        assertEquals(7, echoed.orderId());
        assertEquals("FILLED", echoed.status());
        assertEquals("TEST", echoed.symbol());
        assertEquals("BUY", echoed.side());
        assertEquals(0, new BigDecimal("100").compareTo(echoed.quantity()));
        assertEquals(0, new BigDecimal("50.00").compareTo(echoed.price()));
        assertNull(echoed.rejectionReason());
        assertTrue(RESOLVED_AT.isEqual(echoed.occurredAt()));
    }

    @Test
    void theBodyCarriesTheOrderRowAndWhatTheExecutionWrote() {
        when(kafkaTemplate.send(eq(TOPIC), eq("42"), anyString()))
                .thenReturn(acknowledged("42", "{}"));

        publisher.onOrderStatus(filled());

        ArgumentCaptor<String> body = ArgumentCaptor.forClass(String.class);
        verify(kafkaTemplate).send(eq(TOPIC), eq("42"), body.capture());
        JsonNode json = jsonMapper.readTree(body.getValue());

        JsonNode order = json.get("order");
        assertEquals(REFERENCE.toString(), order.get("clientReference").stringValue());
        assertEquals(3, order.get("instrumentId").intValue());
        assertEquals("Test Corp", order.get("instrumentName").stringValue());
        assertEquals(0, new BigDecimal("0.50").compareTo(order.get("bufferPercent").decimalValue()));
        assertTrue(order.get("simulatedAt").isNull());
        assertTrue(RESOLVED_AT.isEqual(OffsetDateTime.parse(order.get("resolvedAt").stringValue())));

        JsonNode execution = json.get("execution");
        assertEquals(OWNER.toString(), execution.get("userId").stringValue());
        assertEquals(9, execution.get("fillId").intValue());
        assertEquals(14, execution.get("cashTransactionId").intValue());
        assertEquals(0, new BigDecimal("-5000.00").compareTo(execution.get("cashAmount").decimalValue()));
        assertEquals(0, new BigDecimal("5000.00").compareTo(execution.get("availableFunds").decimalValue()));
        assertEquals(11, execution.get("holdingMovementId").intValue());
        assertEquals(0, new BigDecimal("100").compareTo(execution.get("holdingQuantity").decimalValue()));
    }

    @Test
    void carriesTheRejectionReasonWhenTheOrderWasRejected() {
        when(kafkaTemplate.send(eq(TOPIC), eq("42"), anyString()))
                .thenReturn(acknowledged("42", "{}"));
        OrderStatusEvent rejected = new OrderStatusEvent(42, 8, "REJECTED", "TEST", "SELL",
                new BigDecimal("5"), new BigDecimal("50.00"), "Insufficient holdings", RESOLVED_AT, null, null);

        publisher.onOrderStatus(rejected);

        ArgumentCaptor<String> body = ArgumentCaptor.forClass(String.class);
        verify(kafkaTemplate).send(eq(TOPIC), eq("42"), body.capture());
        OrderStatusEvent echoed = jsonMapper.readValue(body.getValue(), OrderStatusEvent.class);
        assertEquals("REJECTED", echoed.status());
        assertEquals("Insufficient holdings", echoed.rejectionReason());
        assertNull(echoed.execution());
    }

    @Test
    void aBrokerFailureReportedAsynchronouslyIsLoggedNotThrown() {
        when(kafkaTemplate.send(eq(TOPIC), eq("42"), anyString()))
                .thenReturn(CompletableFuture.failedFuture(new KafkaException("broker rejected the record")));

        assertDoesNotThrow(() -> publisher.onOrderStatus(filled()));
    }

    @Test
    void aSendThatThrowsSynchronouslyIsLoggedNotThrown() {
        // What KafkaTemplate does when metadata cannot be fetched within max.block.ms.
        when(kafkaTemplate.send(eq(TOPIC), eq("42"), anyString()))
                .thenThrow(new KafkaException("no brokers reachable"));

        assertDoesNotThrow(() -> publisher.onOrderStatus(filled()));
    }
}
