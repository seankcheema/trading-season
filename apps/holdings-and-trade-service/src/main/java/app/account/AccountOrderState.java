package app.account;

/** Read-only mapping of order states owned and written by Order and Sell. */
@jakarta.persistence.Entity
@jakarta.persistence.Table(name = "orders")
@org.hibernate.annotations.Immutable
public class AccountOrderState {
    /** Creates the read model for persistence. */
    public AccountOrderState() { }
    @jakarta.persistence.Id
    @jakarta.persistence.Column(name = "order_id")
    private Integer id;
    @jakarta.persistence.Column(name = "account_id", nullable = false)
    private Integer accountId;
    @jakarta.persistence.Column(nullable = false)
    private String status;
}
