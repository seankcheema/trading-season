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

    private User userWithFunds(String availableFunds) {
        User user = new User();
        user.setAvailableFunds(new BigDecimal(availableFunds));
        return user;
    }

    /** An account whose cached cash balance must be ignored: funds belong to the user (KAN-93). */
    private Account accountWithCash(String cashBalance) {
        Account account = new Account();
        account.setCashBalance(new BigDecimal(cashBalance));
        return account;
    }

    @Test
    void rejectsBuyThatCostsMoreThanAvailableFunds() {
        OrderRequest request = new OrderRequest(1, 1, Order.TYPE_BUY,
                BigDecimal.TEN, BigDecimal.valueOf(100), null, UUID.randomUUID());

        ValidationResult result = validator.validate(request, userWithFunds("500"), accountWithCash("0"), new Instrument());

        assertFalse(result.passed());
        assertTrue(result.reason().contains("BR-09"));
    }

    @Test
    void passesBuyThatExactlyMatchesAvailableFunds() {
        OrderRequest request = new OrderRequest(1, 1, Order.TYPE_BUY,
                BigDecimal.TEN, BigDecimal.valueOf(100), null, UUID.randomUUID());

        ValidationResult result = validator.validate(request, userWithFunds("1000"), accountWithCash("0"), new Instrument());

        assertTrue(result.passed());
    }

    @Test
    void ignoresAccountCashBalanceWhenUserFundsAreInsufficient() {
        OrderRequest request = new OrderRequest(1, 1, Order.TYPE_BUY,
                BigDecimal.TEN, BigDecimal.valueOf(100), null, UUID.randomUUID());

        ValidationResult result = validator.validate(request, userWithFunds("0"), accountWithCash("1000000"), new Instrument());

        assertFalse(result.passed());
    }

    @Test
    void ignoresAvailableFundsForSellOrders() {
        OrderRequest request = new OrderRequest(1, 1, Order.TYPE_SELL,
                BigDecimal.TEN, BigDecimal.valueOf(100), null, UUID.randomUUID());

        ValidationResult result = validator.validate(request, userWithFunds("0"), accountWithCash("0"), new Instrument());

        assertTrue(result.passed());
    }
}
