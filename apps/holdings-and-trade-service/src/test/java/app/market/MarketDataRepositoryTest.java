package app.market;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import tools.jackson.databind.json.JsonMapper;

import java.math.BigDecimal;
import java.nio.file.Path;
import java.sql.DriverManager;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Runs the repository's SQL against an in-memory H2 database in PostgreSQL mode, and its Parquet
 * path against a partition written by DuckDB, so row mapping, filtering, and frame grouping are
 * exercised rather than mocked.
 */
class MarketDataRepositoryTest {
    private static final LocalDate DAY = LocalDate.of(2026, 1, 5);
    /** 08:30 America/Chicago on {@link #DAY}. */
    private static final Instant OPEN = Instant.parse("2026-01-05T14:30:00Z");

    private JdbcTemplate jdbc;
    private MarketDataRepository repository;

    @BeforeEach
    void setUp() {
        DriverManagerDataSource dataSource = new DriverManagerDataSource(
                "jdbc:h2:mem:market-" + UUID.randomUUID() + ";MODE=PostgreSQL;DB_CLOSE_DELAY=-1", "sa", "");
        jdbc = new JdbcTemplate(dataSource);
        jdbc.execute("CREATE TABLE simulation_sessions (id BIGINT PRIMARY KEY, status VARCHAR(20), "
                + "config VARCHAR(2000), created_at TIMESTAMP WITH TIME ZONE)");
        jdbc.execute("CREATE TABLE stocks (symbol VARCHAR(10) PRIMARY KEY, company_name VARCHAR(100))");
        jdbc.execute("CREATE TABLE candles (session_id BIGINT, symbol VARCHAR(10), \"interval\" VARCHAR(5), "
                + "\"timestamp\" TIMESTAMP WITH TIME ZONE, open DECIMAL(18,6), high DECIMAL(18,6), "
                + "low DECIMAL(18,6), close DECIMAL(18,6), volume BIGINT)");
        jdbc.execute("CREATE TABLE market_ticks (session_id BIGINT, symbol VARCHAR(10), "
                + "\"timestamp\" TIMESTAMP WITH TIME ZONE, price DECIMAL(18,6), sequence_number BIGINT)");
        repository = new MarketDataRepository(jdbc, JsonMapper.builder().build());
    }

    @Test
    void resolvesTheNewestCompletedSessionWhenNoneIsRequested() {
        session(1, "COMPLETED", "{\"tick_storage\":{\"mode\":\"postgres\"}}", OPEN);
        session(2, "COMPLETED", "{\"tick_storage\":{\"mode\":\"parquet\",\"archive_location\":\"/data/a\"}}",
                OPEN.plusSeconds(60));
        session(3, "RUNNING", "{}", OPEN.plusSeconds(120));

        MarketModels.Session session = repository.resolveSession(null);

        assertEquals(new MarketModels.Session(2, "parquet", "/data/a"), session);
    }

    @Test
    void resolvesARequestedCompletedSessionById() {
        session(1, "COMPLETED", "{\"tick_storage\":{\"mode\":\"postgres\"}}", OPEN);
        session(2, "COMPLETED", "{}", OPEN.plusSeconds(60));

        assertEquals(new MarketModels.Session(1, "postgres", ""), repository.resolveSession(1L));
    }

    @Test
    void defaultsToParquetStorageWhenMetadataOmitsIt() {
        session(1, "COMPLETED", "{}", OPEN);

        assertEquals(new MarketModels.Session(1, "parquet", ""), repository.resolveSession(1L));
    }

    @Test
    void reportsAMissingOrIncompleteSession() {
        session(1, "RUNNING", "{}", OPEN);

        var error = assertThrows(MarketRequestException.class, () -> repository.resolveSession(1L));

        assertEquals("Completed simulation session not found", error.getMessage());
        assertThrows(MarketRequestException.class, () -> repository.resolveSession(null));
    }

    @Test
    void rejectsUnreadableStorageMetadata() {
        session(1, "COMPLETED", "not json", OPEN);

        var error = assertThrows(IllegalStateException.class, () -> repository.resolveSession(1L));

        assertEquals("Simulation storage metadata is invalid", error.getMessage());
    }

    @Test
    void listsStocksInSymbolOrder() {
        jdbc.update("INSERT INTO stocks VALUES ('MSFT', 'Microsoft'), ('AAPL', 'Apple Inc.')");

        assertEquals(List.of(new MarketModels.Stock("AAPL", "Apple Inc."), new MarketModels.Stock("MSFT", "Microsoft")),
                repository.stocks());
    }

    @Test
    void groupsTradingDaysByChicagoDateAndSession() {
        candle(1, "AAPL", "1m", OPEN, "100");
        // 21:00 on January 5 in Chicago, although already January 6 in UTC.
        candle(1, "AAPL", "1m", Instant.parse("2026-01-06T03:00:00Z"), "101");
        candle(1, "AAPL", "1m", Instant.parse("2026-01-06T14:30:00Z"), "102");
        candle(2, "AAPL", "1m", Instant.parse("2026-01-07T14:30:00Z"), "103");

        assertEquals(List.of(DAY, LocalDate.of(2026, 1, 6)), repository.tradingDays(1));
    }

