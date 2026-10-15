package app.instrument;

import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/**
 * A tradable asset, read here only to name the instrument a holding is in.
 *
 * <p>This service reads instruments; the order service owns writing them. Only
 * the fields needed to label a holding are mapped.
 */
@Entity
@Table(name = "instruments")
public class Instrument extends InstrumentBase {

    /** Creates an empty instrument for the persistence provider to populate. */
    public Instrument() {
    }

    /**
     * The symbol a client should display and match market prices against.
     *
     * <p>Prefers the simulator's symbol, because the dashboard looks a holding's
     * live price up by the symbol the market endpoints report. Falls back to the
     * ticker for an instrument the simulation does not cover, which then simply
     * has no live price.
     *
     * @return the simulated stock symbol if there is one, otherwise the ticker
     */
    public String displaySymbol() {
        return getSimulatedStockSymbol() != null ? getSimulatedStockSymbol() : getTicker();
    }
}
