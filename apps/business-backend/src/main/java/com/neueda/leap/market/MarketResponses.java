package com.neueda.leap.market;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/** Public response records for the market-data API. */
public final class MarketResponses {
    private MarketResponses() { }

    /**
     * Requested simulated market clock position.
     * @param timestamp ISO-8601 instant to seek to
     */
    public record ClockRequest(Instant timestamp) { }

    /**
     * One stock's current price and session-relative movement.
     * @param symbol stock symbol
     * @param companyName display name
     * @param price current replay price
     * @param change change from the session open
     * @param changePercent percentage change from the session open
     * @param timestamp simulated tick time
     */
    public record StockSnapshot(String symbol, String companyName, BigDecimal price,
                         BigDecimal change, BigDecimal changePercent, Instant timestamp) { }
    /**
     * Available simulated market clock range for a replay session.
     * @param timezone IANA timezone used by the market replay calendar
     * @param firstTimestamp first selectable seeded timestamp
     * @param lastTimestamp last selectable seeded timestamp
     * @param tradingDates seeded trading dates in market-local time
     */
    public record CalendarAvailability(String timezone, Instant firstTimestamp,
                         Instant lastTimestamp, List<LocalDate> tradingDates) { }
    /**
     * Complete ticker snapshot at one replay cursor.
     * @param sessionId simulation identifier
     * @param status replay market status
     * @param marketTimestamp simulated market time
     * @param serverTimestamp response creation time
     * @param calendar available seeded clock range for the simulation
     * @param stocks current stock values
     */
    public record Snapshot(long sessionId, String status, Instant marketTimestamp,
                    Instant serverTimestamp, CalendarAvailability calendar,
                    List<StockSnapshot> stocks) { }
    /**
     * One aggregated OHLCV chart bucket.
     * @param timestamp bucket start
     * @param open first price
     * @param high maximum price
     * @param low minimum price
     * @param close final price
     * @param volume summed volume
     */
    public record CandlePoint(Instant timestamp, BigDecimal open, BigDecimal high,
                       BigDecimal low, BigDecimal close, long volume) { }
    /**
     * Bounded chart history for one stock and timeframe.
     * @param sessionId simulation identifier
     * @param symbol stock symbol
     * @param timeframe requested timeframe
     * @param marketTimestamp replay cursor time
     * @param points chronological aggregated points
     */
    public record CandleSeries(long sessionId, String symbol, String timeframe,
                        Instant marketTimestamp, List<CandlePoint> points) { }
    /**
     * One stock price inside a synchronized live batch.
     * @param symbol stock symbol
     * @param price simulated price
     * @param sequenceNumber source tick sequence
     */
    public record TickPrice(String symbol, BigDecimal price, long sequenceNumber) { }
    /**
     * One synchronized live batch for a simulated market second.
     * @param eventId monotonic stream event identifier
     * @param marketTimestamp simulated market time
     * @param serverTimestamp event creation time
     * @param prices stock prices at the market timestamp
     */
    public record TickEvent(long eventId, Instant marketTimestamp, Instant serverTimestamp,
                     List<TickPrice> prices) { }
}
