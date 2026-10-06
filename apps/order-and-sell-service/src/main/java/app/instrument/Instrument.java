package app.instrument;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * A tradable asset: equity, FX pair, or crypto. Every quote, order, holding,
 * and fill hangs off this table.
 */
@Entity
@Table(name = "instruments")
public class Instrument {

    /** Creates an instance of this class. */
    public Instrument() {
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "instrument_id", updatable = false, nullable = false)
    private Integer instrumentId;

    @Column(nullable = false, unique = true)
    private String ticker;

    @Column(nullable = false)
    private String name;

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

    @Column(name = "simulated_stock_symbol")
    private String simulatedStockSymbol;

    /**
     * Returns the instrument ID.
     *
     * @return the instrument ID
     */
    public Integer getInstrumentId() {
        return instrumentId;
    }

    /**
     * Sets the instrument ID.
     *
     * @param instrumentId the instrument ID
     */
    public void setInstrumentId(Integer instrumentId) {
        this.instrumentId = instrumentId;
    }

    /**
     * Returns the ticker.
     *
     * @return the ticker
     */
    public String getTicker() {
        return ticker;
    }

    /**
     * Sets the ticker.
     *
     * @param ticker the ticker
     */
    public void setTicker(String ticker) {
        this.ticker = ticker;
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

    /**
     * Returns the simulated stock symbol.
     *
     * @return the simulated stock symbol
     */
    public String getSimulatedStockSymbol() {
        return simulatedStockSymbol;
    }

    /**
     * Sets the simulated stock symbol.
     *
     * @param simulatedStockSymbol the simulated stock symbol
     */
    public void setSimulatedStockSymbol(String simulatedStockSymbol) {
        this.simulatedStockSymbol = simulatedStockSymbol;
    }
}


