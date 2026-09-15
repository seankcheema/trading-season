package com.neueda.leap.order.audit;

import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;

/**
 * Appends one order-lifecycle event to the audit trail. Every status
 * transition {@code OrderService}/{@code OrderExecutionService} makes to an
 * order should be paired with a call here in the same transaction.
 */
@Service
public class AuditTrailService {

    private final AuditTrailRepository auditTrailRepository;

    public AuditTrailService(AuditTrailRepository auditTrailRepository) {
        this.auditTrailRepository = auditTrailRepository;
    }

    /**
     * Records one lifecycle event.
     *
     * @param orderId   the order the event belongs to
     * @param eventType one of {@link com.neueda.leap.order.Order}'s STATUS_* constants
     * @param detail    optional human-readable context, e.g. a rejection reason
     */
    public void record(Integer orderId, String eventType, String detail) {
        AuditTrail entry = new AuditTrail();
        entry.setOrderId(orderId);
        entry.setEventType(eventType);
        entry.setDetail(detail);
        entry.setRecordedAt(OffsetDateTime.now());
        auditTrailRepository.save(entry);
    }
}
