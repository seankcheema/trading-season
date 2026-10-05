package app.order.event;

import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

/**
 * The listeners only log, so the direct calls here check they accept a
 * record without a running container. The end-to-end delivery through a
 * broker is covered by {@code TradeEventFlowIntegrationTest}.
 */
@Tag("unit")
class TradeEventListenersTest {

    private static ConsumerRecord<String, String> record() {
        return new ConsumerRecord<>(TradeEventPublisher.TOPIC, 0, 0L, "42",
                "{\"orderId\":7,\"status\":\"FILLED\"}");
    }

    @Test
    void reportingIngesterAcceptsATradeEvent() {
        assertDoesNotThrow(() -> new ReportingIngesterListener().onTradeEvent(record()));
    }

    @Test
    void orderStatusPusherAcceptsATradeEvent() {
        assertDoesNotThrow(() -> new OrderStatusPusherListener().onTradeEvent(record()));
    }

    @Test
    void theTwoListenersCommitUnderDifferentConsumerGroups() {
        assertNotEquals(ReportingIngesterListener.GROUP_ID, OrderStatusPusherListener.GROUP_ID);
    }
}
