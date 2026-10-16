package app.cash;

import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/**
 * One append-only cash movement (BR-09/14/15).
 *
 * <p>The ledger is the source of truth for cash; the balance it backs is the
 * owning user's {@code users.available_funds}. Never move that balance without
 * inserting the matching row here in the same transaction.
 *
 * <p>A row is keyed by an account because the schema requires one, but cash
 * belongs to the user and every account of theirs shares it. A deposit or
 * withdrawal is booked against the user's first account; an {@code ORDER_FILL}
 * row is booked against the account the order was placed for.
 */
@Entity
@Table(name = "cash_transactions")
public class CashTransaction extends CashTransactionBase {

    /** A deposit of funds: {@code amount} is positive. */
    public static final String REASON_DEPOSIT = "DEPOSIT";

    /** A withdrawal of funds: {@code amount} is negative. */
    public static final String REASON_WITHDRAWAL = "WITHDRAWAL";

    /** Creates an empty ledger row for the persistence provider to populate. */
    public CashTransaction() {
    }
}
