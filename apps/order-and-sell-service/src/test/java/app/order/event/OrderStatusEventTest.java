package app.order.event;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import app.instrument.Instrument;
import app.order.Order;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/**
 * The price a {@code trade-events} message carries: the fill's quote price once the
 * order is FILLED (BR-08, BR-15), the indicative price the trader saw before that.
 */
class OrderStatusEventTest {

    private static final OffsetDateTime NOW = OffsetDateTime.parse("2026-01-05T15:00:00Z");

    @Test
    void aFilledEventCarriesTheFillPriceNotTheIndicativePrice() {
        Order order = order(Order.STATUS_FILLED);
        OrderStatusEvent.Execution execution = new OrderStatusEvent.Execution(
                UUID.randomUUID(), 7, new BigDecimal("26.40"), new BigDecimal("10"), NOW,
                11, new BigDecimal("-264.00"), new BigDecimal("736.00"), 13, new BigDecimal("10"), new BigDecimal("10"));

        OrderStatusEvent event = OrderStatusEvent.from(order, instrument(), execution);

        assertEquals(new BigDecimal("26.40"), event.price());
        assertEquals(new BigDecimal("25.00"), event.order().indicativePrice());
        assertEquals(execution, event.execution());
    }

    @Test
    void anEventWithoutAnExecutionCarriesTheIndicativePrice() {
        OrderStatusEvent accepted = OrderStatusEvent.from(order(Order.STATUS_ACCEPTED), instrument());

        assertEquals(new BigDecimal("25.00"), accepted.price());
        assertNull(accepted.execution());
        assertEquals("TEST", accepted.symbol());
        assertEquals(NOW.minusSeconds(1), accepted.occurredAt());
    }

    @Test
    void occurredAtFallsBackToSubmissionWhenTheOrderWasNeitherAcceptedNorResolved() {
        Order pending = order(Order.STATUS_PENDING);
        pending.setAcceptedAt(null);

        OrderStatusEvent event = OrderStatusEvent.from(pending, instrument());

        assertEquals(NOW.minusSeconds(2), event.occurredAt());
        assertEquals(new BigDecimal("25.00"), event.price());
    }

    private static Order order(String status) {
        Order order = new Order();
        order.setOrderId(1);
        order.setAccountId(2);
        order.setInstrumentId(3);
        order.setClientReference(UUID.randomUUID());
        order.setOrderType(Order.TYPE_BUY);
        order.setStatus(status);
        order.setQuantity(new BigDecimal("10"));
        order.setIndicativePrice(new BigDecimal("25.00"));
        order.setSubmittedAt(NOW.minusSeconds(2));
        order.setAcceptedAt(NOW.minusSeconds(1));
        if (Order.STATUS_FILLED.equals(status)) {
            order.setResolvedAt(NOW);
        }
        return order;
    }

    private static Instrument instrument() {
        Instrument instrument = new Instrument();
        instrument.setInstrumentId(3);
        instrument.setTicker("TEST");
        instrument.setName("Test instrument");
        return instrument;
    }
}
