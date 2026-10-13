package app.record;

import app.order.audit.AuditTrail;

import java.time.OffsetDateTime;

/**
 * One row of an order's audit trail, published as {@value #TYPE}. The trail
 * holds more than the order's statuses, an execution failure for one, so it
 * travels on its own instead of on the order status events.
 *
 * @param auditId    the audit row
 * @param orderId    the order the entry belongs to
 * @param eventType  what happened, for example {@code ACCEPTED} or {@code EXECUTION_FAILED}
 * @param detail     optional context such as a rejection reason, or {@code null}
 * @param recordedAt when the entry was written
 */
public record AuditEntryRecord(
        Integer auditId,
        Integer orderId,
        String eventType,
        String detail,
        OffsetDateTime recordedAt) implements PlatformRecord {

    /** The record type audit entries are published under. */
    public static final String TYPE = "ORDER_AUDIT";

    /**
     * Captures a saved audit row.
     *
     * @param entry the row after it was saved, so that it has its id
     * @return the record describing it
     */
    public static AuditEntryRecord from(AuditTrail entry) {
        return new AuditEntryRecord(entry.getAuditId(), entry.getOrderId(), entry.getEventType(),
                entry.getDetail(), entry.getRecordedAt());
    }

    @Override
    public String recordType() {
        return TYPE;
    }

    @Override
    public String recordId() {
        return String.valueOf(auditId);
    }
}
