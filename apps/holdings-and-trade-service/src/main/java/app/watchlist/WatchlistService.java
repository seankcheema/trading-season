package app.watchlist;

import app.user.UserNotFoundException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

/** Manages the caller's single watchlist across all trading accounts. */
@Service
public class WatchlistService {
    private final WatchlistRepository repository;

    /**
     * @param repository caller-scoped saved stock persistence
     */
    public WatchlistService(WatchlistRepository repository) { this.repository = repository; }

    /**
     * @param owner verified caller UUID
     * @return stocks ordered by addition time
     */
    public List<WatchlistRepository.Entry> list(UUID owner) { return repository.list(owner); }

    /**
     * Saves a stock once, preserving the original addition time on retries.
     * @param owner verified caller UUID
     * @param symbol stock symbol
     * @return saved stock
     * @throws UserNotFoundException if the caller has no business profile
     * @throws ResponseStatusException with 404 if the stock is unknown
     */
    @Transactional
    public WatchlistRepository.Entry add(UUID owner, String symbol) {
        String normalized = symbol.trim().toUpperCase(Locale.ROOT);
        if (!repository.stockExists(normalized)) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Unknown stock symbol");
        if (!repository.lockOwner(owner)) throw new UserNotFoundException("Business profile not found");
        repository.add(owner, normalized);
        return repository.list(owner).stream().filter(entry -> entry.symbol().equals(normalized)).findFirst().orElseThrow();
    }

    /**
     * @param owner verified caller UUID
     * @param symbol stock symbol; removal is idempotent
     */
    @Transactional
    public void remove(UUID owner, String symbol) {
        repository.lockOwner(owner);
        repository.remove(owner, symbol.trim().toUpperCase(Locale.ROOT));
    }
}
