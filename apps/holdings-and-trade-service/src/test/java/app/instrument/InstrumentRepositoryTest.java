package app.instrument;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class InstrumentRepositoryTest {

    @Autowired
    private InstrumentRepository instrumentRepository;

    @Test
    void newInstrumentsAreTradableByDefault() {
        assertTrue(new Instrument().isTradable());
    }

    @Test
    void persistsEveryColumn() {
        Instrument instrument = new Instrument();
        instrument.setTicker("SIMX");
        instrument.setName("Simulated Example");
        instrument.setAssetClass("EQUITY");
        instrument.setMarket("NASDAQ");
        instrument.setCurrency("USD");
        instrument.setTradable(false);
        instrument.setSimulatedStockSymbol("AAPL");
        Integer id = instrumentRepository.saveAndFlush(instrument).getInstrumentId();

        Instrument found = instrumentRepository.findById(id).orElseThrow();

        assertEquals("SIMX", found.getTicker());
        assertEquals("Simulated Example", found.getName());
        assertEquals("EQUITY", found.getAssetClass());
        assertEquals("NASDAQ", found.getMarket());
        assertEquals("USD", found.getCurrency());
        assertFalse(found.isTradable());
        assertEquals("AAPL", found.getSimulatedStockSymbol());
    }

    @Test
    void identifierCanBeAssignedExplicitly() {
        Instrument instrument = new Instrument();
        instrument.setInstrumentId(8);

        assertEquals(8, instrument.getInstrumentId());
    }

    @Test
    void notFoundExceptionsNameTheInstrument() {
        assertEquals("No instrument exists for the given instrument id: 4",
                new InstrumentNotFoundException(4).getMessage());
        assertEquals("custom", new InstrumentNotFoundException("custom").getMessage());
    }
}
