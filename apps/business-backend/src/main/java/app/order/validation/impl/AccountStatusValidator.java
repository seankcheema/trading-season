package app.order.validation.impl;

import app.account.Account;
import app.instrument.Instrument;
import app.order.dto.OrderRequest;
import app.order.validation.OrderValidator;
import app.order.validation.ValidationResult;
import app.user.User;
import org.springframework.stereotype.Component;

import java.time.OffsetDateTime;

/**
 * The user who owns the account must be ACTIVE and not currently locked
 * out (KAN-84/86/92) — a deactivated or locked-out trader shouldn't be able
 * to place trades even if the request itself is otherwise well-formed.
 */
@Component
public class AccountStatusValidator implements OrderValidator {

    @Override
    public ValidationResult validate(OrderRequest request, User user, Account account, Instrument instrument) {
        if (!"ACTIVE".equals(user.getAccountStatus())) {
            return ValidationResult.reject("Account is not active");
        }
        if (user.getLockedUntil() != null && user.getLockedUntil().isAfter(OffsetDateTime.now())) {
            return ValidationResult.reject("Account is temporarily locked");
        }
        return ValidationResult.pass();
    }
}


