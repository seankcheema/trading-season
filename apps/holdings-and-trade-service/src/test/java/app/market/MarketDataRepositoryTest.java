package app.market;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.PreparedStatementSetter;
import org.springframework.jdbc.core.RowMapper;
import tools.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class MarketDataRepositoryTest {
    Path archive;

    @BeforeEach
    void createArchiveDirectory() throws Exception {
        archive = Path.of("target", "test-market-data", UUID.randomUUID().toString());
        Files.createDirectories(archive);
    }

    @Test
    void parquetReplayUsesExactOneSecondFramesAndPrices() throws Exception {
        LocalDate day = LocalDate.of(2026, 1, 5);
        Path partition = archive.resolve("ticks-" + day + ".parquet");
        try (var connection = DriverManager.getConnection("jdbc:duckdb:");
             var statement = connection.createStatement()) {
            statement.execute("CREATE TABLE ticks(symbol VARCHAR, t BIGINT, price DECIMAL(18,6), sequence_number BIGINT)");
            statement.execute("INSERT INTO ticks VALUES "
                    + "('AAPL', 1767623400, 100.100000, 1), "
                    + "('MSFT', 1767623400, 200.200000, 2), "
                    + "('AAPL', 1767623401, 100.300000, 3), "
                    + "('MSFT', 1767623401, 200.400000, 4)");
            statement.execute("COPY ticks TO '" + partition.toString().replace("'", "''")
                    + "' (FORMAT PARQUET)");
        }
        MarketDataRepository repository = new MarketDataRepository(mock(JdbcTemplate.class), new ObjectMapper(),
                archive.toString());

        var frames = repository.ticksForDay(new MarketModels.Session(1, "parquet",
                "C:\\old-checkout\\apps\\business-backend\\db\\seeds\\synthetic-market-data-2026-v1"), day);

        assertEquals(2, frames.size());
        assertEquals(Instant.ofEpochSecond(1767623400), frames.getFirst().timestamp());
        assertEquals(Instant.ofEpochSecond(1767623401), frames.getLast().timestamp());
        assertEquals(new BigDecimal("100.300000"), frames.getLast().prices().getFirst().price());
        assertEquals(3, frames.getLast().prices().getFirst().sequenceNumber());
    }

    @Test
    void missingParquetPartitionFailsInsteadOfUsingMinuteCandles() {
        MarketDataRepository repository = new MarketDataRepository(mock(JdbcTemplate.class), new ObjectMapper());

        var error = assertThrows(IllegalStateException.class,
                () -> repository.ticksForDay(new MarketModels.Session(1, "parquet", archive.toString()),
                        LocalDate.of(2026, 1, 5)));

        assertEquals("Simulation tick partition is unavailable", error.getMessage());
    }

    @Test
    void ticksForDayFailsWhenNoArchiveCandidateResolves() {
        MarketDataRepository repository = new MarketDataRepository(mock(JdbcTemplate.class), new ObjectMapper());

        var error = assertThrows(IllegalStateException.class,
                () -> repository.ticksForDay(
                        new MarketModels.Session(1, "parquet", "nonexistent-archive-location"),
                        LocalDate.of(2026, 1, 5)));

        assertEquals("Simulation archive location is unavailable", error.getMessage());
    }

    @Test
    @SuppressWarnings("unchecked")
    void stocksMapsSymbolAndCompanyNameColumns() throws Exception {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        MarketDataRepository repository = new MarketDataRepository(jdbc, new ObjectMapper());
        when(jdbc.query(anyString(), any(RowMapper.class))).thenAnswer(invocation -> {
            RowMapper<MarketModels.Stock> mapper = invocation.getArgument(1);
            ResultSet rs = mock(ResultSet.class);
            when(rs.getString(1)).thenReturn("AAPL");
            when(rs.getString(2)).thenReturn("Apple Inc.");
            return List.of(mapper.mapRow(rs, 0));
        });

        var stocks = repository.stocks();

        assertEquals(1, stocks.size());
        assertEquals("AAPL", stocks.getFirst().symbol());
        assertEquals("Apple Inc.", stocks.getFirst().companyName());
    }

    @Test
    @SuppressWarnings("unchecked")
    void tradingDaysMapsDistinctDateColumnForSession() throws Exception {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        MarketDataRepository repository = new MarketDataRepository(jdbc, new ObjectMapper());
        LocalDate expected = LocalDate.of(2026, 1, 5);
        when(jdbc.query(anyString(), any(RowMapper.class), eq(7L))).thenAnswer(invocation -> {
            RowMapper<LocalDate> mapper = invocation.getArgument(1);
            ResultSet rs = mock(ResultSet.class);
            when(rs.getObject(1, LocalDate.class)).thenReturn(expected);
            return List.of(mapper.mapRow(rs, 0));
        });

        var days = repository.tradingDays(7L);

        assertEquals(List.of(expected), days);
    }

    @Test
    @SuppressWarnings("unchecked")
    void candlesMapsOhlcvColumnsForRequestedRange() throws Exception {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        MarketDataRepository repository = new MarketDataRepository(jdbc, new ObjectMapper());
        Instant from = Instant.parse("2026-01-05T14:30:00Z");
        Instant to = Instant.parse("2026-01-05T21:00:00Z");
        Instant candleTime = Instant.parse("2026-01-05T14:31:00Z");
        when(jdbc.query(anyString(), any(RowMapper.class), eq(3L), eq("AAPL"),
                eq(Timestamp.from(from)), eq(Timestamp.from(to)))).thenAnswer(invocation -> {
            RowMapper<MarketModels.Candle> mapper = invocation.getArgument(1);
            ResultSet rs = mock(ResultSet.class);
            when(rs.getTimestamp(1)).thenReturn(Timestamp.from(candleTime));
            when(rs.getBigDecimal(2)).thenReturn(new BigDecimal("100.00"));
            when(rs.getBigDecimal(3)).thenReturn(new BigDecimal("101.00"));
            when(rs.getBigDecimal(4)).thenReturn(new BigDecimal("99.50"));
            when(rs.getBigDecimal(5)).thenReturn(new BigDecimal("100.75"));
            when(rs.getLong(6)).thenReturn(12_300L);
            return List.of(mapper.mapRow(rs, 0));
        });

        var candles = repository.candles(3L, "AAPL", from, to);

        assertEquals(1, candles.size());
        MarketModels.Candle candle = candles.getFirst();
        assertEquals(candleTime, candle.timestamp());
        assertEquals(new BigDecimal("100.00"), candle.open());
        assertEquals(new BigDecimal("101.00"), candle.high());
        assertEquals(new BigDecimal("99.50"), candle.low());
        assertEquals(new BigDecimal("100.75"), candle.close());
        assertEquals(12_300L, candle.volume());
    }

    @Test
    @SuppressWarnings("unchecked")
    void resolveSessionWithRequestedIdFiltersByIdAndParsesStorageConfig() throws Exception {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        MarketDataRepository repository = new MarketDataRepository(jdbc, new ObjectMapper());
        ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
        when(jdbc.query(sqlCaptor.capture(), any(PreparedStatementSetter.class), any(RowMapper.class)))
                .thenAnswer(invocation -> {
                    PreparedStatementSetter pss = invocation.getArgument(1);
                    RowMapper<MarketModels.Session> rowMapper = invocation.getArgument(2);
                    PreparedStatement ps = mock(PreparedStatement.class);
                    pss.setValues(ps);
                    verify(ps).setLong(1, 42L);
                    ResultSet rs = mock(ResultSet.class);
                    when(rs.getLong("id")).thenReturn(42L);
                    when(rs.getObject("config")).thenReturn(
                            "{\"tick_storage\":{\"mode\":\"postgres\",\"archive_location\":\"\"}}");
                    return List.of(rowMapper.mapRow(rs, 0));
                });

        MarketModels.Session session = repository.resolveSession(42L);

        assertEquals(42, session.id());
        assertEquals("postgres", session.storageMode());
        assertTrue(sqlCaptor.getValue().contains("AND id = ?"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void resolveSessionWithoutRequestedIdOmitsFilterAndThrowsWhenNoneFound() throws Exception {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        MarketDataRepository repository = new MarketDataRepository(jdbc, new ObjectMapper());
        ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<PreparedStatementSetter> pssCaptor = ArgumentCaptor.forClass(PreparedStatementSetter.class);
        when(jdbc.query(sqlCaptor.capture(), pssCaptor.capture(), any(RowMapper.class))).thenReturn(List.of());

        var error = assertThrows(MarketRequestException.class, () -> repository.resolveSession(null));

        assertEquals("Completed simulation session not found", error.getMessage());
        assertFalse(sqlCaptor.getValue().contains("AND id = ?"));
        PreparedStatement ps = mock(PreparedStatement.class);
        pssCaptor.getValue().setValues(ps);
        verifyNoInteractions(ps);
    }

    @Test
    @SuppressWarnings("unchecked")
    void resolveSessionWrapsInvalidStorageMetadataAsIllegalState() throws Exception {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        MarketDataRepository repository = new MarketDataRepository(jdbc, new ObjectMapper());
        when(jdbc.query(anyString(), any(PreparedStatementSetter.class), any(RowMapper.class)))
                .thenAnswer(invocation -> {
                    RowMapper<MarketModels.Session> rowMapper = invocation.getArgument(2);
                    ResultSet rs = mock(ResultSet.class);
                    when(rs.getLong("id")).thenReturn(1L);
                    when(rs.getObject("config")).thenReturn("not-json");
                    return List.of(rowMapper.mapRow(rs, 0));
                });

        var error = assertThrows(IllegalStateException.class, () -> repository.resolveSession(null));

        assertEquals("Simulation storage metadata is invalid", error.getMessage());
    }

    @Test
    @SuppressWarnings("unchecked")
    void ticksForDayWithPostgresStorageQueriesMarketTicksAndGroupsFrames() throws Exception {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        MarketDataRepository repository = new MarketDataRepository(jdbc, new ObjectMapper());
        Instant tickTime = Instant.parse("2026-01-05T14:30:00Z");
        when(jdbc.query(anyString(), any(RowMapper.class), eq(3L), any(Timestamp.class), any(Timestamp.class)))
                .thenAnswer(invocation -> {
                    RowMapper<MarketModels.Tick> mapper = invocation.getArgument(1);
                    ResultSet rs = mock(ResultSet.class);
                    when(rs.getString(1)).thenReturn("AAPL");
                    when(rs.getTimestamp(2)).thenReturn(Timestamp.from(tickTime));
                    when(rs.getBigDecimal(3)).thenReturn(new BigDecimal("101.500000"));
                    when(rs.getLong(4)).thenReturn(9L);
                    return List.of(mapper.mapRow(rs, 0));
                });

        var frames = repository.ticksForDay(new MarketModels.Session(3, "postgres", ""), LocalDate.of(2026, 1, 5));

        assertEquals(1, frames.size());
        assertEquals(tickTime, frames.getFirst().timestamp());
        assertEquals("AAPL", frames.getFirst().prices().getFirst().symbol());
        assertEquals(new BigDecimal("101.500000"), frames.getFirst().prices().getFirst().price());
        assertEquals(9, frames.getFirst().prices().getFirst().sequenceNumber());
    }
}
