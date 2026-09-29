package app.instrument;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
@Tag("integration")
class InstrumentTest {

    @Autowired
    private InstrumentRepository instrumentRepository;

    @Test
    void displaySymbolFallsBackToTheTickerWhenTheSimulationDoesNotCoverIt() {
        Instrument instrument = instrument("BARC.L", "Barclays plc");

        assertNull(instrument.getSimulatedStockSymbol());
        assertEquals("BARC.L", instrument.displaySymbol());
    }

    @Test
    void displaySymbolPrefersTheSimulatedSymbol() {
        Instrument instrument = instrument("AAPL.US", "Apple Inc.");
        instrument.setSimulatedStockSymbol("AAPL");

        // The dashboard matches live prices by the symbol the market endpoints report.
        assertEquals("AAPL", instrument.displaySymbol());
    }

    @Test
    void roundTripsEveryMappedField() {
        Instrument instrument = new Instrument();
        instrument.setInstrumentId(42);
        instrument.setTicker("SPY");
        instrument.setName("SPDR S&P 500 ETF Trust");
        instrument.setSimulatedStockSymbol("SPY");

        assertEquals(42, instrument.getInstrumentId());
        assertEquals("SPY", instrument.getTicker());
        assertEquals("SPDR S&P 500 ETF Trust", instrument.getName());
        assertEquals("SPY", instrument.getSimulatedStockSymbol());
    }

    @Test
    void loadsOnlyTheRequestedInstruments() {
        Integer apple = instrumentRepository.save(instrument("AAPL", "Apple Inc.")).getInstrumentId();
        Integer spy = instrumentRepository.save(instrument("SPY", "SPDR S&P 500")).getInstrumentId();
        instrumentRepository.save(instrument("MSFT", "Microsoft"));

        List<Instrument> found = instrumentRepository.findByInstrumentIdIn(List.of(apple, spy));

        assertEquals(2, found.size());
        assertTrue(found.stream().allMatch(candidate -> candidate.getInstrumentId().equals(apple)
                || candidate.getInstrumentId().equals(spy)));
    }

    @Test
    void anIdWithNoRowIsSimplyAbsentRatherThanAnError() {
        Instrument saved = instrumentRepository.save(instrument("AAPL", "Apple Inc."));

        List<Instrument> found = instrumentRepository
                .findByInstrumentIdIn(List.of(saved.getInstrumentId(), 999_999));

        assertEquals(1, found.size());
        assertNotNull(found.get(0).getTicker());
    }

    private static Instrument instrument(String ticker, String name) {
        Instrument instrument = new Instrument();
        instrument.setTicker(ticker);
        instrument.setName(name);
        return instrument;
    }
}
