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
class SufficientFundsValidatorUnitTest {

    private final SufficientFundsValidator validator = new SufficientFundsValidator();

    private Account accountWithBalance(String balance) {
        Account account = new Account();
        account.setCashBalance(new BigDecimal(balance));
        return account;
    }

    @Test
    void rejectsBuyThatCostsMoreThanCashBalance() {
        OrderRequest request = new OrderRequest(1, 1, Order.TYPE_BUY,
                BigDecimal.TEN, BigDecimal.valueOf(100), null, UUID.randomUUID());

        ValidationResult result = validator.validate(request, new User(), accountWithBalance("500"), new Instrument());

        assertFalse(result.passed());
        assertTrue(result.reason().contains("BR-09"));
    }

    @Test
    void passesBuyThatExactlyMatchesCashBalance() {
        OrderRequest request = new OrderRequest(1, 1, Order.TYPE_BUY,
                BigDecimal.TEN, BigDecimal.valueOf(100), null, UUID.randomUUID());

        ValidationResult result = validator.validate(request, new User(), accountWithBalance("1000"), new Instrument());

        assertTrue(result.passed());
    }

    @Test
    void ignoresCashBalanceForSellOrders() {
        OrderRequest request = new OrderRequest(1, 1, Order.TYPE_SELL,
                BigDecimal.TEN, BigDecimal.valueOf(100), null, UUID.randomUUID());

        ValidationResult result = validator.validate(request, new User(), accountWithBalance("0"), new Instrument());

        assertTrue(result.passed());
    }
}