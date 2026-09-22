package app.order.validation.impl;

import app.account.Account;
import app.instrument.Instrument;
import app.order.dto.OrderRequest;
import app.order.validation.OrderValidator;
import app.order.validation.ValidationResult;
import app.user.User;
import org.springframework.stereotype.Component;

/**
 * The user who owns the account must be ACTIVE (KAN-86/92) — a deactivated
 * trader shouldn't be able to place trades even if the request itself is
 * otherwise well-formed. Login lockout (KAN-84) is enforced by the auth
 * service, which won't issue a token to a locked-out user.
 */
@Component
public class AccountStatusValidator implements OrderValidator {

    @Override
    public ValidationResult validate(OrderRequest request, User user, Account account, Instrument instrument) {
        if (!"ACTIVE".equals(user.getAccountStatus())) {
            return ValidationResult.reject("Account is not active");
        }
        return ValidationResult.pass();
    }
}


