package app.account;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

import app.auth.AuthenticatedUser;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import java.util.List;

/** Ownership-scoped portfolio history and server-calculated capture endpoints. */
@RestController
@RequestMapping("/api/accounts/{accountId}")
@Tag(name = "Portfolio valuations", description = "Portfolio value history for an owned account")
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
    @Operation(summary = "Portfolio value history",
            description = "Chronological value observations for an owned account over the timeframe (1D, 5D, 1W, 1M or 1Y). "
                    + "Points are recorded once a minute for accounts that have bought, on request through POST "
                    + "/portfolio-valuations, and by the portfolio-valuation-capture Kafka consumer at the moment an order fills.")
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
    @Operation(summary = "Record a portfolio valuation now",
            description = "Calculates and stores the account's current value. Returns null before the account's first acquisition. "
                    + "A fill already triggers the same capture through the trade-events consumer; this request is coalesced with it.")
    @PostMapping("/portfolio-valuations")
    public PortfolioValuationService.Point capture(@PathVariable Integer accountId,
            @AuthenticationPrincipal Jwt jwt) {
        return service.capture(accountId, AuthenticatedUser.from(jwt).userId(), false);
    }
}
