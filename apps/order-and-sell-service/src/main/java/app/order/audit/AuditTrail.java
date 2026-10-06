package app.order.audit;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;

/**
 * One row per order-lifecycle event. Permanent record (BR-14/15, section
 * 9.4): migration V010 rejects any UPDATE, DELETE or TRUNCATE on this table,
 * so nothing in this codebase may modify an {@code AuditTrail} row after
 * creating it. Each row's detail is written to stand on its own as the
 * record of that event; see {@code docs/reference/trade-record.md}.
 */
@Entity
@Table(name = "audit_trail")
public class AuditTrail {

    /**
     * The order passed the trading-rule pipeline and was accepted for
     * execution. It is an audit event, not an order status: the order itself
     * stays {@code PENDING} until execution resolves it.
     */
    public static final String EVENT_ACCEPTED = "ACCEPTED";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "audit_id", updatable = false, nullable = false)
    private Integer auditId;

    @Column(name = "order_id", nullable = false, updatable = false)
    private Integer orderId;

    @Column(name = "event_type", nullable = false, updatable = false)
    private String eventType;

    @Column(updatable = false)
    private String detail;

    @Column(name = "recorded_at", nullable = false, updatable = false)
    private OffsetDateTime recordedAt;

    public Integer getAuditId() {
        return auditId;
    }

    public void setAuditId(Integer auditId) {
        this.auditId = auditId;
    }

    public Integer getOrderId() {
        return orderId;
    }

    public void setOrderId(Integer orderId) {
        this.orderId = orderId;
    }

    public String getEventType() {
        return eventType;
    }

    public void setEventType(String eventType) {
        this.eventType = eventType;
    }

    public String getDetail() {
        return detail;
    }

    public void setDetail(String detail) {
        this.detail = detail;
    }

    public OffsetDateTime getRecordedAt() {
        return recordedAt;
    }

    public void setRecordedAt(OffsetDateTime recordedAt) {
        this.recordedAt = recordedAt;
    }
}


