package app.account;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/**
 * A brokerage/child account: the unit orders and holdings attach to/
 * A user can own more than one account (KAN-78, KAN-103/104)
 * Represents an account with an ID, name, and balance.
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
