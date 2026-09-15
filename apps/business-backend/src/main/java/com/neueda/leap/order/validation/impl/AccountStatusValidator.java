package com.neueda.leap.order.validation.impl;

import com.neueda.leap.account.Account;
import com.neueda.leap.instrument.Instrument;
import com.neueda.leap.order.dto.OrderRequest;
import com.neueda.leap.order.validation.OrderValidator;
import com.neueda.leap.order.validation.ValidationResult;
import com.neueda.leap.user.User;
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
