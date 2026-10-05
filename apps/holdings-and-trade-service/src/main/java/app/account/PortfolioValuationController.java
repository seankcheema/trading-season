package app.account;

import app.auth.AuthenticatedUser;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import java.util.List;

/** Ownership-scoped portfolio history and server-calculated capture endpoints. */
@RestController
@RequestMapping("/api/accounts/{accountId}")
public class PortfolioValuationController {
    private final PortfolioValuationService service;
    /** Creates the controller.
     * @param service valuation capture and history logic */
    public PortfolioValuationController(PortfolioValuationService service) { this.service = service; }

    /**
     * Reads recorded history for an owned account.
     * @param accountId owned account
     * @param timeframe chart range; defaults to 1D
     * @param jwt verified caller
     * @return chronological observations
     */
    @GetMapping("/portfolio-history")
    public List<PortfolioValuationService.Point> history(@PathVariable Integer accountId,
            @RequestParam(defaultValue = "1D") String timeframe, @AuthenticationPrincipal Jwt jwt) {
        return service.history(accountId, AuthenticatedUser.from(jwt).userId(), timeframe);
    }

    /**
     * Captures current holdings using prices resolved on the server.
     * @param accountId owned account
     * @param jwt verified caller
     * @return fresh observation, or null before any acquisition
     */
    @PostMapping("/portfolio-valuations")
    public PortfolioValuationService.Point capture(@PathVariable Integer accountId,
            @AuthenticationPrincipal Jwt jwt) {
        return service.capture(accountId, AuthenticatedUser.from(jwt).userId(), false);
    }
}
