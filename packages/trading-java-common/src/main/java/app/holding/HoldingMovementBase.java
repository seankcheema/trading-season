package app.holding;

import jakarta.persistence.Column;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.MappedSuperclass;

import java.math.BigDecimal;

/**
 * The columns of the {@code holding_movements} ledger that both Java services
 * map. Each service's {@code HoldingMovement} entity extends this class.
 *
 * <p>One append-only change to a position (BR-15): the ledger the cached
 * holding quantity is derived from. Each movement names the account, the
 * instrument and the fill it came from.
 */
@MappedSuperclass
public abstract class HoldingMovementBase {

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

    /** Signed: positive for a buy, negative for a sell. */
    @Column(name = "quantity_delta", nullable = false, updatable = false)
    private BigDecimal quantityDelta;

    /** Creates an instance for a service's entity to extend. */
    protected HoldingMovementBase() {
    }

    /**
     * Returns the movement id.
     *
     * @return the movement id, or null before the row is inserted
     */
    public Integer getHoldingMovementId() {
        return holdingMovementId;
    }

    /**
     * Sets the movement id.
     *
     * @param holdingMovementId the movement id
     */
    public void setHoldingMovementId(Integer holdingMovementId) {
        this.holdingMovementId = holdingMovementId;
    }

    /**
     * Returns the account whose position moved.
     *
     * @return the account id
     */
    public Integer getAccountId() {
        return accountId;
    }

    /**
     * Sets the account whose position moved.
     *
     * @param accountId the account id
     */
    public void setAccountId(Integer accountId) {
        this.accountId = accountId;
    }

    /**
     * Returns the instrument the position is in.
     *
     * @return the instrument id
     */
    public Integer getInstrumentId() {
        return instrumentId;
    }

    /**
     * Sets the instrument the position is in.
     *
     * @param instrumentId the instrument id
     */
    public void setInstrumentId(Integer instrumentId) {
        this.instrumentId = instrumentId;
    }

    /**
     * Returns the fill this movement came from.
     *
     * @return the fill id
     */
    public Integer getFillId() {
        return fillId;
    }

    /**
     * Sets the fill this movement came from.
     *
     * @param fillId the fill id
     */
    public void setFillId(Integer fillId) {
        this.fillId = fillId;
    }

    /**
     * Returns the signed change in quantity: positive for a buy, negative for a sell.
     *
     * @return the quantity delta
     */
    public BigDecimal getQuantityDelta() {
        return quantityDelta;
    }

    /**
     * Sets the signed change in quantity.
     *
     * @param quantityDelta the quantity delta, positive for a buy and negative for a sell
     */
    public void setQuantityDelta(BigDecimal quantityDelta) {
        this.quantityDelta = quantityDelta;
    }
}
