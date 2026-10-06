package app.order;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * A client's buy/sell instruction, tracked through its own status lifecycle
 * (BR-04/05/06) — deliberately separate from execution, which lives in
 * {@code order.execution.Fill}.
 *
 * <p>Lifecycle (KAN-93, BR-06): {@code PENDING -> REJECTED} when a trading
 * rule fails, otherwise {@code PENDING -> ACCEPTED}, committed on its own as
 * the firm's record of intent, then {@code ACCEPTED -> FILLED} once the fill
 * is written and the user's available funds and the account's holdings have
 * moved, or {@code ACCEPTED -> REJECTED} if the re-check under the row lock
 * fails. Execution runs in a separate transaction, so an order whose
 * execution fails unexpectedly stays {@code ACCEPTED} on record. This entity
 * is persisted as {@code PENDING} the moment a request is received, before
 * the trading-rule pipeline runs, so a rejected order still leaves a record.
 */
@Entity
@Table(name = "orders")
public class Order {

    public static final String TYPE_BUY = "BUY";
    public static final String TYPE_SELL = "SELL";

    /** Created and awaiting the trading-rule pipeline. */
    public static final String STATUS_PENDING = "PENDING";
    /**
     * Passed the trading rules and committed as a firm commitment before
     * execution (BR-06). Execution follows in its own transaction; an order
     * stays here if that execution fails unexpectedly.
     */
    public static final String STATUS_ACCEPTED = "ACCEPTED";
    /**
     * Final state of a successful order: the fill, funds movement and
     * holding movement have been written.
     */
    public static final String STATUS_FILLED = "FILLED";
    /** Final state of an order that failed a trading rule. */
    public static final String STATUS_REJECTED = "REJECTED";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "order_id", updatable = false, nullable = false)
    private Integer orderId;

    @Column(name = "account_id", nullable = false, updatable = false)
    private Integer accountId;

    @Column(name = "instrument_id", nullable = false, updatable = false)
    private Integer instrumentId;

    /** Client-supplied idempotency key stopping duplicate submissions on retry (section 9.1). */
    @Column(name = "client_reference", nullable = false, updatable = false)
    private UUID clientReference;

    @Column(name = "order_type", nullable = false, updatable = false)
    private String orderType;

    @Column(nullable = false)
    private String status = STATUS_PENDING;

    @Column(nullable = false, updatable = false)
    private BigDecimal quantity;

    /** BR-13: the price shown to the trader before they submitted — acquired from the client. */
    @Column(name = "indicative_price", updatable = false)
    private BigDecimal indicativePrice;

    /** KAN-100: the trader's execution price tolerance, acquired from the client. */
    @Column(name = "buffer_percent", updatable = false)
    private BigDecimal bufferPercent;

    /** Set only when {@code status} is {@link #STATUS_REJECTED}. */
    @Column(name = "rejection_reason")
    private String rejectionReason;

    @Column(name = "submitted_at", nullable = false, updatable = false)
    private OffsetDateTime submittedAt;

    @Column(name = "accepted_at")
    private OffsetDateTime acceptedAt;

    @Column(name = "resolved_at")
    private OffsetDateTime resolvedAt;

    /** Selected market replay time; independent of real audit timestamps. */
    @Column(name = "simulated_at", updatable = false)
    private OffsetDateTime simulatedAt;

    /** Returns the selected simulation time.
     * @return simulated time, or null for submissions without replay context */
    public OffsetDateTime getSimulatedAt() { return simulatedAt; }

    /** Sets the selected simulation time.
     * @param simulatedAt selected replay time, including backdated submissions */
    public void setSimulatedAt(OffsetDateTime simulatedAt) { this.simulatedAt = simulatedAt; }

    public Integer getOrderId() {
        return orderId;
    }

    public void setOrderId(Integer orderId) {
        this.orderId = orderId;
    }

    public Integer getAccountId() {
        return accountId;
    }

    public void setAccountId(Integer accountId) {
        this.accountId = accountId;
    }

    public Integer getInstrumentId() {
        return instrumentId;
    }

    public void setInstrumentId(Integer instrumentId) {
        this.instrumentId = instrumentId;
    }

    public UUID getClientReference() {
        return clientReference;
    }

    public void setClientReference(UUID clientReference) {
        this.clientReference = clientReference;
    }

    public String getOrderType() {
        return orderType;
    }

    public void setOrderType(String orderType) {
        this.orderType = orderType;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public BigDecimal getQuantity() {
        return quantity;
    }

    public void setQuantity(BigDecimal quantity) {
        this.quantity = quantity;
    }

    public BigDecimal getIndicativePrice() {
        return indicativePrice;
    }

    public void setIndicativePrice(BigDecimal indicativePrice) {
        this.indicativePrice = indicativePrice;
    }

    public BigDecimal getBufferPercent() {
        return bufferPercent;
    }

    public void setBufferPercent(BigDecimal bufferPercent) {
        this.bufferPercent = bufferPercent;
    }

    public String getRejectionReason() {
        return rejectionReason;
    }

    public void setRejectionReason(String rejectionReason) {
        this.rejectionReason = rejectionReason;
    }

    public OffsetDateTime getSubmittedAt() {
        return submittedAt;
    }

    public void setSubmittedAt(OffsetDateTime submittedAt) {
        this.submittedAt = submittedAt;
    }

    public OffsetDateTime getAcceptedAt() {
        return acceptedAt;
    }

    public void setAcceptedAt(OffsetDateTime acceptedAt) {
        this.acceptedAt = acceptedAt;
    }

    public OffsetDateTime getResolvedAt() {
        return resolvedAt;
    }

    public void setResolvedAt(OffsetDateTime resolvedAt) {
        this.resolvedAt = resolvedAt;
    }
}


