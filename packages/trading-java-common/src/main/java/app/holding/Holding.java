package app.holding;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * Cached current quantity an account holds of one instrument. This is a
 * cache (BR-15) — the source of truth is the append-only
 * {@code holding_movements} ledger it's reconciled against; order execution
 * must update it by inserting a movement row, never by writing this field
 * directly.
 */
@Entity
@Table(name = "holdings")
public class Holding {

    /** Creates an instance of this class. */
    public Holding() {
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "holding_id", updatable = false, nullable = false)
    private Integer holdingId;

    @Column(name = "account_id", nullable = false, updatable = false)
    private Integer accountId;

    @Column(name = "instrument_id", nullable = false, updatable = false)
    private Integer instrumentId;

    @Column(nullable = false)
    private BigDecimal quantity = BigDecimal.ZERO;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    /**
     * Returns the holding ID.
     *
     * @return the holding ID
     */
    public Integer getHoldingId() {
        return holdingId;
    }

    /**
     * Sets the holding ID.
     *
     * @param holdingId the holding ID
     */
    public void setHoldingId(Integer holdingId) {
        this.holdingId = holdingId;
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
     * Returns the updated at.
     *
     * @return the updated at
     */
    public OffsetDateTime getUpdatedAt() {
        return updatedAt;
    }

    /**
     * Sets the updated at.
     *
     * @param updatedAt the updated at
     */
    public void setUpdatedAt(OffsetDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}


