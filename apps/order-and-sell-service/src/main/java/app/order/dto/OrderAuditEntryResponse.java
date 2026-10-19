package app.order.dto;

import app.order.audit.AuditTrail;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * One immutable lifecycle entry for an order history audit trail.
 *
 * @param eventType the recorded lifecycle event, such as PENDING or FILLED
 * @param price the order's submitted price, retained for each timeline stage
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
     * Maps a persisted audit entry while keeping the order price beside every
     * lifecycle stage for clients rendering a timeline.
     *
     * @param entry the persisted immutable audit entry
     * @param price the order's submitted price
     * @return the API representation of that entry
     */
    public static OrderAuditEntryResponse from(AuditTrail entry, BigDecimal price) {
        return new OrderAuditEntryResponse(
                entry.getEventType(), price, entry.getRecordedAt(), entry.getDetail());
    }
}
