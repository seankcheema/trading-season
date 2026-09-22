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

    public Integer getHoldingMovementId() {
        return holdingMovementId;
    }

    public void setHoldingMovementId(Integer holdingMovementId) {
        this.holdingMovementId = holdingMovementId;
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

    public Integer getFillId() {
        return fillId;
    }

    public void setFillId(Integer fillId) {
        this.fillId = fillId;
    }

    public BigDecimal getQuantityDelta() {
        return quantityDelta;
    }

    public void setQuantityDelta(BigDecimal quantityDelta) {
        this.quantityDelta = quantityDelta;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(OffsetDateTime createdAt) {
        this.createdAt = createdAt;
    }
}


