package app.holding;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * The execution of an order, read here for its execution price and real execution time.
 *
 * <p>The order service owns writing fills. This service reads them to derive
 * what a position cost, which is not stored anywhere: {@code holdings} caches
 * quantity only. The signed quantity of the movement weights the average price; the
 * execution timestamp identifies when a portfolio first became invested.
 */
@Entity
@Table(name = "fills")
public class Fill {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "fill_id", updatable = false, nullable = false)
    private Integer fillId;

    /** BR-08: the quote the order executed against. */
    @Column(name = "quote_price", nullable = false)
    private BigDecimal quotePrice;

    @Column(name = "filled_at")
    private Instant filledAt;

    /** Returns the real execution time.
     * @return execution timestamp, or null for legacy test fixtures */
    public Instant getFilledAt() { return filledAt; }

    /** Sets the real execution time.
     * @param filledAt execution timestamp */
    public void setFilledAt(Instant filledAt) { this.filledAt = filledAt; }

    /** Creates an empty fill for the persistence provider to populate. */
    public Fill() {
    }

    /**
     * Returns the fill id.
     *
     * @return the fill id, or null before the row is inserted
     */
    public Integer getFillId() {
        return fillId;
    }

    /**
     * Sets the fill id.
     *
     * @param fillId the fill id
     */
    public void setFillId(Integer fillId) {
        this.fillId = fillId;
    }

    /**
     * Returns the price the order executed at.
     *
     * @return the quote price
     */
    public BigDecimal getQuotePrice() {
        return quotePrice;
    }

    /**
     * Sets the price the order executed at.
     *
     * @param quotePrice the quote price
     */
    public void setQuotePrice(BigDecimal quotePrice) {
        this.quotePrice = quotePrice;
    }
}
