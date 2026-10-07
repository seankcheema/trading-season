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

    /** Creates an instance of this class. */
    public AuditTrail() {
    }

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

    /**
     * Returns the audit ID.
     *
     * @return the audit ID
     */
    public Integer getAuditId() {
        return auditId;
    }

    /**
     * Sets the audit ID.
     *
     * @param auditId the audit ID
     */
    public void setAuditId(Integer auditId) {
        this.auditId = auditId;
    }

    /**
     * Returns the order ID.
     *
     * @return the order ID
     */
    public Integer getOrderId() {
        return orderId;
    }

    /**
     * Sets the order ID.
     *
     * @param orderId the order ID
     */
    public void setOrderId(Integer orderId) {
        this.orderId = orderId;
    }

    /**
     * Returns the event type.
     *
     * @return the event type
     */
    public String getEventType() {
        return eventType;
    }

    /**
     * Sets the event type.
     *
     * @param eventType the event type
     */
    public void setEventType(String eventType) {
        this.eventType = eventType;
    }

    /**
     * Returns the detail.
     *
     * @return the detail
     */
    public String getDetail() {
        return detail;
    }

    /**
     * Sets the detail.
     *
     * @param detail the detail
     */
    public void setDetail(String detail) {
        this.detail = detail;
    }

    /**
     * Returns the recorded at.
     *
     * @return the recorded at
     */
    public OffsetDateTime getRecordedAt() {
        return recordedAt;
    }

    /**
     * Sets the recorded at.
     *
     * @param recordedAt the recorded at
     */
    public void setRecordedAt(OffsetDateTime recordedAt) {
        this.recordedAt = recordedAt;
    }
}


