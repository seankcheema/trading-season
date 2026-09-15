package com.neueda.leap.order.validation.impl;

import com.neueda.leap.account.Account;
import com.neueda.leap.instrument.Instrument;
import com.neueda.leap.order.Order;
import com.neueda.leap.order.dto.OrderRequest;
import com.neueda.leap.order.validation.ValidationResult;
import com.neueda.leap.user.User;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
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
    void rejectsWhenAccountIsLocked() {
        User user = new User();
        user.setAccountStatus("ACTIVE");
        user.setLockedUntil(OffsetDateTime.now().plusMinutes(5));

        ValidationResult result = validator.validate(request(), user, new Account(), new Instrument());

        assertFalse(result.passed());
    }

    @Test
    void passesWhenActiveAndLockExpired() {
        User user = new User();
        user.setAccountStatus("ACTIVE");
        user.setLockedUntil(OffsetDateTime.now().minusMinutes(5));

        ValidationResult result = validator.validate(request(), user, new Account(), new Instrument());

        assertTrue(result.passed());
    }

    @Test
    void passesWhenActiveAndNeverLocked() {
        User user = new User();
        user.setAccountStatus("ACTIVE");

        ValidationResult result = validator.validate(request(), user, new Account(), new Instrument());

        assertTrue(result.passed());
    }
}
