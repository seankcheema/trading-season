package app.market;

import app.order.execution.ExecutionQuoteSource.Quote;
import org.springframework.stereotype.Component;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

/** Reuses PostgreSQL/Parquet tick storage for ordered execution catch-up. */
@Component
public class ExecutionTickSource {
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
        if (!through.isAfter(after)) return List.of();
        var session = source.resolveSession(sessionId);
        var zone = ZoneId.of("America/Chicago");
        var first = after.atZoneSameInstant(zone).toLocalDate();
        var last = through.atZoneSameInstant(zone).toLocalDate();
        List<Quote> result = new ArrayList<>();
        for (var day : source.tradingDays(sessionId).stream().sorted().toList()) {
            if (day.isBefore(first) || day.isAfter(last)) continue;
            for (var frame : source.ticksForDay(session, day)) {
                if (!frame.timestamp().isAfter(after.toInstant()) || frame.timestamp().isAfter(through.toInstant())) continue;
                for (var tick : frame.prices()) {
                    if (symbol.equals(tick.symbol()) && tick.price().signum() > 0) {
                        result.add(new Quote(tick.price(), sessionId, tick.timestamp().atOffset(ZoneOffset.UTC)));
                        if (result.size() >= 1000) return result;
                    }
                }
            }
        }
        return result;
    }
}
