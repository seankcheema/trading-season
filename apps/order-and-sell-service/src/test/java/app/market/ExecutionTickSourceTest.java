package app.market;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ExecutionTickSourceTest {
    @Test void crossesEveryTickInOrderAndExcludesWatermarkAndOtherSymbols() {
        var storage = mock(MarketDataSource.class);
        var source = new ExecutionTickSource(storage);
        var after = OffsetDateTime.parse("2026-01-05T15:00:00Z");
        var session = new MarketModels.Session(1L, "POSTGRES", null);
        when(storage.resolveSession(1L)).thenReturn(session);
        when(storage.tradingDays(1L)).thenReturn(List.of(LocalDate.parse("2026-01-06"), LocalDate.parse("2026-01-05")));
        when(storage.ticksForDay(eq(session), any())).thenAnswer(call -> {
            var day = (LocalDate) call.getArgument(1);
            if (day.getDayOfMonth() != 5) return List.of();
            return java.util.stream.IntStream.rangeClosed(0, 3).mapToObj(i -> new MarketModels.Frame(after.plusSeconds(i).toInstant(),
                    List.of(new MarketModels.Tick("AAPL", after.plusSeconds(i).toInstant(), new BigDecimal("100"), i),
                            new MarketModels.Tick("MSFT", after.plusSeconds(i).toInstant(), BigDecimal.TEN, i)))).toList();
        });
        var ticks = source.between(1L, "AAPL", after, after.plusSeconds(2));
        assertEquals(List.of(after.plusSeconds(1), after.plusSeconds(2)), ticks.stream().map(t -> t.timestamp()).toList());
        assertTrue(source.between(1L, "AAPL", after, after.minusSeconds(1)).isEmpty());
        assertTrue(source.between(1L, "AAPL", after, after).isEmpty());
    }
    @Test void boundsCatchupWorkAndResumesFromTheReturnedPosition() {
        var storage = mock(MarketDataSource.class);
        var source = new ExecutionTickSource(storage);
        var after = OffsetDateTime.parse("2026-01-05T15:00:00Z");
        var session = new MarketModels.Session(1L, "PARQUET", null);
        when(storage.resolveSession(1L)).thenReturn(session);
        when(storage.tradingDays(1L)).thenReturn(List.of(LocalDate.parse("2026-01-05")));
        when(storage.ticksForDay(eq(session), any())).thenReturn(java.util.stream.IntStream.rangeClosed(1, 1001)
                .mapToObj(i -> new MarketModels.Frame(after.plusSeconds(i).toInstant(), List.of(
                        new MarketModels.Tick("AAPL", after.plusSeconds(i).toInstant(), BigDecimal.TEN, i)))).toList());
        var first = source.between(1L, "AAPL", after, after.plusSeconds(1001));
        assertEquals(1000, first.size());
        assertEquals(1, source.between(1L, "AAPL", first.getLast().timestamp(), after.plusSeconds(1001)).size());
    }
}
