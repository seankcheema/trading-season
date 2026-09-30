package app.market;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.InvalidPathException;
import java.nio.file.Path;
import java.sql.DriverManager;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Reads completed synthetic market sessions, candles, and replay ticks. */
@Repository
public class MarketDataRepository implements MarketDataSource {
    private static final ZoneId MARKET_ZONE = ZoneId.of("America/Chicago");
    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;
    private final String configuredArchiveLocation;

    /**
     * Creates the repository with JDBC, JSON metadata, and an optional archive override.
     * @param jdbc database query helper
     * @param objectMapper simulation metadata parser
     * @param configuredArchiveLocation configured Parquet archive root, or blank to discover it
     */
    @Autowired
    public MarketDataRepository(JdbcTemplate jdbc, ObjectMapper objectMapper,
            @Value("${market.replay.archive-location:}") String configuredArchiveLocation) {
        this.jdbc = jdbc;
        this.objectMapper = objectMapper;
        this.configuredArchiveLocation = configuredArchiveLocation;
    }

    MarketDataRepository(JdbcTemplate jdbc, ObjectMapper objectMapper) {
        this(jdbc, objectMapper, "");
    }

    /**
     * Resolves a requested completed session, or the newest completed session when absent.
     * @param requestedId optional simulation identifier
     * @return resolved completed session metadata
     * @throws MarketRequestException when no matching completed session exists
     */
    public MarketModels.Session resolveSession(Long requestedId) {
        String where = requestedId == null ? "" : " AND id = ?";
        String sql = "SELECT id, config FROM simulation_sessions WHERE status = 'COMPLETED'" + where
                + " ORDER BY created_at DESC, id DESC LIMIT 1";
        List<MarketModels.Session> rows = jdbc.query(sql, ps -> {
            if (requestedId != null) ps.setLong(1, requestedId);
        }, (rs, row) -> parseSession(rs.getLong("id"), String.valueOf(rs.getObject("config"))));
        if (rows.isEmpty()) throw new MarketRequestException("Completed simulation session not found");
        return rows.getFirst();
    }

    /** @return all simulator stocks in stable symbol order */
    public List<MarketModels.Stock> stocks() {
        return jdbc.query("SELECT symbol, company_name FROM stocks ORDER BY symbol",
                (rs, row) -> new MarketModels.Stock(rs.getString(1), rs.getString(2)));
    }

    /**
     * Returns distinct seeded trading days for a session.
     * @param sessionId simulation identifier
     * @return chronological trading dates
     */
    public List<LocalDate> tradingDays(long sessionId) {
        return jdbc.query("SELECT DISTINCT CAST(\"timestamp\" AT TIME ZONE 'America/Chicago' AS date) AS trading_day "
                        + "FROM candles WHERE session_id = ? ORDER BY trading_day",
                (rs, row) -> rs.getObject(1, LocalDate.class), sessionId);
    }

    /**
     * Loads one trading day's synchronized tick frames from PostgreSQL or Parquet.
     * @param session resolved simulation metadata
     * @param day trading date
     * @return chronological synchronized frames
     */
    public List<MarketModels.Frame> ticksForDay(MarketModels.Session session, LocalDate day) {
        return "postgres".equals(session.storageMode())
                ? postgresTicks(session.id(), day) : parquetTicks(session, day);
    }

    /**
     * Loads bounded one-minute candles for server-side aggregation.
     * @param sessionId simulation identifier
     * @param symbol stock symbol
     * @param from inclusive range start
     * @param to inclusive range end
     * @return chronological one-minute candles
     */
    public List<MarketModels.Candle> candles(long sessionId, String symbol, Instant from, Instant to) {
        return jdbc.query("SELECT \"timestamp\", open, high, low, close, volume FROM candles "
                        + "WHERE session_id = ? AND symbol = ? AND \"interval\" = '1m' "
                        + "AND \"timestamp\" >= ? AND \"timestamp\" <= ? ORDER BY \"timestamp\"",
                (rs, row) -> new MarketModels.Candle(rs.getTimestamp(1).toInstant(), rs.getBigDecimal(2),
                        rs.getBigDecimal(3), rs.getBigDecimal(4), rs.getBigDecimal(5), rs.getLong(6)),
                sessionId, symbol, java.sql.Timestamp.from(from), java.sql.Timestamp.from(to));
    }

