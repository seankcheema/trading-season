package app.instrument;

import jakarta.persistence.Column;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.MappedSuperclass;

/**
 * The columns of the {@code instruments} table that both Java services map:
 * enough to name an instrument. Each service's {@code Instrument} entity
 * extends this class; Order and Sell, which owns writing instruments, maps the
 * rest.
 */
@MappedSuperclass
public abstract class InstrumentBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "instrument_id", updatable = false, nullable = false)
    private Integer instrumentId;

    @Column(nullable = false, unique = true)
    private String ticker;

    @Column(nullable = false)
    private String name;

    /**
     * The simulator's symbol for this instrument, or null when the market
     * simulation does not cover it.
     */
    @Column(name = "simulated_stock_symbol")
    private String simulatedStockSymbol;

    /** Creates an instance for a service's entity to extend. */
    protected InstrumentBase() {
    }

    /**
     * Returns the instrument id.
     *
     * @return the instrument id, or null before the row is inserted
     */
    public Integer getInstrumentId() {
        return instrumentId;
    }

    /**
     * Sets the instrument id.
     *
     * @param instrumentId the instrument id
     */
    public void setInstrumentId(Integer instrumentId) {
        this.instrumentId = instrumentId;
    }

    /**
     * Returns the instrument's ticker.
     *
     * @return the ticker
     */
    public String getTicker() {
        return ticker;
    }

    /**
     * Sets the instrument's ticker.
     *
     * @param ticker the ticker
     */
    public void setTicker(String ticker) {
        this.ticker = ticker;
    }

    /**
     * Returns the instrument's name.
     *
     * @return the name
     */
    public String getName() {
        return name;
    }

    /**
     * Sets the instrument's name.
     *
     * @param name the name
     */
    public void setName(String name) {
        this.name = name;
    }

    /**
     * Returns the simulator's symbol for this instrument.
     *
     * @return the simulated stock symbol, or null when the simulation does not cover it
     */
    public String getSimulatedStockSymbol() {
        return simulatedStockSymbol;
    }

    /**
     * Sets the simulator's symbol for this instrument.
     *
     * @param simulatedStockSymbol the simulated stock symbol, or null
     */
    public void setSimulatedStockSymbol(String simulatedStockSymbol) {
        this.simulatedStockSymbol = simulatedStockSymbol;
    }
}
