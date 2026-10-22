package app.cash;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

import java.util.UUID;

/**
 * One append-only cash movement (BR-09/14/15).
 *
 * <p>The ledger is the source of truth for cash; the balance it backs is the
 * owning user's {@code users.available_funds}. Never move that balance without
 * inserting the matching row here in the same transaction. The opening funds
 * a client registers with are booked here as their first deposit, so the
 * ledger sums to the balance from the start (BR-10).
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

    /**
     * The idempotency key the client sent with a deposit or withdrawal
     * (section 9.1). A repeat of the same key returns this row instead of
     * moving the cash again; the column is unique, so two concurrent repeats
     * cannot both post. Null on order fills and on rows written before V013.
     */
    @Column(name = "client_reference", updatable = false, unique = true)
    private UUID clientReference;

    /** Creates an empty ledger row for the persistence provider to populate. */
    public CashTransaction() {
    }

    /**
     * Returns the client's idempotency key for this movement.
     *
     * @return the client reference, or {@code null} for an order fill or a row older than V013
     */
    public UUID getClientReference() {
        return clientReference;
    }

    /**
     * Sets the client's idempotency key for this movement.
     *
     * @param clientReference the client reference
     */
    public void setClientReference(UUID clientReference) {
        this.clientReference = clientReference;
    }
}
