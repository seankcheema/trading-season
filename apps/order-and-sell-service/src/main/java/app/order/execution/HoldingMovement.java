package app.order.execution;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * One append-only position change caused by a fill (BR-09/14/15).
 * {@code holdings.quantity} is cached from and must reconcile against this
 * ledger — never write the cached quantity without also inserting the
 * matching row here in the same transaction.
 */
@Entity
@Table(name = "holding_movements")
public class HoldingMovement {

    /** Creates an instance of this class. */
    public HoldingMovement() {
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "holding_movement_id", updatable = false, nullable = false)
    private Integer holdingMovementId;

    @Column(name = "account_id", nullable = false, updatable = false)
    private Integer accountId;

    @Column(name = "instrument_id", nullable = false, updatable = false)
    private Integer instrumentId;

    @Column(name = "fill_id", nullable = false, updatable = false, unique = true)
    private Integer fillId;

    /** Signed: positive for BUY, negative for SELL. */
    @Column(name = "quantity_delta", nullable = false, updatable = false)
    private BigDecimal quantityDelta;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    /**
     * Returns the holding movement ID.
     *
     * @return the holding movement ID
     */
    public Integer getHoldingMovementId() {
        return holdingMovementId;
    }

    /**
     * Sets the holding movement ID.
     *
     * @param holdingMovementId the holding movement ID
     */
    public void setHoldingMovementId(Integer holdingMovementId) {
        this.holdingMovementId = holdingMovementId;
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
     * Returns the fill ID.
     *
     * @return the fill ID
     */
    public Integer getFillId() {
        return fillId;
    }

    /**
     * Sets the fill ID.
     *
     * @param fillId the fill ID
     */
    public void setFillId(Integer fillId) {
        this.fillId = fillId;
    }

    /**
     * Returns the quantity delta.
     *
     * @return the quantity delta
     */
    public BigDecimal getQuantityDelta() {
        return quantityDelta;
    }

    /**
     * Sets the quantity delta.
     *
     * @param quantityDelta the quantity delta
     */
    public void setQuantityDelta(BigDecimal quantityDelta) {
        this.quantityDelta = quantityDelta;
    }

    /**
     * Returns the created at.
     *
     * @return the created at
     */
    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    /**
     * Sets the created at.
     *
     * @param createdAt the created at
     */
    public void setCreatedAt(OffsetDateTime createdAt) {
        this.createdAt = createdAt;
    }
}


