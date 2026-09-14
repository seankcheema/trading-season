package com.neueda.leap.instrument;

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

    public Integer getInstrumentId() {
        return instrumentId;
    }

    public void setInstrumentId(Integer instrumentId) {
        this.instrumentId = instrumentId;
    }

    public String getTicker() {
        return ticker;
    }

    public void setTicker(String ticker) {
        this.ticker = ticker;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getAssetClass() {
        return assetClass;
    }

    public void setAssetClass(String assetClass) {
        this.assetClass = assetClass;
    }

    public String getMarket() {
        return market;
    }

    public void setMarket(String market) {
        this.market = market;
    }

    public String getCurrency() {
        return currency;
    }

    public void setCurrency(String currency) {
        this.currency = currency;
    }

    public Boolean isTradable() {
        return tradable;
    }

    public void setTradable(Boolean tradable) {
        this.tradable = tradable;
    }

    public String getSimulatedStockSymbol() {
        return simulatedStockSymbol;
    }

    public void setSimulatedStockSymbol(String simulatedStockSymbol) {
        this.simulatedStockSymbol = simulatedStockSymbol;
    }
}