    private MarketModels.Session parseSession(long id, String configText) {
        try {
            JsonNode storage = objectMapper.readTree(configText).path("tick_storage");
            String mode = storage.path("mode").asText("parquet");
            String archive = storage.path("archive_location").asText("");
            return new MarketModels.Session(id, mode, archive);
        } catch (Exception ex) {
            throw new IllegalStateException("Simulation storage metadata is invalid", ex);
        }
    }

    private List<MarketModels.Frame> postgresTicks(long sessionId, LocalDate day) {
        Instant from = day.atTime(8, 30).atZone(MARKET_ZONE).toInstant();
        Instant to = day.plusDays(1).atStartOfDay(MARKET_ZONE).toInstant();
        List<MarketModels.Tick> ticks = jdbc.query("SELECT symbol, \"timestamp\", price, sequence_number "
                        + "FROM market_ticks WHERE session_id = ? AND \"timestamp\" >= ? AND \"timestamp\" < ? "
                        + "ORDER BY \"timestamp\", symbol",
                (rs, row) -> new MarketModels.Tick(rs.getString(1), rs.getTimestamp(2).toInstant(),
                        rs.getBigDecimal(3), rs.getLong(4)), sessionId,
                java.sql.Timestamp.from(from), java.sql.Timestamp.from(to));
        return frames(ticks);
    }

    private List<MarketModels.Frame> parquetTicks(MarketModels.Session session, LocalDate day) {
        Path root = resolveArchiveRoot(session);
        Path file = root.resolve("ticks-" + day + ".parquet").normalize();
        if (!file.startsWith(root) || !Files.isRegularFile(file)) {
            throw new IllegalStateException("Simulation tick partition is unavailable");
        }
        List<MarketModels.Tick> ticks = new ArrayList<>(234_000);
        try (var connection = DriverManager.getConnection("jdbc:duckdb:");
             var statement = connection.prepareStatement(
                     "SELECT symbol, t, price, sequence_number FROM read_parquet(?) ORDER BY t, symbol")) {
            statement.setString(1, file.toString());
            try (var rs = statement.executeQuery()) {
                while (rs.next()) {
                    ticks.add(new MarketModels.Tick(rs.getString(1), Instant.ofEpochSecond(rs.getLong(2)),
                            rs.getBigDecimal(3), rs.getLong(4)));
                }
            }
        } catch (Throwable ex) {
            throw new IllegalStateException("Unable to load the simulation tick partition", ex);
        }
        return frames(ticks);
    }

    private Path resolveArchiveRoot(MarketModels.Session session) {
        List<Path> candidates = new ArrayList<>();
        addPathCandidate(candidates, configuredArchiveLocation);
        addPathCandidate(candidates, session.archiveLocation());
        String normalizedArchive = session.archiveLocation().replace('\\', '/');
        int separator = normalizedArchive.lastIndexOf('/');
        String archiveName = normalizedArchive.isBlank() ? "synthetic-market-data-2026-v1"
                : normalizedArchive.substring(separator + 1);
        candidates.add(Path.of("apps", "market-data", "db", "seeds", archiveName));
        candidates.add(Path.of("..", "market-data", "db", "seeds", archiveName));
        return candidates.stream().map(path -> path.toAbsolutePath().normalize())
                .filter(Files::isDirectory).findFirst()
                .orElseThrow(() -> new IllegalStateException("Simulation archive location is unavailable"));
    }

    private void addPathCandidate(List<Path> candidates, String location) {
        if (location.isBlank()) return;
        try {
            candidates.add(Path.of(location));
        } catch (InvalidPathException ignored) {
            // A metadata path from another host cannot be used locally; discovery candidates follow.
        }
    }

    private List<MarketModels.Frame> frames(List<MarketModels.Tick> ticks) {
        Map<Instant, List<MarketModels.Tick>> grouped = new LinkedHashMap<>();
        for (MarketModels.Tick tick : ticks) {
            grouped.computeIfAbsent(tick.timestamp(), ignored -> new ArrayList<>()).add(tick);
        }
        return grouped.entrySet().stream().map(entry -> new MarketModels.Frame(entry.getKey(), entry.getValue())).toList();
    }
}
