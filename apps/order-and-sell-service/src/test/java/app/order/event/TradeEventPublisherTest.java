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
import tools.jackson.databind.json.JsonMapper;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
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
                new BigDecimal("100"), new BigDecimal("50.00"), null, RESOLVED_AT);
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
    void carriesTheRejectionReasonWhenTheOrderWasRejected() {
        when(kafkaTemplate.send(eq(TOPIC), eq("42"), anyString()))
                .thenReturn(acknowledged("42", "{}"));
        OrderStatusEvent rejected = new OrderStatusEvent(42, 8, "REJECTED", "TEST", "SELL",
                new BigDecimal("5"), new BigDecimal("50.00"), "Insufficient holdings", RESOLVED_AT);

        publisher.onOrderStatus(rejected);

        ArgumentCaptor<String> body = ArgumentCaptor.forClass(String.class);
        verify(kafkaTemplate).send(eq(TOPIC), eq("42"), body.capture());
        OrderStatusEvent echoed = jsonMapper.readValue(body.getValue(), OrderStatusEvent.class);
        assertEquals("REJECTED", echoed.status());
        assertEquals("Insufficient holdings", echoed.rejectionReason());
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
