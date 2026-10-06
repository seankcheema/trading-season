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
 * <p>Lifecycle (KAN-93, see V004__Order_status_lifecycle.sql):
 * {@code PENDING -> REJECTED} when a trading rule fails, otherwise
 * {@code PENDING -> FILLED} once the fill is written and the user's
 * available funds and the account's holdings have moved. This entity is
 * persisted as {@code PENDING} the moment a request is received, before
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
}


