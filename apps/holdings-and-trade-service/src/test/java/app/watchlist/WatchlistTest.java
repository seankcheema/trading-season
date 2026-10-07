package app.watchlist;

import app.user.UserNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.server.ResponseStatusException;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;

class WatchlistTest {
    private JdbcTemplate jdbc;
    private WatchlistService service;
    private WatchlistController controller;
    private final UUID alice = UUID.randomUUID();
    private final UUID bob = UUID.randomUUID();

    @BeforeEach
    public void setup() {
        jdbc = new JdbcTemplate(new DriverManagerDataSource("jdbc:h2:mem:" + UUID.randomUUID() + ";MODE=PostgreSQL;DB_CLOSE_DELAY=-1", "sa", ""));
        jdbc.execute("CREATE TABLE users(user_id UUID PRIMARY KEY)");
        jdbc.execute("CREATE TABLE stocks(symbol VARCHAR(5) PRIMARY KEY)");
        jdbc.execute("CREATE TABLE user_watchlist(user_id UUID REFERENCES users ON DELETE CASCADE, symbol VARCHAR(5) REFERENCES stocks ON DELETE CASCADE, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL, PRIMARY KEY(user_id, symbol))");
        jdbc.update("INSERT INTO users VALUES (?), (?)", alice, bob);
        jdbc.update("INSERT INTO stocks VALUES ('AAPL'), ('MSFT')");
        service = new WatchlistService(new WatchlistRepository(jdbc));
        controller = new WatchlistController(service);
    }

    private Jwt token(UUID id) {
        return Jwt.withTokenValue("verified").header("alg", "RS256").subject(id.toString()).build();
    }

    @Test
    void savesNormalizedSymbolsIdempotentlyAndKeepsUserListsIsolated() {
        var first = controller.add(token(alice), " aapl ");
        assertEquals("AAPL", first.symbol());
        assertNotNull(first.createdAt());
        assertEquals(first, controller.add(token(alice), "AAPL"));
        controller.add(token(alice), "MSFT");
        assertEquals(2, controller.list(token(alice)).size());
        assertTrue(controller.list(token(bob)).isEmpty());
        controller.remove(token(bob), "aapl");
        assertEquals(2, service.list(alice).size());
        controller.remove(token(alice), " aapl ");
        controller.remove(token(alice), "AAPL");
        assertEquals("MSFT", service.list(alice).getFirst().symbol());
    }

    @Test
    void rejectsUnknownStocksAndMissingProfilesWithoutWriting() {
        assertEquals(404, assertThrows(ResponseStatusException.class, () -> service.add(alice, "NOPE")).getStatusCode().value());
        assertNotNull(assertThrows(UserNotFoundException.class, () -> service.add(UUID.randomUUID(), "AAPL")));
        assertTrue(service.list(alice).isEmpty());
    }

    @Test
    void stockAndUserDeletionCascadeOnlyTheirEntries() {
        service.add(alice, "AAPL");
        service.add(bob, "AAPL");
        service.add(bob, "MSFT");
        jdbc.update("DELETE FROM users WHERE user_id = ?", alice);
        assertTrue(service.list(alice).isEmpty());
        assertEquals(2, service.list(bob).size());
        jdbc.update("DELETE FROM stocks WHERE symbol = 'AAPL'");
        assertEquals("MSFT", service.list(bob).getFirst().symbol());
    }
}
