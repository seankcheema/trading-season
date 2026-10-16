package app.account;

import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/**
 * A brokerage/child account: the unit orders and holdings attach to/
 * A user can own more than one account (KAN-78, KAN-103/104)
 * Represents an account with an ID, name, and balance.
 * <p>{@code cashBalance} is a cache (BR-10) reconciled against
 * {@code cash_transactions}; never write this field without inserting the
 * matching ledger row. Since KAN-93 order execution does not move it: buy and
 * sell orders debit and credit the owning user's {@code availableFunds}.
 */
@Entity
@Table(name = "accounts")
public class Account extends AccountBase {

    /** Creates an instance of this class. */
    public Account() {
    }
}
