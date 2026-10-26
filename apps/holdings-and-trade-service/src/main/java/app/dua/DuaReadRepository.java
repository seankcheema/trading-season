package app.dua;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.UUID;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Persists exact viewed versions without overwriting newer acknowledgments. */
@Repository
public class DuaReadRepository {
    private final JdbcTemplate jdbc;

    /**
     * Creates persistence access.
     * @param jdbc database access
     */
    public DuaReadRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    /**
     * Tests whether the exact version was viewed.
     * @param owner verified caller
     * @param context requested version
     * @return whether an acknowledgment exists
     */
    public boolean viewed(UUID owner, DuaReadService.Context context) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM dua_read_state WHERE id = ? AND user_id = ?",
                Integer.class, id(owner, context), owner) > 0;
    }

    /**
     * Records one version; repeated and concurrent acknowledgments succeed.
     * @param owner verified caller
     * @param context rendered version
     */
    public void save(UUID owner, DuaReadService.Context context) {
        try {
            jdbc.update("INSERT INTO dua_read_state (id, user_id, account_id, session_id, insight, symbol, version) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    id(owner, context), owner, context.accountId(), context.sessionId(), context.insight(), context.symbol(), context.version());
        } catch (DuplicateKeyException alreadyViewed) {
            // Exact versions are immutable: another device already saved this acknowledgment.
        }
    }

    private String id(UUID owner, DuaReadService.Context context) {
        String value = owner + ":" + context.accountId() + ":" + context.sessionId() + ":" + context.insight()
                + ":" + context.symbol() + ":" + context.version();
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException unavailable) {
            throw new IllegalStateException("SHA-256 unavailable", unavailable);
        }
    }
}
