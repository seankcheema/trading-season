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
 * The execution outcome of an order that passed its trading rules (BR-06/08);
 * writing it moves the order to FILLED (KAN-93). At most one fill per order —
 * this schema doesn't model partial fills.
 */
@Entity
@Table(name = "fills")
public class Fill {

    /** Creates an instance of this class. */
    public Fill() {
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "fill_id", updatable = false, nullable = false)
    private Integer fillId;

    @Column(name = "order_id", nullable = false, updatable = false, unique = true)
    private Integer orderId;

    /** BR-08: the quote price used at execution time — not necessarily the order's indicative price. */
    @Column(name = "quote_price", nullable = false, updatable = false)
    private BigDecimal quotePrice;

    @Column(nullable = false, updatable = false)
    private BigDecimal quantity;

    @Column(name = "filled_at", nullable = false, updatable = false)
    private OffsetDateTime filledAt;

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
     * Returns the order ID.
     *
     * @return the order ID
     */
    public Integer getOrderId() {
        return orderId;
    }

    /**
     * Sets the order ID.
     *
     * @param orderId the order ID
     */
    public void setOrderId(Integer orderId) {
        this.orderId = orderId;
    }

    /**
     * Returns the quote price.
     *
     * @return the quote price
     */
    public BigDecimal getQuotePrice() {
        return quotePrice;
    }

    /**
     * Sets the quote price.
     *
     * @param quotePrice the quote price
     */
    public void setQuotePrice(BigDecimal quotePrice) {
        this.quotePrice = quotePrice;
    }

    /**
     * Returns the quantity.
     *
     * @return the quantity
     */
    public BigDecimal getQuantity() {
        return quantity;
    }

    /**
     * Sets the quantity.
     *
     * @param quantity the quantity
     */
    public void setQuantity(BigDecimal quantity) {
        this.quantity = quantity;
    }

    /**
     * Returns the filled at.
     *
     * @return the filled at
     */
    public OffsetDateTime getFilledAt() {
        return filledAt;
    }

    /**
     * Sets the filled at.
     *
     * @param filledAt the filled at
     */
    public void setFilledAt(OffsetDateTime filledAt) {
        this.filledAt = filledAt;
    }
}


