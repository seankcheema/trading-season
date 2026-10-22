package app.instrument;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/**
 * A tradable asset. Every quote, order, holding, and fill hangs off this table.
 * Trading is limited to US equities (BR-12 as clarified on 20 October 2026):
 * the schema only lets a US equity link to a simulated price series, so an
 * instrument of any other class or market cannot be quoted or traded.
 */
@Entity
@Table(name = "instruments")
public class Instrument extends InstrumentBase {

    /** Creates an instance of this class. */
    public Instrument() {
    }

    @Column(name = "asset_class", nullable = false)
    private String assetClass;

    /** {@code US}: only US equities are traded (BR-12). */
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
