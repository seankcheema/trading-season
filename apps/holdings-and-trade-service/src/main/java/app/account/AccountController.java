package app.account;

import app.auth.AuthenticatedUser;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.Operation;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST endpoints for the authenticated caller's accounts and holdings.
 * All endpoints filter data by the authenticated user's UUID from the token's sub claim.
 * Users can only view and modify their own accounts.
 */
@RestController
@RequestMapping("/api")
@Tag(name = "Accounts", description = "Account and holdings management endpoints")
public class AccountController {

    private final AccountService accountService;

    /**
     * Creates the controller.
     *
     * @param accountService account and holding management logic
     */
    public AccountController(AccountService accountService) {
        this.accountService = accountService;
    }

    /**
     * Returns all accounts belonging to the authenticated caller.
     *
     * @param jwt the verified access token
     * @return a list of the caller's accounts
     */
    @GetMapping("/me/accounts")
    @Operation(summary = "List user accounts", description = "Retrieves all accounts owned by the authenticated user")
    public List<AccountResponse> listAccounts(@AuthenticationPrincipal Jwt jwt) {
        AuthenticatedUser caller = AuthenticatedUser.from(jwt);
        return accountService.getAccountsForUser(caller.userId())
                .stream()
                .map(AccountResponse::from)
                .toList();
    }

    /**
     * Returns a specific account if it belongs to the authenticated caller.
     *
     * @param accountId the account ID
     * @param jwt       the verified access token
     * @return the account details
     * @throws AccountNotFoundException if the account does not exist
     * @throws app.auth.ForbiddenException if the account is owned by a different user
     */
    @GetMapping("/accounts/{accountId}")
    @Operation(summary = "Get account details", description = "Retrieves details of a specific account owned by the authenticated user")
    public AccountResponse getAccount(
            @PathVariable Integer accountId,
            @AuthenticationPrincipal Jwt jwt
    ) {
        AuthenticatedUser caller = AuthenticatedUser.from(jwt);
        Account account = accountService.getAccountForUser(accountId, caller.userId());
        return AccountResponse.from(account);
    }

    /**
     * Returns all holdings for a specific account if it belongs to the authenticated caller.
     *
     * @param accountId the account ID
     * @param jwt       the verified access token
     * @return a list of holdings in this account
     * @throws AccountNotFoundException if the account does not exist
     * @throws app.auth.ForbiddenException if the account is owned by a different user
     */
    @GetMapping("/accounts/{accountId}/holdings")
    @Operation(summary = "List account holdings", description = "Retrieves all stock holdings in a specific account")
    public List<HoldingResponse> listHoldings(
            @PathVariable Integer accountId,
            @AuthenticationPrincipal Jwt jwt
    ) {
        AuthenticatedUser caller = AuthenticatedUser.from(jwt);
        return accountService.getHoldingsForAccount(accountId, caller.userId())
                .stream()
                .map(priced -> HoldingResponse.from(
                        priced.holding(), priced.instrument(), priced.averageCost()))
                .toList();
    }

    /**
     * Creates a new account for the authenticated caller.
     *
     * @param request the account creation details
     * @param jwt     the verified access token
     * @return the newly created account
     * @throws IllegalArgumentException if the request is invalid
     */
    @PostMapping("/me/accounts")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Create new account", description = "Creates a new account for the authenticated user")
    public AccountResponse createAccount(
            @RequestBody CreateAccountRequest request,
            @AuthenticationPrincipal Jwt jwt
    ) {
        AuthenticatedUser caller = AuthenticatedUser.from(jwt);
        Account account = accountService.createAccount(caller.userId(), request.name());
        return AccountResponse.from(account);
    }

    /**
     * Updates the name of an account owned by the authenticated caller.
     *
     * @param accountId the account ID
     * @param request   the update details
     * @param jwt       the verified access token
     * @return the updated account
     * @throws AccountNotFoundException if the account does not exist
     * @throws app.auth.ForbiddenException if the account is owned by a different user
     */
    @PutMapping("/me/accounts/{accountId}")
    @Operation(summary = "Update account name", description = "Updates the name of an account owned by the authenticated user")
    public AccountResponse updateAccount(
            @PathVariable Integer accountId,
            @RequestBody UpdateAccountNameRequest request,
            @AuthenticationPrincipal Jwt jwt
    ) {
        AuthenticatedUser caller = AuthenticatedUser.from(jwt);
        Account account = accountService.updateAccountName(accountId, caller.userId(), request.name());
        return AccountResponse.from(account);
    }
}
