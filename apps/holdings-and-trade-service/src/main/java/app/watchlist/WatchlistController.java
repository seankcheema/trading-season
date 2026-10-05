package app.watchlist;

import app.auth.AuthenticatedUser;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import java.util.List;

/** Authenticated watchlist endpoints; ownership comes only from the token subject. */
@RestController
@RequestMapping("/api/me/watchlist")
public class WatchlistController {
    private final WatchlistService service;

    /**
     * @param service saved stock business logic
     */
    public WatchlistController(WatchlistService service) { this.service = service; }

    /**
     * @param jwt verified access token
     * @return caller's saved stocks
     */
    @GetMapping
    public List<WatchlistRepository.Entry> list(@AuthenticationPrincipal Jwt jwt) {
        return service.list(AuthenticatedUser.from(jwt).userId());
    }

    /**
     * @param jwt verified access token
     * @param symbol seeded stock symbol
     * @return saved stock, preserving its original timestamp on duplicate requests
     * @throws org.springframework.web.server.ResponseStatusException if the stock is unknown
     * @throws app.user.UserNotFoundException if the caller has no business profile
     */
    @PutMapping("/{symbol}")
    public WatchlistRepository.Entry add(@AuthenticationPrincipal Jwt jwt, @PathVariable String symbol) {
        return service.add(AuthenticatedUser.from(jwt).userId(), symbol);
    }

    /**
     * @param jwt verified access token
     * @param symbol stock symbol; missing entries succeed
     */
    @DeleteMapping("/{symbol}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remove(@AuthenticationPrincipal Jwt jwt, @PathVariable String symbol) {
        service.remove(AuthenticatedUser.from(jwt).userId(), symbol);
    }
}
