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
 * execution fails unexpectedly stays {@code ACCEPTED} on record, with its reservation,
 * for bounded-backoff retry. Conditional orders also remain ACCEPTED until eligible
 * or cancelled; triggering is recorded separately from status. This entity
 * is persisted as {@code PENDING} the moment a request is received, before
 * the trading-rule pipeline runs, so a rejected order still leaves a record.
 */
@Entity
@Table(name = "orders")
public class Order {

    /** Creates an instance of this class. */
    public Order() {
    }

    /** Order type for a purchase. */
    public static final String TYPE_BUY = "BUY";
    /** Order type for a sale. */
    public static final String TYPE_SELL = "SELL";

    /** Created and awaiting the trading-rule pipeline. */
    public static final String STATUS_PENDING = "PENDING";
    /**
     * Passed the trading rules and committed as a firm commitment before
     * execution (BR-06). Execution follows in its own transaction; an order
     * stays here while conditions are unmet or settlement is retryable.
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

    /** The saved user execution preference snapshotted at submission. */
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
     * Returns the account ID.
     *
     * @return the account ID
     */
    public Integer getAccountId() {
        return accountId;
    }

    /**
     * Sets the account ID.
     *
     * @param accountId the account ID
     */
    public void setAccountId(Integer accountId) {
        this.accountId = accountId;
    }

    /**
     * Returns the instrument ID.
     *
     * @return the instrument ID
     */
    public Integer getInstrumentId() {
        return instrumentId;
    }

    /**
     * Sets the instrument ID.
     *
     * @param instrumentId the instrument ID
     */
    public void setInstrumentId(Integer instrumentId) {
        this.instrumentId = instrumentId;
    }

    /**
     * Returns the client reference.
     *
     * @return the client reference
     */
    public UUID getClientReference() {
        return clientReference;
    }

    /**
     * Sets the client reference.
     *
     * @param clientReference the client reference
     */
    public void setClientReference(UUID clientReference) {
        this.clientReference = clientReference;
    }

    /**
     * Returns the order type.
     *
     * @return the order type
     */
    public String getOrderType() {
        return orderType;
    }

    /**
     * Sets the order type.
     *
     * @param orderType the order type
     */
    public void setOrderType(String orderType) {
        this.orderType = orderType;
    }

    /**
     * Returns the status.
     *
     * @return the status
     */
    public String getStatus() {
        return status;
    }

    /**
     * Sets the status.
     *
     * @param status the status
     */
    public void setStatus(String status) {
        this.status = status;
    }

    /**
     * Returns the quantity.
     *
     * @return the quantity
     */
    public BigDecimal getQuantity() {
        return quantity;
    }

    /**
     * Sets the quantity.
     *
     * @param quantity the quantity
     */
    public void setQuantity(BigDecimal quantity) {
        this.quantity = quantity;
    }

    /**
     * Returns the indicative price.
     *
     * @return the indicative price
     */
    public BigDecimal getIndicativePrice() {
        return indicativePrice;
    }

    /**
     * Sets the indicative price.
     *
     * @param indicativePrice the indicative price
     */
    public void setIndicativePrice(BigDecimal indicativePrice) {
        this.indicativePrice = indicativePrice;
    }

    /**
     * Returns the buffer percent.
     *
     * @return the buffer percent
     */
    public BigDecimal getBufferPercent() {
        return bufferPercent;
    }

    /**
     * Sets the buffer percent.
     *
     * @param bufferPercent the buffer percent
     */
    public void setBufferPercent(BigDecimal bufferPercent) {
        this.bufferPercent = bufferPercent;
    }

    /**
     * Returns the rejection reason.
     *
     * @return the rejection reason
     */
    public String getRejectionReason() {
        return rejectionReason;
    }

    /**
     * Sets the rejection reason.
     *
     * @param rejectionReason the rejection reason
     */
    public void setRejectionReason(String rejectionReason) {
        this.rejectionReason = rejectionReason;
    }

    /**
     * Returns the submitted at.
     *
     * @return the submitted at
     */
    public OffsetDateTime getSubmittedAt() {
        return submittedAt;
    }

    /**
     * Sets the submitted at.
     *
     * @param submittedAt the submitted at
     */
    public void setSubmittedAt(OffsetDateTime submittedAt) {
        this.submittedAt = submittedAt;
    }

    /**
     * Returns the accepted at.
     *
     * @return the accepted at
     */
    public OffsetDateTime getAcceptedAt() {
        return acceptedAt;
    }

    /**
     * Sets the accepted at.
     *
     * @param acceptedAt the accepted at
     */
    public void setAcceptedAt(OffsetDateTime acceptedAt) {
        this.acceptedAt = acceptedAt;
    }

    /**
     * Returns the resolved at.
     *
     * @return the resolved at
     */
    public OffsetDateTime getResolvedAt() {
        return resolvedAt;
    }

