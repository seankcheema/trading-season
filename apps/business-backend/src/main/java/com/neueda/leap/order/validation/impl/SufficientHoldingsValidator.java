package com.neueda.leap.order.validation.impl;

import com.neueda.leap.account.Account;
import com.neueda.leap.holding.Holding;
import com.neueda.leap.holding.HoldingRepository;
import com.neueda.leap.instrument.Instrument;
import com.neueda.leap.order.Order;
import com.neueda.leap.order.dto.OrderRequest;
import com.neueda.leap.order.validation.OrderValidator;
import com.neueda.leap.order.validation.ValidationResult;
import com.neueda.leap.user.User;
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
