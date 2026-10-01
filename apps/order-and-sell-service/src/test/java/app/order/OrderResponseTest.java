package app.order;

import app.order.dto.OrderResponse;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import static org.junit.jupiter.api.Assertions.assertEquals;

class OrderResponseTest {
    @Test
    void responseIdentifiesTheExecutedInstrumentAndRetainsExecutionDetails() {
        Order order = new Order();
        order.setOrderId(42);
        order.setInstrumentId(7);
        order.setOrderType("SELL");
        order.setStatus("FILLED");
        order.setQuantity(new BigDecimal("2.5"));
        order.setIndicativePrice(new BigDecimal("100.50"));
        OffsetDateTime executionTime = OffsetDateTime.parse("2026-10-01T18:00:00Z");
        order.setSubmittedAt(executionTime.minusSeconds(1));
        order.setResolvedAt(executionTime);
        var response = OrderResponse.from(order);
        assertEquals(7, response.instrumentId());
        assertEquals("FILLED", response.status());
        assertEquals(executionTime, response.resolvedAt());
        assertEquals(new BigDecimal("2.5"), response.quantity());
        assertEquals(new BigDecimal("100.50"), response.indicativePrice());
    }
}
