package app.order.validation.impl;

import app.account.Account;
import app.instrument.Instrument;
import app.order.dto.OrderRequest;
import app.order.validation.OrderValidator;
import app.order.validation.ValidationResult;
import app.user.User;
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


