package app.market;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.jdbc.core.JdbcTemplate;
import tools.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.DriverManager;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;

class MarketDataRepositoryTest {
    Path archive;

    @BeforeEach
    public void createArchiveDirectory() throws Exception {
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
}
