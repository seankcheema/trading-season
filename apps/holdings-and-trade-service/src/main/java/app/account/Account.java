package app.account;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/**
 * A brokerage/child account: the unit orders and holdings attach to/
 * A user can own more than one account (KAN-78, KAN-103/104)
 * Represents an account with an ID, name, balance, and ACTIVE or ARCHIVED lifecycle.
 * Archived accounts retain their identity and history but reject new financial activity.
 * <p>{@code cashBalance} is a cache (BR-10) reconciled against
 * {@code cash_transactions} - order execution must update it by
 * inserting a ledger row, never by writing this field directly.
 */
@Entity
@Table(name = "accounts")
public class Account extends AccountBase {

    @Column(nullable = false)
    private String name;

    /** Creates an instance of this class. */
    public Account() {
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "account_id", updatable = false, nullable = false)
   private Integer id;
@Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Column(name = "cash_balance", nullable = false)
    private BigDecimal cashBalance = BigDecimal.ZERO;

    @Column(name = "opened_date", nullable = false)
    private LocalDate openedDate;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String currency = "USD";

    @Column(nullable = false)
    private String status = "ACTIVE";

    @Column(name = "archived_at")
    private java.time.Instant archivedAt;

    /** Returns the portfolio lifecycle.
     * @return ACTIVE or ARCHIVED */
    public String getStatus() { return status; }

    /** Sets the portfolio lifecycle.
     * @param status ACTIVE or ARCHIVED */
    public void setStatus(String status) { this.status = status; }

    /** Returns the archive audit time.
     * @return archive time, or null for an active account */
    public java.time.Instant getArchivedAt() { return archivedAt; }

    /** Sets the archive audit time.
     * @param archivedAt time the account became read-only */
    public void setArchivedAt(java.time.Instant archivedAt) { this.archivedAt = archivedAt; }

    /**
     * Returns the ID.
     *
     * @return the ID
     */
    public Integer getId() {
        return id;
    }

    /**
     * Sets the ID.
     *
     * @param id the ID
     */
    public void setId(Integer id) {
        this.id = id;
    }

    /**
     * Returns the account ID.
     *
     * @return the account ID
     */
    public Integer getAccountId() {
        return id;
    }

    /**
     * Returns the user ID.
     *
     * @return the user ID
     */
    public UUID getUserId() {
        return userId;
    }

    /**
     * Sets the user ID.
     *
     * @param userId the user ID
     */
    public void setUserId(UUID userId) {
        this.userId = userId;
    }

    /**
     * Returns the cash balance.
     *
     * @return the cash balance
     */
    public BigDecimal getCashBalance() {
        return cashBalance;
    }

    /**
     * Sets the cash balance.
     *
     * @param cashBalance the cash balance
     */
    public void setCashBalance(BigDecimal cashBalance) {
        this.cashBalance = cashBalance;
    }

    /**
     * Returns the opened date.
     *
     * @return the opened date
     */
    public LocalDate getOpenedDate() {
        return openedDate;
    }

    /**
     * Sets the opened date.
     *
     * @param openedDate the opened date
     */
    public void setOpenedDate(LocalDate openedDate) {
        this.openedDate = openedDate;
    }

    /**
     * Returns the name.
     *
     * @return the name
     */
    public String getName() {
        return name;
    }

    /**
     * Sets the name.
     *
     * @param name the name
     */
    public void setName(String name) {
        this.name = name;
    }
}
