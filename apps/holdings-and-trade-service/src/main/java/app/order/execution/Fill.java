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
 * The execution outcome of an ACCEPTED order (BR-06/08). At most one fill
 * per order — this schema doesn't model partial fills.
 */
@Entity
@Table(name = "fills")
public class Fill {

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

    public Integer getFillId() {
        return fillId;
    }

    public void setFillId(Integer fillId) {
        this.fillId = fillId;
    }

    public Integer getOrderId() {
        return orderId;
    }

    public void setOrderId(Integer orderId) {
        this.orderId = orderId;
    }

    public BigDecimal getQuotePrice() {
        return quotePrice;
    }

    public void setQuotePrice(BigDecimal quotePrice) {
        this.quotePrice = quotePrice;
    }

    public BigDecimal getQuantity() {
        return quantity;
    }

    public void setQuantity(BigDecimal quantity) {
        this.quantity = quantity;
    }

    public OffsetDateTime getFilledAt() {
        return filledAt;
    }

    public void setFilledAt(OffsetDateTime filledAt) {
        this.filledAt = filledAt;
    }
}


