package app.market;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/** Storage operations required by the shared market replay. */
interface MarketDataSource {
    MarketModels.Session resolveSession(Long requestedId);
    List<MarketModels.Stock> stocks();
    List<LocalDate> tradingDays(long sessionId);
    List<MarketModels.Frame> ticksForDay(MarketModels.Session session, LocalDate day);
    List<MarketModels.Candle> candles(long sessionId, String symbol, Instant from, Instant to);
}
