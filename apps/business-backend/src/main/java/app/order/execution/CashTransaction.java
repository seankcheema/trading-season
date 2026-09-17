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
 * One append-only cash movement (BR-09/14/15). {@code accounts.cash_balance}
 * is cached from and must reconcile against this ledger — never write the
 * cached balance without also inserting the matching row here in the same
 * transaction.
 */
@Entity
@Table(name = "cash_transactions")
public class CashTransaction {

    public static final String REASON_ORDER_FILL = "ORDER_FILL";

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

    public Integer getCashTransactionId() {
        return cashTransactionId;
    }

    public void setCashTransactionId(Integer cashTransactionId) {
        this.cashTransactionId = cashTransactionId;
    }

    public Integer getAccountId() {
        return accountId;
    }

    public void setAccountId(Integer accountId) {
        this.accountId = accountId;
    }

    public Integer getFillId() {
        return fillId;
    }

    public void setFillId(Integer fillId) {
        this.fillId = fillId;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public void setAmount(BigDecimal amount) {
        this.amount = amount;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(OffsetDateTime createdAt) {
        this.createdAt = createdAt;
    }
}


