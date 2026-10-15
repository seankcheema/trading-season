package app.instrument;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/**
 * A tradable asset: equity, FX pair, or crypto. Every quote, order, holding,
 * and fill hangs off this table.
 */
@Entity
@Table(name = "instruments")
public class Instrument extends InstrumentBase {

    /** Creates an instance of this class. */
    public Instrument() {
    }

    @Column(name = "asset_class", nullable = false)
    private String assetClass;

    /** UK / US / IN for equities; null for FX and crypto. */
    @Column
    private String market;

    @Column(nullable = false)
    private String currency;

    /** BR-05: an order against a non-tradable instrument must be rejected. */
    @Column(name = "is_tradable", nullable = false)
    private Boolean tradable = true;

    /**
     * Returns the asset class.
     *
     * @return the asset class
     */
    public String getAssetClass() {
        return assetClass;
    }

    /**
     * Sets the asset class.
     *
     * @param assetClass the asset class
     */
    public void setAssetClass(String assetClass) {
        this.assetClass = assetClass;
    }

    /**
     * Returns the market.
     *
     * @return the market
     */
    public String getMarket() {
        return market;
    }

    /**
     * Sets the market.
     *
     * @param market the market
     */
    public void setMarket(String market) {
        this.market = market;
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

    /**
     * Returns whether this is tradable.
     *
     * @return {@code true} when tradable
     */
    public Boolean isTradable() {
        return tradable;
    }

    /**
     * Sets the tradable.
     *
     * @param tradable the tradable
     */
    public void setTradable(Boolean tradable) {
        this.tradable = tradable;
    }
}
