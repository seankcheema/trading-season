package app.order.execution;

import app.instrument.Instrument;
import app.market.MarketReplayService;
import app.market.MarketRequestException;
import app.market.MarketResponses.Snapshot;
import app.market.MarketResponses.StockSnapshot;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * The quote a fill is priced at is the instrument's price in the shared market replay (BR-08).
 * Anything that stops that price being read is reported as no quote, never as an exception.
 */
class ExecutionQuoteSourceTest {

    private final MarketReplayService replay = mock(MarketReplayService.class);
    private final ExecutionQuoteSource source = new ExecutionQuoteSource(replay);

    @Test
    void quotesTheInstrumentUnderItsSimulatedStockSymbol() {
        when(replay.snapshot(null)).thenReturn(snapshot(stock("MSFT", "410.10"), stock("AAPL", "227.45")));

        assertEquals(Optional.of(new BigDecimal("227.45")), source.currentPrice(instrument("AAPL.L", "AAPL")));
    }

    @Test
    void fallsBackToTheTickerWhenNothingSimulatesTheInstrument() {
        when(replay.snapshot(null)).thenReturn(snapshot(stock("MSFT", "410.10")));

        assertEquals(Optional.of(new BigDecimal("410.10")), source.currentPrice(instrument("MSFT", null)));
        assertEquals("MSFT", ExecutionQuoteSource.quotedSymbol(instrument("MSFT", null)));
    }

    @Test
    void hasNoQuoteForASymbolTheReplayDoesNotCarry() {
        when(replay.snapshot(null)).thenReturn(snapshot(stock("MSFT", "410.10")));

        assertTrue(source.currentPrice(instrument("VOD.L", null)).isEmpty());
    }

    @Test
    void hasNoQuoteWhenTheReplayCannotBeRead() {
        when(replay.snapshot(null)).thenThrow(new MarketRequestException("Selected date has no replay prices available"));

        assertTrue(source.currentPrice(instrument("AAPL", null)).isEmpty());
    }

    private static Instrument instrument(String ticker, String simulatedStockSymbol) {
        Instrument instrument = new Instrument();
        instrument.setTicker(ticker);
        instrument.setSimulatedStockSymbol(simulatedStockSymbol);
        return instrument;
    }

    private static StockSnapshot stock(String symbol, String price) {
        return new StockSnapshot(symbol, symbol + " Inc.", new BigDecimal(price), BigDecimal.ZERO, BigDecimal.ZERO,
                Instant.parse("2026-01-05T15:01:00Z"));
    }

    private static Snapshot snapshot(StockSnapshot... stocks) {
        return new Snapshot(1L, "COMPLETED", Instant.parse("2026-01-05T15:01:00Z"), Instant.now(), null,
                List.of(stocks));
    }
}
