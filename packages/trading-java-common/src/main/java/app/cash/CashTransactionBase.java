package app.cash;

import jakarta.persistence.Column;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.MappedSuperclass;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * The columns of the {@code cash_transactions} ledger that both Java services
 * map. Each service's {@code CashTransaction} entity extends this class and
 * adds the reasons it books.
 *
 * <p>The ledger is append-only: never move a cached balance without also
 * inserting the matching row here in the same transaction.
 */
@MappedSuperclass
public abstract class CashTransactionBase {

    /** Creates an instance for a service's entity to extend. */
    protected CashTransactionBase() {
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "cash_transaction_id", updatable = false, nullable = false)
    private Integer cashTransactionId;

    @Column(name = "account_id", nullable = false, updatable = false)
    private Integer accountId;

    @Column(name = "fill_id", updatable = false, unique = true)
    private Integer fillId;

    /** Signed: positive is a credit, negative is a debit. */
    @Column(nullable = false, updatable = false)
    private BigDecimal amount;

    @Column(nullable = false, updatable = false)
    private String reason;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    /**
     * Returns the cash transaction ID.
     *
     * @return the cash transaction ID
     */
    public Integer getCashTransactionId() {
        return cashTransactionId;
    }

    /**
     * Sets the cash transaction ID.
     *
     * @param cashTransactionId the cash transaction ID
     */
    public void setCashTransactionId(Integer cashTransactionId) {
        this.cashTransactionId = cashTransactionId;
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
     * Returns the amount.
     *
     * @return the amount
     */
    public BigDecimal getAmount() {
        return amount;
    }

    /**
     * Sets the amount.
     *
     * @param amount the amount
     */
    public void setAmount(BigDecimal amount) {
        this.amount = amount;
    }

    /**
     * Returns the reason.
     *
     * @return the reason
     */
    public String getReason() {
        return reason;
    }

    /**
     * Sets the reason.
     *
     * @param reason the reason
     */
    public void setReason(String reason) {
        this.reason = reason;
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


