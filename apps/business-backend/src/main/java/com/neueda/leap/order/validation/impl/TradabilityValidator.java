package com.neueda.leap.order.validation.impl;

import com.neueda.leap.account.Account;
import com.neueda.leap.instrument.Instrument;
import com.neueda.leap.order.dto.OrderRequest;
import com.neueda.leap.order.validation.OrderValidator;
import com.neueda.leap.order.validation.ValidationResult;
import com.neueda.leap.user.User;
import org.springframework.stereotype.Component;

/** BR-05: an order against an instrument that isn't open for trading is rejected. */
@Component
public class TradabilityValidator implements OrderValidator {

    @Override
    public ValidationResult validate(OrderRequest request, User user, Account account, Instrument instrument) {
        if (!Boolean.TRUE.equals(instrument.isTradable())) {
            return ValidationResult.reject("BR-05: " + instrument.getTicker() + " is not currently tradable");
        }
        return ValidationResult.pass();
    }
}
