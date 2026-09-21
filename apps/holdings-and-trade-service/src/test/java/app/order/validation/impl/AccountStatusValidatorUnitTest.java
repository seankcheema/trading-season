package app.order.validation.impl;

import app.account.Account;
import app.instrument.Instrument;
import app.order.Order;
import app.order.dto.OrderRequest;
import app.order.validation.ValidationResult;
import app.user.User;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

@Tag("unit")
class AccountStatusValidatorUnitTest {

    private final AccountStatusValidator validator = new AccountStatusValidator();

    private OrderRequest request() {
        return new OrderRequest(1, 1, Order.TYPE_BUY, BigDecimal.TEN,
                BigDecimal.valueOf(100), null, UUID.randomUUID());
    }

    @Test
    void rejectsWhenAccountIsNotActive() {
        User user = new User();
        user.setAccountStatus("DEACTIVATED");

        ValidationResult result = validator.validate(request(), user, new Account(), new Instrument());

        assertFalse(result.passed());
    }

    @Test
    void passesWhenAccountIsActive() {
        User user = new User();
        user.setAccountStatus("ACTIVE");

        ValidationResult result = validator.validate(request(), user, new Account(), new Instrument());

        assertTrue(result.passed());
    }
}