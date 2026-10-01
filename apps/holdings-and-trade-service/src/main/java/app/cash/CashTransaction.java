package app.cash;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

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
public class CashTransaction {

    /** A deposit of funds: {@code amount} is positive. */
    public static final String REASON_DEPOSIT = "DEPOSIT";

    /** A withdrawal of funds: {@code amount} is negative. */
    public static final String REASON_WITHDRAWAL = "WITHDRAWAL";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "cash_transaction_id", updatable = false, nullable = false)
    private Integer cashTransactionId;

    @Column(name = "account_id", nullable = false, updatable = false)
    private Integer accountId;

    /** Null for a deposit or withdrawal; set only for an {@code ORDER_FILL}. */
    @Column(name = "fill_id", updatable = false, unique = true)
    private Integer fillId;

    /** Signed: positive is a credit, negative is a debit. */
    @Column(nullable = false, updatable = false)
    private BigDecimal amount;

    @Column(nullable = false, updatable = false)
    private String reason;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    /** Creates an empty ledger row for the persistence provider to populate. */
    public CashTransaction() {
    }

    /**
     * Returns the ledger row id.
     *
     * @return the transaction id, or null before the row is inserted
     */
    public Integer getCashTransactionId() {
        return cashTransactionId;
    }

    /**
     * Sets the ledger row id.
     *
     * @param cashTransactionId the transaction id
     */
    public void setCashTransactionId(Integer cashTransactionId) {
        this.cashTransactionId = cashTransactionId;
    }

    /**
     * Returns the account this row is booked against.
     *
     * @return the account id
     */
    public Integer getAccountId() {
        return accountId;
    }

    /**
     * Sets the account this row is booked against.
     *
     * @param accountId the account id
     */
    public void setAccountId(Integer accountId) {
        this.accountId = accountId;
    }

    /**
     * Returns the fill this movement settled, for an order fill.
     *
     * @return the fill id, or null for a deposit or withdrawal
     */
    public Integer getFillId() {
        return fillId;
    }

    /**
     * Sets the fill this movement settled.
     *
     * @param fillId the fill id, or null for a deposit or withdrawal
     */
    public void setFillId(Integer fillId) {
        this.fillId = fillId;
    }

    /**
     * Returns the signed amount: positive is a credit, negative a debit.
     *
     * @return the signed amount
     */
    public BigDecimal getAmount() {
        return amount;
    }

    /**
     * Sets the signed amount.
     *
     * @param amount the signed amount, positive for a credit and negative for a debit
     */
    public void setAmount(BigDecimal amount) {
        this.amount = amount;
    }

    /**
     * Returns why the cash moved.
     *
     * @return {@code DEPOSIT}, {@code WITHDRAWAL} or {@code ORDER_FILL}
     */
    public String getReason() {
        return reason;
    }

    /**
     * Sets why the cash moved.
     *
     * @param reason {@code DEPOSIT}, {@code WITHDRAWAL} or {@code ORDER_FILL}
     */
    public void setReason(String reason) {
        this.reason = reason;
    }

    /**
     * Returns when the movement was recorded.
     *
     * @return the creation instant
     */
    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    /**
     * Sets when the movement was recorded.
     *
     * @param createdAt the creation instant
     */
    public void setCreatedAt(OffsetDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
