package app.order.dto;

import app.order.Order;
import app.order.audit.AuditTrail;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;

/** BR-15: each audit entry reports the quote its stage was priced against. */
@Tag("unit")
class OrderAuditEntryResponseTest {

    private static final OffsetDateTime RECORDED = OffsetDateTime.parse("2026-01-05T15:00:01Z");

    private static AuditTrail entry(String eventType) {
        AuditTrail entry = new AuditTrail();
        entry.setOrderId(9);
        entry.setEventType(eventType);
        entry.setDetail("detail");
        entry.setRecordedAt(RECORDED);
        return entry;
    }

    private static Order order() {
        Order order = new Order();
        order.setOrderId(9);
        order.setIndicativePrice(new BigDecimal("100.00"));
        order.setReferencePrice(new BigDecimal("100.50"));
        order.setTriggerPrice(new BigDecimal("101.00"));
        order.setExecutionPrice(new BigDecimal("101.25"));
        return order;
    }

    @Test
    void submissionStagesCarryTheAuthoritativeSubmissionQuote() {
        for (String stage : new String[] {"PENDING", "ACCEPTED", "REJECTED", "CANCELLED", "EXECUTION_FAILED"}) {
            OrderAuditEntryResponse response = OrderAuditEntryResponse.from(entry(stage), order());
            assertEquals(new BigDecimal("100.50"), response.price(), stage);
            assertEquals(stage, response.eventType());
            assertEquals(RECORDED, response.occurredAt());
            assertEquals("detail", response.detail());
        }
    }

    @Test
    void aFillCarriesTheExecutionQuoteAndATriggerItsActivationQuote() {
        assertEquals(new BigDecimal("101.25"), OrderAuditEntryResponse.from(entry("FILLED"), order()).price());
        assertEquals(new BigDecimal("101.00"), OrderAuditEntryResponse.from(entry("TRIGGERED"), order()).price());
    }

    @Test
    void aLegacyOrderWithoutServerQuotesFallsBackToTheIndicativePrice() {
        Order legacy = new Order();
        legacy.setIndicativePrice(new BigDecimal("100.00"));

        for (String stage : new String[] {"PENDING", "FILLED", "TRIGGERED"}) {
            assertEquals(new BigDecimal("100.00"), OrderAuditEntryResponse.from(entry(stage), legacy).price(), stage);
        }
    }
}
