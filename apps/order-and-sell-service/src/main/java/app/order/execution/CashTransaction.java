package app.order.execution;

import app.cash.CashTransactionBase;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/**
 * One append-only cash movement (BR-09/14/15). Never move a cached balance
 * without also inserting the matching row here in the same transaction.
 * Since KAN-93 the balance an order fill moves is the owning user's
 * {@code users.available_funds}; the row is still keyed by the account the
 * order was placed against.
 */
@Entity
@Table(name = "cash_transactions")
public class CashTransaction extends CashTransactionBase {

    /** Reason recorded on cash transactions created by an order fill. */
    public static final String REASON_ORDER_FILL = "ORDER_FILL";

    /** Creates an instance of this class. */
    public CashTransaction() {
    }
}
