package app.watchlist;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Persists saved stocks scoped to a verified caller. */
@Repository
public class WatchlistRepository {
    private final JdbcTemplate jdbc;

    /**
     * Creates the repository.
     *
     * @param jdbc database query helper
     */
    public WatchlistRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    /**
     * A saved stock, without mutable market prices.
     *
     * @param symbol seeded stock symbol
     * @param createdAt time the stock was first saved
     */
    public record Entry(String symbol, Instant createdAt) { }

    /**
     * Lists the owner's saved stocks.
     *
     * @param owner verified caller UUID
     * @return saved stocks in addition order
     */
    public List<Entry> list(UUID owner) {
        return jdbc.query("SELECT symbol, created_at FROM user_watchlist WHERE user_id = ? ORDER BY created_at, symbol",
                (row, index) -> new Entry(row.getString("symbol"), row.getTimestamp("created_at").toInstant()), owner);
    }

    /**
     * Checks whether a seeded stock exists.
     *
     * @param symbol normalized symbol
     * @return whether a seeded stock exists
     */
    public boolean stockExists(String symbol) {
        return Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS (SELECT 1 FROM stocks WHERE symbol = ?)", Boolean.class, symbol));
    }

    /**
     * Locks the owner's profile to serialize concurrent additions.
     *
     * @param owner verified caller UUID
     * @return whether the business profile exists
     */
    public boolean lockOwner(UUID owner) {
        return !jdbc.queryForList("SELECT user_id FROM users WHERE user_id = ? FOR UPDATE", owner).isEmpty();
    }

    /**
     * Saves a stock for the owner unless it is already saved.
     *
     * @param owner verified caller UUID
     * @param symbol normalized existing stock symbol
     */
    public void add(UUID owner, String symbol) {
        jdbc.update("INSERT INTO user_watchlist (user_id, symbol) SELECT ?, ? WHERE NOT EXISTS (SELECT 1 FROM user_watchlist WHERE user_id = ? AND symbol = ?)",
                owner, symbol, owner, symbol);
    }

    /**
     * Removes a saved stock for the owner.
     *
     * @param owner verified caller UUID
     * @param symbol normalized symbol; absent entries are ignored
     */
    public void remove(UUID owner, String symbol) {
        jdbc.update("DELETE FROM user_watchlist WHERE user_id = ? AND symbol = ?", owner, symbol);
    }
}
