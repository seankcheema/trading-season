package app.order.execution;

import app.instrument.Instrument;
import app.market.MarketReplayService;
import app.market.MarketResponses.StockSnapshot;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.Optional;

/**
 * Reads the price an instrument currently trades at, so a fill can be priced
 * against the market rather than the number the client submitted (BR-08).
 *
 * <p>The quote is the instrument's price in the shared market replay at its
 * current cursor, read through {@link MarketReplayService#snapshot(Long)} for
 * the newest completed session: the same price the Client UI shows beside
 * the order ticket. An instrument is quoted under its
 * {@code simulatedStockSymbol}, falling back to its ticker.
 *
 * <p>Whatever stops a quote being read (no seeded session, no replay frames,
 * a storage failure, or a symbol the replay does not carry) yields an empty
 * result; {@link OrderExecutionService} decides what that means for the order.
 */
@Component
public class ExecutionQuoteSource {

    private static final Logger log = LoggerFactory.getLogger(ExecutionQuoteSource.class);

    private final MarketReplayService marketReplayService;

    /**
     * Creates the quote source.
     *
     * @param marketReplayService the shared market replay this service also serves over HTTP
     */
    public ExecutionQuoteSource(MarketReplayService marketReplayService) {
        this.marketReplayService = marketReplayService;
    }

    /**
     * Returns the instrument's current market price.
     *
     * @param instrument the instrument being traded
     * @return its price at the replay cursor, or empty when no quote can be read
     */
    public Optional<BigDecimal> currentPrice(Instrument instrument) {
        String symbol = quotedSymbol(instrument);
        try {
            return marketReplayService.snapshot(null).stocks().stream()
                    .filter(stock -> stock.symbol().equals(symbol))
                    .map(StockSnapshot::price)
                    .findFirst();
        } catch (RuntimeException unavailable) {
            log.warn("No market quote for {}: {}", symbol, unavailable.getMessage());
            return Optional.empty();
        }
    }

    /**
     * Returns the symbol the market replay quotes an instrument under.
     *
     * @param instrument the instrument being traded
     * @return its {@code simulatedStockSymbol}, or its ticker when it has none
     */
    public static String quotedSymbol(Instrument instrument) {
        return instrument.getSimulatedStockSymbol() != null
                ? instrument.getSimulatedStockSymbol()
                : instrument.getTicker();
    }
}
