package app.order.execution;

import app.holding.HoldingMovementBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;

/**
 * One append-only position change caused by a fill (BR-09/14/15).
 * {@code holdings.quantity} is cached from and must reconcile against this
 * ledger — never write the cached quantity without also inserting the
 * matching row here in the same transaction.
 */
@Entity
@Table(name = "holding_movements")
public class HoldingMovement extends HoldingMovementBase {

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    /** Creates an instance of this class. */
    public HoldingMovement() {
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
