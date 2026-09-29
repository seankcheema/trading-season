package app.order.validation.impl;

import app.account.Account;
import app.instrument.Instrument;
import app.order.dto.OrderRequest;
import app.order.validation.OrderValidator;
import app.order.validation.ValidationResult;
import app.user.User;
import app.user.UserAccount;
import app.user.UserAccountRepository;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * The account placing the order must be ACTIVE (KAN-86/92) — a deactivated
 * trader should not be able to trade even if the request is otherwise
 * well-formed. Login lockout (KAN-84) is enforced by the auth service, which
 * will not issue a token to a locked-out account.
 *
 * <p>Status is read from {@code user_accounts} on every order rather than taken
 * from the access token. A claim is a snapshot: tokens live fifteen minutes, so
 * a claim-based check would let a deactivated trader keep placing orders for up
 * to that long after being deactivated. That window is acceptable for reads; it
 * is not acceptable for moving money, which is why this one validator pays for
 * a lookup and the rest of the request path stays stateless.
 */
@Component
public class AccountStatusValidator implements OrderValidator {

    private final UserAccountRepository userAccountRepository;

    /**
     * Creates the validator.
     *
     * @param userAccountRepository read-only access to the auth service's
     *                              credential records
     */
    public AccountStatusValidator(UserAccountRepository userAccountRepository) {
        this.userAccountRepository = userAccountRepository;
    }

    /**
     * Rejects the order unless the caller's account is currently ACTIVE.
     *
     * @param request    the submitted order
     * @param user       the caller's business account
     * @param account    the trading account the order is for
     * @param instrument the instrument being traded
     * @return a pass if the account is ACTIVE, otherwise a rejection
     */
    @Override
    public ValidationResult validate(OrderRequest request, User user, Account account, Instrument instrument) {
        Optional<UserAccount> credentials = userAccountRepository.findById(user.getUserId());

        // Fail closed. A missing record means a profile exists with no account
        // behind it, which the users.user_id foreign key is supposed to prevent;
        // if it happens anyway, refusing the trade is the safe reading.
        if (credentials.isEmpty()) {
            return ValidationResult.reject("Account is not active");
        }

        if (!credentials.get().isActive()) {
            return ValidationResult.reject("Account is not active");
        }

        return ValidationResult.pass();
    }
}
