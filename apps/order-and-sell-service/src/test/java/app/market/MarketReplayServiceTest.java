package app.market;

import app.Main;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.scheduling.annotation.EnableScheduling;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.nullable;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class MarketReplayServiceTest {
    private final MarketDataSource repository = mock(MarketDataSource.class);
    private final MarketModels.Session session = new MarketModels.Session(2026001L, "postgres", "");
    private final Instant open = Instant.parse("2026-01-05T14:30:00Z");
    private MarketReplayService service;

    @Test
    void applicationEnablesScheduledReplayTicks() {
        assertTrue(Main.class.isAnnotationPresent(EnableScheduling.class));
    }

    @BeforeEach
    void setUp() {
        when(repository.resolveSession(nullable(Long.class))).thenReturn(session);
        when(repository.tradingDays(session.id())).thenReturn(List.of(LocalDate.of(2026, 1, 5)));
        when(repository.stocks()).thenReturn(List.of(new MarketModels.Stock("AAPL", "Apple Inc.")));
        when(repository.ticksForDay(session, LocalDate.of(2026, 1, 5))).thenReturn(List.of(
                frame(0, "100.000000", 1), frame(1, "101.000000", 2)));
        service = new MarketReplayService(repository,
                Clock.fixed(open, ZoneOffset.UTC), "", 3, 200);
    }

    @Test
    void snapshotUsesCurrentReplayFrameAndSessionOpenChange() {
        var snapshot = service.snapshot(null);

        assertEquals(2026001L, snapshot.sessionId());
        assertEquals(open, snapshot.marketTimestamp());
        assertEquals(new BigDecimal("100.000000"), snapshot.stocks().getFirst().price());
        assertEquals(BigDecimal.ZERO.setScale(6), snapshot.stocks().getFirst().change());
    }

    @Test
    void snapshotIncludesSeededCalendarAvailability() {
        when(repository.tradingDays(session.id())).thenReturn(List.of(
                LocalDate.of(2026, 1, 5), LocalDate.of(2026, 1, 6)));
        when(repository.ticksForDay(session, LocalDate.of(2026, 1, 6))).thenReturn(List.of(
                new MarketModels.Frame(Instant.parse("2026-01-06T14:30:00Z"), List.of(
                        new MarketModels.Tick("AAPL", Instant.parse("2026-01-06T14:30:00Z"),
                                new BigDecimal("102.000000"), 3)))));
        service = new MarketReplayService(repository,
                Clock.fixed(open, ZoneOffset.UTC), "", 3, 200);

        var calendar = service.snapshot(null).calendar();

        assertEquals("America/Chicago", calendar.timezone());
        assertEquals(Instant.parse("2026-01-05T14:30:00Z"), calendar.firstTimestamp());
        assertEquals(Instant.parse("2026-01-06T20:59:59Z"), calendar.lastTimestamp());
        assertEquals(List.of(LocalDate.of(2026, 1, 5), LocalDate.of(2026, 1, 6)),
                calendar.tradingDates());
    }

    @Test
    void fiveDayHistoryAggregatesOneMinuteCandlesIntoFiveMinuteBuckets() {
        List<MarketModels.Candle> candles = new ArrayList<>();
        for (int minute = 0; minute < 10; minute++) {
            BigDecimal price = BigDecimal.valueOf(100 + minute);
            candles.add(new MarketModels.Candle(open.plusSeconds(minute * 60L), price, price, price, price, 10));
        }
        when(repository.candles(anyLong(), anyString(), any(), any())).thenReturn(candles);

        var series = service.candles(null, "aapl", "5D");

        assertEquals(2, series.points().size());
        assertEquals(BigDecimal.valueOf(100), series.points().getFirst().open());
        assertEquals(BigDecimal.valueOf(104), series.points().getFirst().close());
        assertEquals(50, series.points().getFirst().volume());
    }

    @Test
    void advancingUpdatesTheCurrentTickWithoutQueryingAnotherDay() {
        service.snapshot(null);
        service.advance();

        assertEquals(new BigDecimal("101.000000"), service.snapshot(null).stocks().getFirst().price());
    }

    @Test
    void settingClockMovesReplayToClosestTickAtOrBeforeRequestedTime() {
        var snapshot = service.setClock(null, open.plusMillis(1500));

        assertEquals(open.plusSeconds(1), snapshot.marketTimestamp());
        assertEquals(new BigDecimal("101.000000"), snapshot.stocks().getFirst().price());
    }

    @Test
    void settingClockAcceptsTheLastMinuteOfASeededSeptemberSession() {
        Instant septemberCloseMinute = Instant.parse("2026-09-01T19:59:00Z");
        when(repository.tradingDays(session.id())).thenReturn(List.of(LocalDate.of(2026, 9, 1)));
        when(repository.ticksForDay(session, LocalDate.of(2026, 9, 1))).thenReturn(List.of(
                new MarketModels.Frame(Instant.parse("2026-09-01T14:30:00Z"), List.of(
                        new MarketModels.Tick("AAPL", Instant.parse("2026-09-01T14:30:00Z"),
                                new BigDecimal("200.000000"), 1))),
                new MarketModels.Frame(septemberCloseMinute, List.of(
                        new MarketModels.Tick("AAPL", septemberCloseMinute,
                                new BigDecimal("201.000000"), 2)))));
        service = new MarketReplayService(repository,
                Clock.fixed(septemberCloseMinute, ZoneOffset.UTC), "", 3, 200);

        var snapshot = service.setClock(null, septemberCloseMinute);

        assertEquals(septemberCloseMinute, snapshot.marketTimestamp());
        assertEquals(new BigDecimal("201.000000"), snapshot.stocks().getFirst().price());
    }

    @Test
    void settingClockMovesNonTradingDatesToTheNextSeededDayInTheSameMonth() {
        Instant februaryWeekendOpen = Instant.parse("2026-02-01T14:30:00Z");
        Instant februaryFirstTradingOpen = Instant.parse("2026-02-02T14:30:00Z");
        when(repository.tradingDays(session.id())).thenReturn(List.of(LocalDate.of(2026, 2, 2)));
        when(repository.ticksForDay(session, LocalDate.of(2026, 2, 2))).thenReturn(List.of(
                new MarketModels.Frame(februaryFirstTradingOpen, List.of(
                        new MarketModels.Tick("AAPL", februaryFirstTradingOpen,
                                new BigDecimal("202.000000"), 1)))));
        service = new MarketReplayService(repository,
                Clock.fixed(februaryFirstTradingOpen, ZoneOffset.UTC), "", 3, 200);

        var snapshot = service.setClock(null, februaryWeekendOpen);

        assertEquals(februaryFirstTradingOpen, snapshot.marketTimestamp());
        assertEquals(new BigDecimal("202.000000"), snapshot.stocks().getFirst().price());
    }

    @Test
    void settingClockReportsWhenASeededDateHasNoReplayPrices() {
        when(repository.tradingDays(session.id())).thenReturn(List.of(LocalDate.of(2026, 9, 1)));
        when(repository.ticksForDay(session, LocalDate.of(2026, 9, 1))).thenReturn(List.of());
        service = new MarketReplayService(repository,
                Clock.fixed(Instant.parse("2026-09-01T19:59:00Z"), ZoneOffset.UTC), "", 3, 200);

        var error = assertThrows(MarketRequestException.class,
                () -> service.setClock(null, Instant.parse("2026-09-01T19:59:00Z")));

        assertEquals("Selected date has no replay prices available", error.getMessage());
    }

    @Test
    void settingClockConvertsReplayLoadFailuresIntoMarketRequestErrors() {
        when(repository.tradingDays(session.id())).thenReturn(List.of(LocalDate.of(2026, 9, 1)));
        when(repository.ticksForDay(session, LocalDate.of(2026, 9, 1)))
                .thenThrow(new LinkageError("duckdb native load failed"));
        service = new MarketReplayService(repository,
                Clock.fixed(Instant.parse("2026-09-01T19:59:00Z"), ZoneOffset.UTC), "", 3, 200);

        var error = assertThrows(MarketRequestException.class,
                () -> service.setClock(null, Instant.parse("2026-09-01T19:59:00Z")));

        assertEquals("Selected date has no replay prices available", error.getMessage());
    }

    private MarketModels.Frame frame(long seconds, String price, long sequence) {
        Instant timestamp = open.plusSeconds(seconds);
        return new MarketModels.Frame(timestamp, List.of(
                new MarketModels.Tick("AAPL", timestamp, new BigDecimal(price), sequence)));
    }
}
