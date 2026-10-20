package app.order.audit;

import app.record.AuditEntryRecord;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;

/**
 * Appends one order-lifecycle event to the audit trail. Every status
 * transition {@code OrderService}/{@code OrderExecutionService} makes to an
 * order should be paired with a call here in the same transaction.
 *
 * <p>Each entry is also raised as an {@link AuditEntryRecord}, which
 * {@link app.record.PlatformRecordPublisher} sends to Kafka once the
 * transaction has committed, so the reporting service can show an order's
 * trail without reading this table.
 */
@Service
public class AuditTrailService {

    private final AuditTrailRepository auditTrailRepository;
    private final ApplicationEventPublisher events;

    /**
     * Creates the service.
     *
     * @param auditTrailRepository persistence for audit rows
     * @param events               publisher of the {@link AuditEntryRecord} raised for each entry
     */
    public AuditTrailService(AuditTrailRepository auditTrailRepository, ApplicationEventPublisher events) {
        this.auditTrailRepository = auditTrailRepository;
        this.events = events;
    }

    /**
     * Records one lifecycle event.
     *
     * @param orderId   the order the event belongs to
     * @param eventType one of {@link app.order.Order}'s STATUS_* constants
     * @param detail    optional human-readable context, e.g. the submitted terms,
     *                  the pricing decision, or a rejection reason
     */
    public void record(Integer orderId, String eventType, String detail) {
        AuditTrail entry = new AuditTrail();
        entry.setOrderId(orderId);
        entry.setEventType(eventType);
        entry.setDetail(detail);
        entry.setRecordedAt(OffsetDateTime.now());
        auditTrailRepository.save(entry);
        events.publishEvent(AuditEntryRecord.from(entry));
    }
}


