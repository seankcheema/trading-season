package app.instrument;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Covers the mapping from an instrument row to its client-facing view. */
class InstrumentResponseTest {

    @Test
    void carriesEveryFieldAClientNeedsToPlaceAnOrder() {
        Instrument instrument = new Instrument();
        instrument.setInstrumentId(7);
        instrument.setTicker("ZETA");
        instrument.setName("Zeta Corp.");
        instrument.setAssetClass("Equity");
        instrument.setMarket("US");
        instrument.setCurrency("USD");
        instrument.setTradable(true);
        instrument.setSimulatedStockSymbol("ZETA");

        InstrumentResponse response = InstrumentResponse.from(instrument);

        assertEquals(7, response.instrumentId());
        assertEquals("ZETA", response.ticker());
        assertEquals("Zeta Corp.", response.name());
        assertEquals("Equity", response.assetClass());
        assertEquals("US", response.market());
        assertEquals("USD", response.currency());
        assertTrue(response.tradable());
        assertEquals("ZETA", response.simulatedStockSymbol());
    }

    @Test
    void reportsAnFxOrCryptoInstrumentAsUnsimulatedAndWithoutAMarket() {
        Instrument instrument = new Instrument();
        instrument.setInstrumentId(9);
        instrument.setTicker("BTC");
        instrument.setName("Bitcoin");
        instrument.setAssetClass("Crypto");
        instrument.setCurrency("USD");
        instrument.setTradable(true);

        InstrumentResponse response = InstrumentResponse.from(instrument);

        assertNull(response.market());
        assertNull(response.simulatedStockSymbol());
    }

    @Test
    void treatsAnUnsetTradableFlagAsNotTradable() {
        // The column is NOT NULL with a default, so this is only reachable for a
        // row that was never persisted — fail closed rather than throw.
        Instrument instrument = new Instrument();
        instrument.setTicker("HALT");
        instrument.setName("Halted Industries");
        instrument.setAssetClass("Equity");
        instrument.setMarket("US");
        instrument.setCurrency("USD");
        instrument.setTradable(null);

        assertFalse(InstrumentResponse.from(instrument).tradable());
    }
}
