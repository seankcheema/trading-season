package app.order.validation.impl;

import app.account.Account;
import app.holding.Holding;
import app.holding.HoldingRepository;
import app.instrument.Instrument;
import app.order.Order;
import app.order.dto.OrderRequest;
import app.order.validation.OrderValidator;
import app.order.validation.ValidationResult;
import app.user.User;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

/**
 * A SELL can't take a holding negative. Short selling isn't modelled by
 * this schema (see docs/db/SCHEMA-README.md), so unlike {@code
 * cash_balance}, {@code holdings.quantity} has no DB-level CHECK
 * preventing it — this validator is the only thing stopping it today.
 * Worth raising with the team whether {@code CHECK (quantity >= 0)}
 * should be added to the holdings table as a second line of defence.
 */
@Component
public class SufficientHoldingsValidator implements OrderValidator {

    private final HoldingRepository holdingRepository;

    public SufficientHoldingsValidator(HoldingRepository holdingRepository) {
        this.holdingRepository = holdingRepository;
    }

    @Override
    public ValidationResult validate(OrderRequest request, User user, Account account, Instrument instrument) {
        if (!Order.TYPE_SELL.equals(request.orderType())) {
            return ValidationResult.pass();
        }
        BigDecimal currentQuantity = holdingRepository
                .findByAccountIdAndInstrumentId(account.getAccountId(), instrument.getInstrumentId())
                .map(Holding::getQuantity)
                .orElse(BigDecimal.ZERO);
        if (request.quantity().compareTo(currentQuantity) > 0) {
            return ValidationResult.reject("Insufficient holdings for this SELL order");
        }
        return ValidationResult.pass();
    }
}


