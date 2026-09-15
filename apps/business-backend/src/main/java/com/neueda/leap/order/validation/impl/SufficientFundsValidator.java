package com.neueda.leap.order.validation.impl;

import com.neueda.leap.account.Account;
import com.neueda.leap.instrument.Instrument;
import com.neueda.leap.order.Order;
import com.neueda.leap.order.dto.OrderRequest;
import com.neueda.leap.order.validation.OrderValidator;
import com.neueda.leap.order.validation.ValidationResult;
import com.neueda.leap.user.User;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

/**
 * BR-09/10: a BUY can't cost more than the account's cash balance. This is
 * a fast-reject check against the cached {@code cashBalance} at validation
 * time — {@code OrderExecutionService} re-checks under a row lock
 * immediately before writing the fill, since two concurrent orders can both
 * pass this check against the same stale balance.
 */
@Component
public class SufficientFundsValidator implements OrderValidator {

    @Override
    public ValidationResult validate(OrderRequest request, User user, Account account, Instrument instrument) {
        if (!Order.TYPE_BUY.equals(request.orderType())) {
            return ValidationResult.pass();
        }
        BigDecimal cost = request.quantity().multiply(request.indicativePrice());
        if (cost.compareTo(account.getCashBalance()) > 0) {
            return ValidationResult.reject("BR-09: insufficient funds for this order");
        }
        return ValidationResult.pass();
    }
}
