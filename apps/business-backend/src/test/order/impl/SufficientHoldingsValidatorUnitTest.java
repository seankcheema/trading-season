package com.neueda.leap.order.validation.impl;

import com.neueda.leap.account.Account;
import com.neueda.leap.holding.Holding;
import com.neueda.leap.holding.HoldingRepository;
import com.neueda.leap.instrument.Instrument;
import com.neueda.leap.order.Order;
import com.neueda.leap.order.dto.OrderRequest;
import com.neueda.leap.order.validation.ValidationResult;
import com.neueda.leap.user.User;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@Tag("unit")
class SufficientHoldingsValidatorUnitTest {

    @Mock
    private HoldingRepository holdingRepository;

    private SufficientHoldingsValidator validator;

    private final Account account = new Account();
    private final Instrument instrument = new Instrument();

    private OrderRequest sellRequest(String quantity) {
        return new OrderRequest(1, 1, Order.TYPE_SELL,
                new BigDecimal(quantity), BigDecimal.valueOf(100), null, UUID.randomUUID());
    }

    private Holding holdingOf(String quantity) {
        Holding holding = new Holding();
        holding.setQuantity(new BigDecimal(quantity));
        return holding;
    }

    @Test
    void rejectsSellThatExceedsCurrentHolding() {
        validator = new SufficientHoldingsValidator(holdingRepository);
        account.setAccountId(1);
        instrument.setInstrumentId(1);
        when(holdingRepository.findByAccountIdAndInstrumentId(1, 1)).thenReturn(Optional.of(holdingOf("5")));

        ValidationResult result = validator.validate(sellRequest("10"), new User(), account, instrument);

        assertFalse(result.passed());
    }

    @Test
    void passesSellThatExactlyMatchesCurrentHolding() {
        validator = new SufficientHoldingsValidator(holdingRepository);
        account.setAccountId(1);
        instrument.setInstrumentId(1);
        when(holdingRepository.findByAccountIdAndInstrumentId(1, 1)).thenReturn(Optional.of(holdingOf("10")));

        ValidationResult result = validator.validate(sellRequest("10"), new User(), account, instrument);

        assertTrue(result.passed());
    }

    @Test
    void rejectsSellWithNoHoldingAtAll() {
        validator = new SufficientHoldingsValidator(holdingRepository);
        account.setAccountId(1);
        instrument.setInstrumentId(1);
        when(holdingRepository.findByAccountIdAndInstrumentId(1, 1)).thenReturn(Optional.empty());

        ValidationResult result = validator.validate(sellRequest("1"), new User(), account, instrument);

        assertFalse(result.passed());
    }
}