    @Test
    void loadsOnlyOneMinuteCandlesInsideTheRequestedRange() {
        candle(1, "AAPL", "1m", OPEN.minusSeconds(60), "99");
        candle(1, "AAPL", "1m", OPEN, "100");
        candle(1, "AAPL", "5m", OPEN, "555");
        candle(1, "MSFT", "1m", OPEN, "300");
        candle(1, "AAPL", "1m", OPEN.plusSeconds(60), "101");
        candle(1, "AAPL", "1m", OPEN.plusSeconds(120), "102");

        List<MarketModels.Candle> candles = repository.candles(1, "AAPL", OPEN, OPEN.plusSeconds(60));

        assertEquals(List.of(OPEN, OPEN.plusSeconds(60)), candles.stream().map(MarketModels.Candle::timestamp).toList());
        MarketModels.Candle first = candles.getFirst();
        assertEquals(0, new BigDecimal("100").compareTo(first.close()));
        assertEquals(0, new BigDecimal("101").compareTo(first.high()));
        assertEquals(0, new BigDecimal("99").compareTo(first.low()));
        assertEquals(10, first.volume());
    }

    @Test
    void readsPostgresTicksFromTheMarketOpenGroupedIntoFrames() {
        tick(1, "AAPL", OPEN.minusSeconds(1), "99", 1);
        tick(1, "MSFT", OPEN, "300", 3);
        tick(1, "AAPL", OPEN, "100", 2);
        tick(1, "AAPL", OPEN.plusSeconds(1), "101", 4);
        tick(1, "AAPL", Instant.parse("2026-01-06T14:30:00Z"), "102", 5);
        tick(2, "AAPL", OPEN, "500", 6);

        List<MarketModels.Frame> frames = repository.ticksForDay(new MarketModels.Session(1, "postgres", ""), DAY);

        assertEquals(List.of(OPEN, OPEN.plusSeconds(1)), frames.stream().map(MarketModels.Frame::timestamp).toList());
        assertEquals(List.of("AAPL", "MSFT"),
                frames.getFirst().prices().stream().map(MarketModels.Tick::symbol).toList());
        assertEquals(2, frames.getFirst().prices().getFirst().sequenceNumber());
    }

    @Test
    void fallsBackToCandleClosesWhenTheArchiveLocationIsBlank() {
        candle(1, "AAPL", "1m", OPEN, "100");
        candle(1, "MSFT", "1m", OPEN, "300");
        candle(1, "AAPL", "1m", OPEN.plusSeconds(60), "101");
        candle(1, "AAPL", "5m", OPEN.plusSeconds(120), "555");

        List<MarketModels.Frame> frames = repository.ticksForDay(new MarketModels.Session(1, "parquet", ""), DAY);

        assertEquals(2, frames.size());
        assertEquals(List.of(1L, 2L), frames.getFirst().prices().stream()
                .map(MarketModels.Tick::sequenceNumber).toList());
        assertEquals(0, new BigDecimal("101").compareTo(frames.get(1).prices().getFirst().price()));
        assertEquals(3, frames.get(1).prices().getFirst().sequenceNumber());
    }

    @Test
    void fallsBackToCandleClosesWhenTheDayPartitionIsMissing(@TempDir Path archive) {
        candle(1, "AAPL", "1m", OPEN, "100");

        List<MarketModels.Frame> frames = repository.ticksForDay(
                new MarketModels.Session(1, "parquet", archive.toString()), DAY);

        assertEquals(1, frames.size());
        assertEquals(OPEN, frames.getFirst().timestamp());
    }

    @Test
    void readsTicksFromTheDayParquetPartition(@TempDir Path archive) throws Exception {
        Path partition = archive.resolve("ticks-" + DAY + ".parquet");
        long open = OPEN.getEpochSecond();
        try (var connection = DriverManager.getConnection("jdbc:duckdb:");
             var statement = connection.createStatement()) {
            statement.execute("COPY (SELECT symbol, CAST(t AS BIGINT) AS t, CAST(price AS DECIMAL(18,6)) AS price, "
                    + "CAST(sequence_number AS BIGINT) AS sequence_number FROM (VALUES "
                    + "('MSFT', " + open + ", 300.5, 2), ('AAPL', " + open + ", 100.25, 1), "
                    + "('AAPL', " + (open + 1) + ", 100.5, 3)) AS v(symbol, t, price, sequence_number)) "
                    + "TO '" + partition.toString().replace('\\', '/') + "' (FORMAT PARQUET)");
        }
        candle(1, "AAPL", "1m", OPEN, "999");

        List<MarketModels.Frame> frames = repository.ticksForDay(
                new MarketModels.Session(1, "parquet", archive.toString()), DAY);

        assertEquals(List.of(OPEN, OPEN.plusSeconds(1)), frames.stream().map(MarketModels.Frame::timestamp).toList());
        assertEquals(List.of("AAPL", "MSFT"),
                frames.getFirst().prices().stream().map(MarketModels.Tick::symbol).toList());
        assertEquals(0, new BigDecimal("100.25").compareTo(frames.getFirst().prices().getFirst().price()));
        assertTrue(frames.stream().flatMap(f -> f.prices().stream())
                .noneMatch(t -> t.price().compareTo(new BigDecimal("999")) == 0));
    }

    private void session(long id, String status, String config, Instant createdAt) {
        jdbc.update("INSERT INTO simulation_sessions VALUES (?, ?, ?, ?)", id, status, config,
                OffsetDateTime.ofInstant(createdAt, ZoneOffset.UTC));
    }

    private void candle(long session, String symbol, String interval, Instant at, String close) {
        BigDecimal price = new BigDecimal(close);
        jdbc.update("INSERT INTO candles VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", session, symbol, interval,
                OffsetDateTime.ofInstant(at, ZoneOffset.UTC), price, price.add(BigDecimal.ONE),
                price.subtract(BigDecimal.ONE), price, 10L);
    }

    private void tick(long session, String symbol, Instant at, String price, long sequence) {
        jdbc.update("INSERT INTO market_ticks VALUES (?, ?, ?, ?, ?)", session, symbol,
                OffsetDateTime.ofInstant(at, ZoneOffset.UTC), new BigDecimal(price), sequence);
    }
}
