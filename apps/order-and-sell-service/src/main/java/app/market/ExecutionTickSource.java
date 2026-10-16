package app.market;

import app.order.execution.ExecutionQuoteSource.Quote;
import org.springframework.stereotype.Component;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

/** Reuses PostgreSQL/Parquet tick storage for ordered execution catch-up. */
@Component
public class ExecutionTickSource {
    private static final int MAX_BATCH = 1000;
    private final MarketDataSource source;
    /** Creates the storage adapter.
     * @param source existing market storage */
    public ExecutionTickSource(MarketDataSource source) { this.source = source; }
    /** Returns a bounded chronological batch after the last evaluated position.
     * @param sessionId fixed order session
     * @param symbol simulated symbol
     * @param after exclusive persisted watermark
     * @param through inclusive authoritative cursor
     * @return at most one thousand matching ticks */
    public List<Quote> between(long sessionId, String symbol, OffsetDateTime after, OffsetDateTime through) {
        if (!through.isAfter(after)) {
            return List.of();
        }
        var session = source.resolveSession(sessionId);
        var zone = ZoneId.of("America/Chicago");
        var first = after.atZoneSameInstant(zone).toLocalDate();
        var last = through.atZoneSameInstant(zone).toLocalDate();
        List<Quote> result = new ArrayList<>();
        for (var day : source.tradingDays(sessionId).stream().sorted().toList()) {
            if (day.isBefore(first) || day.isAfter(last)) {
                continue;
            }
            for (var frame : source.ticksForDay(session, day)) {
                if (isOutsideWindow(frame.timestamp(), after, through)) {
                    continue;
                }
                if (collect(result, frame.prices(), symbol, sessionId)) {
                    return result;
                }
            }
        }
        return result;
    }

    private static boolean isOutsideWindow(Instant at, OffsetDateTime after, OffsetDateTime through) {
        return !at.isAfter(after.toInstant()) || at.isAfter(through.toInstant());
    }

    /** Adds the symbol's positive prices from one frame, stopping at the batch limit.
     * @return true once the batch is full */
    private static boolean collect(List<Quote> result, List<MarketModels.Tick> ticks, String symbol, long sessionId) {
        for (var tick : ticks) {
            if (symbol.equals(tick.symbol()) && tick.price().signum() > 0) {
                result.add(new Quote(tick.price(), sessionId, tick.timestamp().atOffset(ZoneOffset.UTC)));
                if (result.size() >= MAX_BATCH) {
                    return true;
                }
            }
        }
        return false;
    }
}
