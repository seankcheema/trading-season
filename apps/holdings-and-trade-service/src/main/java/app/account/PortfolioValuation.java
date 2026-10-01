package app.account;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;

/** A persisted, real-time observation of an account's holdings, excluding cash. */
@Entity
@Table(name = "portfolio_valuations")
public class PortfolioValuation {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "valuation_id")
    private Long id;
    @Column(name = "account_id", nullable = false)
    private Integer accountId;
    @Column(name = "observed_at", nullable = false)
    private Instant observedAt;
    @Column(name = "portfolio_value", nullable = false, precision = 38, scale = 10)
    private BigDecimal value;

    /** Creates an observation for persistence. */
    protected PortfolioValuation() { }

    /**
     * Creates an account observation without rounding its calculated value.
     * @param accountId observed account
     * @param observedAt real capture time
     * @param value total holdings value
     */
    public PortfolioValuation(Integer accountId, Instant observedAt, BigDecimal value) {
        this.accountId = accountId;
        this.observedAt = observedAt;
        this.value = value;
    }

    /** Returns the observation's actual calendar time.
     * @return real capture time */
    public Instant getObservedAt() { return observedAt; }
    /** Returns the server-calculated holdings value.
     * @return total holdings value, excluding cash */
    public BigDecimal getValue() { return value; }
}