    /**
     * Sets the resolved at.
     *
     * @param resolvedAt the resolved at
     */
    public void setResolvedAt(OffsetDateTime resolvedAt) {
        this.resolvedAt = resolvedAt;
    }
    /** Final state of an order cancelled before execution. */
    public static final String STATUS_CANCELLED = "CANCELLED";
    @Column(name = "execution_type")
    private String executionType = "MARKET";
    /** Returns executionType.
     * @return persisted executionType */
    public String getExecutionType() { return executionType; }
    /** Sets executionType.
     * @param value new executionType */
    public void setExecutionType(String value) { this.executionType = value; }
    @Column(name = "limit_price", precision = 18, scale = 6)
    private BigDecimal limitPrice = null;
    /** Returns limitPrice.
     * @return persisted limitPrice */
    public BigDecimal getLimitPrice() { return limitPrice; }
    /** Sets limitPrice.
     * @param value new limitPrice */
    public void setLimitPrice(BigDecimal value) { this.limitPrice = value; }
    @Column(name = "stop_price", precision = 18, scale = 6)
    private BigDecimal stopPrice = null;
    /** Returns stopPrice.
     * @return persisted stopPrice */
    public BigDecimal getStopPrice() { return stopPrice; }
    /** Sets stopPrice.
     * @param value new stopPrice */
    public void setStopPrice(BigDecimal value) { this.stopPrice = value; }
    @Column(name = "reference_price", precision = 18, scale = 6)
    private BigDecimal referencePrice = null;
    /** Returns referencePrice.
     * @return persisted referencePrice */
    public BigDecimal getReferencePrice() { return referencePrice; }
    /** Sets referencePrice.
     * @param value new referencePrice */
    public void setReferencePrice(BigDecimal value) { this.referencePrice = value; }
    @Column(name = "reference_at")
    private OffsetDateTime referenceAt = null;
    /** Returns referenceAt.
     * @return persisted referenceAt */
    public OffsetDateTime getReferenceAt() { return referenceAt; }
    /** Sets referenceAt.
     * @param value new referenceAt */
    public void setReferenceAt(OffsetDateTime value) { this.referenceAt = value; }
    @Column(name = "session_id")
    private Long sessionId = null;
    /** Returns sessionId.
     * @return persisted sessionId */
    public Long getSessionId() { return sessionId; }
    /** Sets sessionId.
     * @param value new sessionId */
    public void setSessionId(Long value) { this.sessionId = value; }
    /** Authoritative activation quote, distinct from the immutable submission quote. */
    @Column(name = "trigger_price", precision = 24, scale = 6)
    private BigDecimal triggerPrice;
    /** Returns the latched stop activation quote.
     * @return trigger quote, or null before activation or for legacy orders */
    public BigDecimal getTriggerPrice() { return triggerPrice; }
    /** Records the first stop activation quote.
     * @param value authoritative trigger price */
    public void setTriggerPrice(BigDecimal value) { this.triggerPrice = value; }

    @Column(name = "triggered_at")
    private OffsetDateTime triggeredAt = null;
    /** Returns triggeredAt.
     * @return persisted triggeredAt */
    public OffsetDateTime getTriggeredAt() { return triggeredAt; }
    /** Sets triggeredAt.
     * @param value new triggeredAt */
    public void setTriggeredAt(OffsetDateTime value) { this.triggeredAt = value; }
    @Column(name = "evaluated_at")
    private OffsetDateTime evaluatedAt = null;
    /** Returns evaluatedAt.
     * @return persisted evaluatedAt */
    public OffsetDateTime getEvaluatedAt() { return evaluatedAt; }
    /** Sets evaluatedAt.
     * @param value new evaluatedAt */
    public void setEvaluatedAt(OffsetDateTime value) { this.evaluatedAt = value; }
    @Column(name = "reserved_cash", precision = 24, scale = 6)
    private BigDecimal reservedCash = BigDecimal.ZERO;
    /** Returns reservedCash.
     * @return persisted reservedCash */
    public BigDecimal getReservedCash() { return reservedCash; }
    /** Sets reservedCash.
     * @param value new reservedCash */
    public void setReservedCash(BigDecimal value) { this.reservedCash = value; }
    @Column(name = "reserved_shares", precision = 14, scale = 4)
    private BigDecimal reservedShares = BigDecimal.ZERO;
    /** Returns reservedShares.
     * @return persisted reservedShares */
    public BigDecimal getReservedShares() { return reservedShares; }
    /** Sets reservedShares.
     * @param value new reservedShares */
    public void setReservedShares(BigDecimal value) { this.reservedShares = value; }
    @Column(name = "execution_price", precision = 18, scale = 6)
    private BigDecimal executionPrice = null;
    /** Returns executionPrice.
     * @return persisted executionPrice */
    public BigDecimal getExecutionPrice() { return executionPrice; }
    /** Sets executionPrice.
     * @param value new executionPrice */
    public void setExecutionPrice(BigDecimal value) { this.executionPrice = value; }
    @Column(name = "rejection_code")
    private String rejectionCode = null;
    /** Returns rejectionCode.
     * @return persisted rejectionCode */
    public String getRejectionCode() { return rejectionCode; }
    /** Sets rejectionCode.
     * @param value new rejectionCode */
    public void setRejectionCode(String value) { this.rejectionCode = value; }
    @Column(name = "retry_after")
    private OffsetDateTime retryAfter = null;
    /** Returns retryAfter.
     * @return persisted retryAfter */
    public OffsetDateTime getRetryAfter() { return retryAfter; }
    /** Sets retryAfter.
     * @param value new retryAfter */
    public void setRetryAfter(OffsetDateTime value) { this.retryAfter = value; }
    @Column(name = "execution_attempts")
    private Integer executionAttempts = 0;
    /** Returns executionAttempts.
     * @return persisted executionAttempts */
    public Integer getExecutionAttempts() { return executionAttempts; }
    /** Sets executionAttempts.
     * @param value new executionAttempts */
    public void setExecutionAttempts(Integer value) { this.executionAttempts = value; }
}
