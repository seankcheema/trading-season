package app.holding;

import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/**
 * One append-only change to a position (BR-15): the ledger the cached
 * {@link Holding} quantity is derived from.
 *
 * <p>Read here to derive what a position cost. Each movement names the account,
 * the instrument and the fill it came from, so joining it to {@link Fill} gives
 * the price paid for a quantity without needing the orders table.
 */
@Entity
@Table(name = "holding_movements")
public class HoldingMovement extends HoldingMovementBase {

    /** Creates an empty movement for the persistence provider to populate. */
    public HoldingMovement() {
    }
}
