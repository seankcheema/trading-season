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
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

@Tag("unit")
class TradabilityValidatorUnitTest {

    private final TradabilityValidator validator = new TradabilityValidator();

    private OrderRequest request() {
        return new OrderRequest(1, 1, Order.TYPE_BUY, BigDecimal.TEN,
                BigDecimal.valueOf(100), null, UUID.randomUUID());
    }

    private Instrument instrument(boolean tradable) {
        Instrument instrument = new Instrument();
        instrument.setInstrumentId(1);
        instrument.setTicker("ACME");
        instrument.setTradable(tradable);
        return instrument;
    }

    @Test
    void rejectsWhenInstrumentIsNotTradable() {
        ValidationResult result = validator.validate(request(), new User(), new Account(), instrument(false));

        assertFalse(result.passed());
        assertTrue(result.reason().contains("BR-05"));
    }

    @Test
    void passesWhenInstrumentIsTradable() {
        ValidationResult result = validator.validate(request(), new User(), new Account(), instrument(true));

        assertTrue(result.passed());
    }
}
