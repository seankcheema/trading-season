package app.order.dto;

import app.order.Order;
import app.order.audit.AuditTrail;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * One immutable lifecycle entry for an order history audit trail, with the
 * quote that stage was priced against (BR-15).
 *
 * @param eventType the recorded lifecycle event, such as PENDING or FILLED
 * @param price the quote this stage was priced against: the execution quote for
 *              FILLED, the activation quote for TRIGGERED, otherwise the
 *              authoritative submission quote; an order placed before server
 *              quotes existed reports its indicative price
 * @param occurredAt when the event was durably recorded
 * @param detail optional reason or execution detail recorded with the event
 */
public record OrderAuditEntryResponse(
        String eventType,
        BigDecimal price,
        OffsetDateTime occurredAt,
        String detail
) {
    /**
     * Maps a persisted audit entry, choosing the quote its stage was priced
     * against from the order it belongs to.
     *
     * @param entry the persisted immutable audit entry
     * @param order the order the entry belongs to
     * @return the API representation of that entry
     */
    public static OrderAuditEntryResponse from(AuditTrail entry, Order order) {
        return new OrderAuditEntryResponse(
                entry.getEventType(), quoteFor(entry.getEventType(), order), entry.getRecordedAt(), entry.getDetail());
    }

    private static BigDecimal quoteFor(String eventType, Order order) {
        BigDecimal quote = switch (eventType) {
            case Order.STATUS_FILLED -> order.getExecutionPrice();
            case "TRIGGERED" -> order.getTriggerPrice();
            default -> order.getReferencePrice();
        };
        return quote != null ? quote : order.getIndicativePrice();
    }
}
