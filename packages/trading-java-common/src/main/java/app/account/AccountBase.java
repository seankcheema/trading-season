package app.account;

import jakarta.persistence.Column;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.MappedSuperclass;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

/**
 * The columns of the {@code accounts} table that both Java services map. Each
 * service's {@code Account} entity extends this class and adds what only it
 * maps.
 *
 * <p>{@code cashBalance} is a cache (BR-10) reconciled against
 * {@code cash_transactions}; never write this field without inserting the
 * matching ledger row.
 */
@MappedSuperclass
public abstract class AccountBase {

    /** Creates an instance for a service's entity to extend. */
    protected AccountBase() {
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
    private String currency = "USD";

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
     * Returns the currency.
     *
     * @return the currency
     */
    public String getCurrency() {
        return currency;
    }

    /**
     * Sets the currency.
     *
     * @param currency the currency
     */
    public void setCurrency(String currency) {
        this.currency = currency;
    }
}


