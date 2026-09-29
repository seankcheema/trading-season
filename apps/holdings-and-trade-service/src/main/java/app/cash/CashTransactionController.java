package app.cash;

import app.auth.AuthenticatedUser;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * REST endpoints for the authenticated caller's cash.
 *
 * <p>Cash belongs to the user and is shared by all of their accounts, so no path
 * or body parameter names an account. The caller is always resolved from the
 * bearer token, which means these endpoints cannot be pointed at another user's
 * money.
 */
@RestController
@RequestMapping("/api/me/cash-transactions")
public class CashTransactionController {

    private final CashTransactionService cashTransactionService;

    /**
     * Creates the controller.
     *
     * @param cashTransactionService cash movement and history logic
     */
    public CashTransactionController(CashTransactionService cashTransactionService) {
        this.cashTransactionService = cashTransactionService;
    }

    /**
     * Lists the caller's deposits and withdrawals, newest first.
     *
     * @param limit how many rows to return, optional
     * @param jwt   the verified access token
     * @return the caller's funding history
     */
    @GetMapping
    public List<CashTransactionResponse> listFunding(
            @RequestParam(required = false) Integer limit,
            @AuthenticationPrincipal Jwt jwt
    ) {
        AuthenticatedUser caller = AuthenticatedUser.from(jwt);
        return cashTransactionService.getFundingHistory(caller.userId(), limit)
                .stream()
                .map(CashTransactionResponse::from)
                .toList();
    }

    /**
     * Deposits or withdraws funds for the caller.
     *
     * @param request the amount and direction
     * @param jwt     the verified access token
     * @return the recorded transaction
     * @throws InsufficientFundsException     if a withdrawal exceeds the caller's funds
     * @throws app.user.UserNotFoundException if the caller has not registered
     */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CashTransactionResponse postFunding(
            @Valid @RequestBody CashTransactionRequest request,
            @AuthenticationPrincipal Jwt jwt
    ) {
        AuthenticatedUser caller = AuthenticatedUser.from(jwt);
        return CashTransactionResponse.from(
                cashTransactionService.move(caller.userId(), request.amount(), request.reason()));
    }
}
