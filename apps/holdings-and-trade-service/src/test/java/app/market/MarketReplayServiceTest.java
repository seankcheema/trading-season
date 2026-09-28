package app.market;

import app.Main;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.scheduling.annotation.EnableScheduling;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.nullable;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
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

    @Test
    void candlesRejectMissingAndUnknownSymbols() {
        assertEquals("Unknown stock symbol",
                assertThrows(MarketRequestException.class, () -> service.candles(null, "MSFT", "1D")).getMessage());
        assertThrows(MarketRequestException.class, () -> service.candles(null, "  ", "1D"));
        assertThrows(MarketRequestException.class, () -> service.candles(null, null, "1D"));
    }

    @Test
    void candlesRejectUnsupportedTimeframes() {
        var error = assertThrows(MarketRequestException.class, () -> service.candles(null, "AAPL", "2H"));

        assertEquals("Unsupported timeframe: 2H", error.getMessage());
    }

    @Test
    void timeframesParseTheirWireValues() {
        assertEquals(MarketTimeframe.ONE_DAY, MarketTimeframe.parse("1D"));
        assertEquals(MarketTimeframe.FIVE_DAYS, MarketTimeframe.parse("5D"));
        assertEquals(MarketTimeframe.ONE_WEEK, MarketTimeframe.parse("1W"));
        assertEquals(MarketTimeframe.ONE_MONTH, MarketTimeframe.parse("1M"));
        assertEquals(MarketTimeframe.ONE_YEAR, MarketTimeframe.parse("1Y"));
        assertEquals(Duration.ofMinutes(30), MarketTimeframe.ONE_WEEK.bucket());
    }

    @Test
    void oneDayCandlesStartAtTheCursorDaysMarketOpen() {
        service.setClock(null, open.plusSeconds(1));

        var series = service.candles(null, "AAPL", "1D");

        verify(repository).candles(2026001L, "AAPL", open, open.plusSeconds(1));
        assertEquals("1D", series.timeframe());
        assertEquals(open.plusSeconds(1), series.marketTimestamp());
    }

    @Test
    void longerTimeframesLookBackFromTheCursor() {
        service.candles(null, "AAPL", "1M");
        service.candles(null, "AAPL", "1W");

        verify(repository).candles(2026001L, "AAPL", open.minus(Duration.ofDays(31)), open);
        verify(repository).candles(2026001L, "AAPL", open.minus(Duration.ofDays(7)), open);
    }

    @Test
    void fiveDayCandlesStartFiveSeededDaysBack() {
        List<LocalDate> days = List.of(LocalDate.of(2026, 1, 5), LocalDate.of(2026, 1, 6), LocalDate.of(2026, 1, 7),
                LocalDate.of(2026, 1, 8), LocalDate.of(2026, 1, 9), LocalDate.of(2026, 1, 12));
        when(repository.tradingDays(session.id())).thenReturn(days);
        Instant cursor = Instant.parse("2026-01-12T14:30:00Z");
        when(repository.ticksForDay(session, LocalDate.of(2026, 1, 12))).thenReturn(List.of(
                new MarketModels.Frame(cursor, List.of(new MarketModels.Tick("AAPL", cursor, BigDecimal.TEN, 1)))));
        service = new MarketReplayService(repository, Clock.fixed(cursor, ZoneOffset.UTC), "", 3, 200);

        service.candles(null, "AAPL", "5D");

        verify(repository).candles(2026001L, "AAPL", Instant.parse("2026-01-06T14:30:00Z"), cursor);
    }

    @Test
    void oneYearCandlesBucketByChicagoTradingDay() {
        when(repository.candles(anyLong(), anyString(), any(), any())).thenReturn(List.of(
                candle("2026-01-05T15:00:00Z", "10", "12", "9", "11", 1),
                candle("2026-01-06T03:00:00Z", "11", "15", "8", "14", 2),
                candle("2026-01-06T15:00:00Z", "20", "21", "19", "20", 4)));

        var points = service.candles(null, "AAPL", "1Y").points();

        assertEquals(2, points.size());
        var first = points.getFirst();
        assertEquals(Instant.parse("2026-01-05T06:00:00Z"), first.timestamp());
        assertEquals(new BigDecimal("10"), first.open());
        assertEquals(new BigDecimal("15"), first.high());
        assertEquals(new BigDecimal("8"), first.low());
        assertEquals(new BigDecimal("14"), first.close());
        assertEquals(3, first.volume());
        assertEquals(Instant.parse("2026-01-06T06:00:00Z"), points.get(1).timestamp());
    }

    @Test
    void candleSeriesKeepsOnlyTheLatestFiveHundredPoints() {
        List<MarketModels.Candle> candles = new ArrayList<>();
        for (int minute = 0; minute < 600; minute++) {
            candles.add(new MarketModels.Candle(open.plusSeconds(minute * 60L), BigDecimal.ONE, BigDecimal.ONE,
                    BigDecimal.ONE, BigDecimal.ONE, 1));
        }
        when(repository.candles(anyLong(), anyString(), any(), any())).thenReturn(candles);

        var points = service.candles(null, "AAPL", "1D").points();

        assertEquals(500, points.size());
        assertEquals(open.plusSeconds(100 * 60L), points.getFirst().timestamp());
        assertEquals(open.plusSeconds(599 * 60L), points.getLast().timestamp());
    }

    @Test
    void snapshotReportsPercentChangeAndFallsBackToTheSymbolForUnnamedStocks() {
        when(repository.stocks()).thenReturn(List.of());
        service.snapshot(null);
        service.advance();

        var stock = service.snapshot(null).stocks().getFirst();

        assertEquals("AAPL", stock.companyName());
        assertEquals(new BigDecimal("1.000000"), stock.change());
        assertEquals(new BigDecimal("1.0000"), stock.changePercent());
    }

    @Test
    void snapshotReportsZeroPercentWhenTheOpeningPriceIsZero() {
        when(repository.ticksForDay(session, LocalDate.of(2026, 1, 5))).thenReturn(List.of(
                frame(0, "0.000000", 1), frame(1, "5.000000", 2)));
        service = new MarketReplayService(repository, Clock.fixed(open, ZoneOffset.UTC), "", 3, 200);
        service.snapshot(null);
        service.advance();

        assertEquals(BigDecimal.ZERO, service.snapshot(null).stocks().getFirst().changePercent());
    }

    @Test
    void startsAtTheConfiguredReplayInstant() {
        service = new MarketReplayService(repository, Clock.fixed(Instant.parse("2030-01-01T00:00:00Z"),
                ZoneOffset.UTC), "2026-01-05T14:30:01Z", 3, 200);

        assertEquals(open.plusSeconds(1), service.snapshot(null).marketTimestamp());
    }

    @Test
    void startsAtTheOpenOfTheLatestSeededDayBeforeToday() {
        service = new MarketReplayService(repository, Clock.fixed(Instant.parse("2026-01-20T18:00:00Z"),
                ZoneOffset.UTC), null, 3, 200);

        assertEquals(open, service.snapshot(null).marketTimestamp());
    }

    @Test
    void startsOnTheLastSeededDayWhenTodayPrecedesEveryDay() {
        service = new MarketReplayService(repository, Clock.fixed(Instant.parse("2025-06-01T18:00:00Z"),
                ZoneOffset.UTC), "", 3, 200);

        assertEquals(open, service.snapshot(null).marketTimestamp());
    }

    @Test
    void refusesASimulationWithoutCandleData() {
        when(repository.tradingDays(session.id())).thenReturn(List.of());

        var error = assertThrows(MarketRequestException.class, () -> service.snapshot(null));

        assertEquals("Simulation has no candle data", error.getMessage());
    }

    @Test
    void settingClockRejectsAMonthWithoutSeededData() {
        var error = assertThrows(MarketRequestException.class,
                () -> service.setClock(null, Instant.parse("2026-03-10T15:00:00Z")));

        assertEquals("Selected date has no seeded trading data", error.getMessage());
    }

    @Test
    void settingClockUsesThePreviousSeededDayWhenNoLaterDayExistsInTheMonth() {
        var snapshot = service.setClock(null, Instant.parse("2026-01-20T14:30:00Z"));

        assertEquals(open, snapshot.marketTimestamp());
    }

    @Test
    void advancingPastTheLastFrameRollsToTheNextDayAndWraps() {
        Instant nextOpen = Instant.parse("2026-01-06T14:30:00Z");
        when(repository.tradingDays(session.id())).thenReturn(List.of(
                LocalDate.of(2026, 1, 5), LocalDate.of(2026, 1, 6)));
        when(repository.ticksForDay(session, LocalDate.of(2026, 1, 6))).thenReturn(List.of(
                new MarketModels.Frame(nextOpen, List.of(
                        new MarketModels.Tick("AAPL", nextOpen, new BigDecimal("150.000000"), 3)))));
        service = new MarketReplayService(repository, Clock.fixed(open, ZoneOffset.UTC), "", 3, 200);
        service.snapshot(null);

        service.advance();
        service.advance();
        var rolled = service.snapshot(null);
        service.advance();
        var wrapped = service.snapshot(null);

        assertEquals(nextOpen, rolled.marketTimestamp());
        assertEquals(BigDecimal.ZERO.setScale(6), rolled.stocks().getFirst().change());
        assertEquals(open, wrapped.marketTimestamp());
    }

    @Test
    void subscribingEnforcesPerClientAndGlobalStreamLimits() {
        service = new MarketReplayService(repository, Clock.fixed(open, ZoneOffset.UTC), "", 2, 3);

        service.subscribe(null, "client-a", null);
        service.subscribe(null, "client-a", null);
        var perClient = assertThrows(MarketLimitException.class, () -> service.subscribe(null, "client-a", null));
        service.subscribe(null, "client-b", null);
        assertThrows(MarketLimitException.class, () -> service.subscribe(null, "client-c", null));

        assertEquals("Market stream connection limit reached", perClient.getMessage());
    }

    @Test
    void subscribingReleasesTheClientSlotWhenTheInitialSnapshotFails() {
        service = new MarketReplayService(repository, Clock.fixed(open, ZoneOffset.UTC), "", 1, 200);
        service.snapshot(null);
        when(repository.stocks()).thenThrow(new IllegalStateException("database unavailable"));

        assertThrows(IllegalStateException.class, () -> service.subscribe(null, "client-a", null));

        doReturn(List.of(new MarketModels.Stock("AAPL", "Apple Inc."))).when(repository).stocks();
        assertNotNull(service.subscribe(null, "client-a", null));
    }

    @Test
    void subscribersReceiveTicksHeartbeatsAndReplayOfMissedEvents() {
        List<MarketModels.Frame> frames = new ArrayList<>();
        for (int second = 0; second < 40; second++) {
            frames.add(frame(second, "100.000000", second));
        }
        when(repository.ticksForDay(session, LocalDate.of(2026, 1, 5))).thenReturn(frames);
        service = new MarketReplayService(repository, Clock.fixed(open, ZoneOffset.UTC), "", 5, 200);
        assertNotNull(service.subscribe(null, "live", null));

        for (int i = 0; i < 35; i++) service.advance();

        assertNotNull(service.subscribe(null, "recent", 30L));
        assertNotNull(service.subscribe(null, "expired", 1L));
        assertEquals(open.plusSeconds(35), service.snapshot(null).marketTimestamp());
    }

    private MarketModels.Candle candle(String at, String open, String high, String low, String close, long volume) {
        return new MarketModels.Candle(Instant.parse(at), new BigDecimal(open), new BigDecimal(high),
                new BigDecimal(low), new BigDecimal(close), volume);
    }

    private MarketModels.Frame frame(long seconds, String price, long sequence) {
        Instant timestamp = open.plusSeconds(seconds);
        return new MarketModels.Frame(timestamp, List.of(
                new MarketModels.Tick("AAPL", timestamp, new BigDecimal(price), sequence)));
    }
}
