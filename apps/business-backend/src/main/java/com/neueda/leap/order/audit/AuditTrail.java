package com.neueda.leap.order.audit;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;

/**
 * One row per order-lifecycle event. Permanent record (BR-14/15, section
 * 9.4) — the application's database role should have INSERT/SELECT only on
 * this table, never UPDATE/DELETE, so nothing in this codebase should ever
 * modify an {@code AuditTrail} row after creating it.
 */
@Entity
@Table(name = "audit_trail")
public class AuditTrail {

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
