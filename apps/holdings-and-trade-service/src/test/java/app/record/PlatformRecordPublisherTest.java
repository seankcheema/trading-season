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

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;
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
    private static final OffsetDateTime AT = OffsetDateTime.of(2026, 10, 5, 9, 30, 0, 0, ZoneOffset.UTC);
    private static final UUID USER_ID = UUID.fromString("7c9e6679-7425-40de-944b-e07fc1f90ae7");

    @Mock
    private KafkaTemplate<String, String> kafkaTemplate;

    private final JsonMapper jsonMapper = new JsonMapper();
    private PlatformRecordPublisher publisher;

    @BeforeEach
    void setUp() {
        publisher = new PlatformRecordPublisher(kafkaTemplate, jsonMapper);
    }

    private static CashTransferRecord transfer() {
        return new CashTransferRecord(31, 7, USER_ID, new BigDecimal("-25.00"), "WITHDRAWAL", AT,
                new BigDecimal("75.00"));
    }

    private JsonNode published(PlatformRecord record, String key) {
        RecordMetadata metadata = new RecordMetadata(new TopicPartition(TOPIC, 1), 0, 7, 0L, 0, 0);
        when(kafkaTemplate.send(eq(TOPIC), eq(key), anyString())).thenReturn(CompletableFuture.completedFuture(
                new SendResult<>(new ProducerRecord<>(TOPIC, key, "{}"), metadata)));

        publisher.onRecord(record);

        ArgumentCaptor<String> body = ArgumentCaptor.forClass(String.class);
        verify(kafkaTemplate).send(eq(TOPIC), eq(key), body.capture());
        return jsonMapper.readTree(body.getValue());
    }

    @Test
    void aTransferIsKeyedByItsLedgerRowAndCarriesTheBalanceItLeft() {
        JsonNode json = published(transfer(), "CASH_TRANSFER:31");

        assertEquals("CASH_TRANSFER", json.get("type").stringValue());
        assertEquals(31, json.get("cashTransactionId").intValue());
        assertEquals(7, json.get("accountId").intValue());
        assertEquals(USER_ID.toString(), json.get("userId").stringValue());
        assertEquals(0, new BigDecimal("-25.00").compareTo(json.get("amount").decimalValue()));
        assertEquals("WITHDRAWAL", json.get("reason").stringValue());
        assertTrue(AT.isEqual(OffsetDateTime.parse(json.get("createdAt").stringValue())));
        assertEquals(0, new BigDecimal("75.00").compareTo(json.get("availableFunds").decimalValue()));
        // The key parts are not repeated in the body under their accessor names.
        assertFalse(json.has("recordType"), json.toString());
        assertFalse(json.has("recordId"), json.toString());
    }

    @Test
    void anAccountIsKeyedByItsIdAndNamesItsOwner() {
        JsonNode json = published(
                new TradingAccountRecord(4, USER_ID, "Main Account", LocalDate.of(2026, 10, 5), "USD", "ACTIVE", null),
                "TRADING_ACCOUNT:4");

        assertEquals("TRADING_ACCOUNT", json.get("type").stringValue());
        assertEquals(4, json.get("accountId").intValue());
        assertEquals(USER_ID.toString(), json.get("userId").stringValue());
        assertEquals("Main Account", json.get("name").stringValue());
        assertEquals(LocalDate.of(2026, 10, 5), LocalDate.parse(json.get("openedDate").stringValue()));
    }

    @Test
    void aValuationIsKeyedByItsAccountSoTheNewestReplacesTheRest() {
        Instant observed = Instant.parse("2026-10-05T09:30:00Z");
        JsonNode json = published(new PortfolioValuationRecord(90L, 4, observed, new BigDecimal("1250.75")),
                "PORTFOLIO_VALUATION:4");

        assertEquals("PORTFOLIO_VALUATION", json.get("type").stringValue());
        assertEquals(90, json.get("valuationId").intValue());
        assertEquals(observed, Instant.parse(json.get("observedAt").stringValue()));
        assertEquals(0, new BigDecimal("1250.75").compareTo(json.get("portfolioValue").decimalValue()));
    }

    @Test
    void theCurrentSessionHasOneKey() {
        JsonNode json = published(new MarketSessionRecord(2026001L), "MARKET_SESSION:current");

        assertEquals("MARKET_SESSION", json.get("type").stringValue());
        assertEquals(2026001L, json.get("sessionId").longValue());
    }

    @Test
    void aBrokerFailureReportedAsynchronouslyIsLoggedNotThrown() {
        when(kafkaTemplate.send(eq(TOPIC), eq("CASH_TRANSFER:31"), anyString()))
                .thenReturn(CompletableFuture.failedFuture(new KafkaException("broker rejected the record")));

        assertDoesNotThrow(() -> publisher.onRecord(transfer()));
    }

    @Test
    void aSendThatThrowsSynchronouslyIsLoggedNotThrown() {
        when(kafkaTemplate.send(eq(TOPIC), eq("CASH_TRANSFER:31"), anyString()))
                .thenThrow(new KafkaException("no brokers reachable"));

        assertDoesNotThrow(() -> publisher.onRecord(transfer()));
    }
}
