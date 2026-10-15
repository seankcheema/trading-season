package app.account;

import app.auth.AuthenticatedUser;
import io.swagger.v3.oas.annotations.Operation;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpStatus;
import java.util.List;

/** Authenticated account lifecycle endpoints; ownership always comes from the token. */
@io.swagger.v3.oas.annotations.responses.ApiResponses({
    @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "Authentication required"),
    @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "403", description = "Account belongs to another user"),
    @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "Account not found"),
    @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "409", description = "Account lifecycle requirement not met")
})
@RestController
@RequestMapping("/api/me/accounts")
public class AccountLifecycleController {
    private final AccountLifecycleService service;
    /**
     * Creates the lifecycle controller.
     * @param service transactional lifecycle validation
     */
    public AccountLifecycleController(AccountLifecycleService service) { this.service = service; }

    /**
     * Lists archived history accounts.
     * @param jwt verified caller token
     * @return owned archived accounts
     */
    @GetMapping("/archived")
    @Operation(summary = "List archived accounts", description = "Read-only historical accounts owned by the caller")
    public List<AccountResponse> archived(@AuthenticationPrincipal Jwt jwt) {
        return service.archived(AuthenticatedUser.from(jwt).userId()).stream().map(AccountResponse::from).toList();
    }

    /**
     * Explains eligibility before confirmation.
     * @param accountId account id
     * @param jwt verified caller token
     * @return specific blockers; mutations revalidate atomically
     */
    @GetMapping("/{accountId}/eligibility")
    @Operation(summary = "Explain archive and delete eligibility")
    public AccountLifecycleService.Eligibility eligibility(@PathVariable Integer accountId, @AuthenticationPrincipal Jwt jwt) {
        return service.eligibility(accountId, AuthenticatedUser.from(jwt).userId());
    }

    /**
     * Archives an empty active account, retaining history.
     * @param accountId account id
     * @param jwt verified caller token
     * @return archived account; invalid states return 409, unowned 403, missing 404
     */
    @PostMapping("/{accountId}/archive")
    @Operation(summary = "Archive account", description = "Requires zero cash, zero shares, no open orders. Retains financial history. Returns 409 for unmet requirements.")
    public AccountResponse archive(@PathVariable Integer accountId, @AuthenticationPrincipal Jwt jwt) {
        return AccountResponse.from(service.archive(accountId, AuthenticatedUser.from(jwt).userId()));
    }

    /**
     * Deletes from the active client view by archiving; all database records remain.
     * @param accountId account id
     * @param confirmed explicit user confirmation, required to be true
     * @param jwt verified caller token
     */
    @DeleteMapping("/{accountId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Delete account from active view", description = "Soft deletion: archives the account and retains every database record for reporting. Requires confirmed=true and archive eligibility. Returns 400 without confirmation, 409 for assets, open orders or archived state, 403 for unowned, 404 for missing.")
    public void delete(@PathVariable Integer accountId, @RequestParam(defaultValue = "false") boolean confirmed,
            @AuthenticationPrincipal Jwt jwt) {
        service.delete(accountId, AuthenticatedUser.from(jwt).userId(), confirmed);
    }
}
