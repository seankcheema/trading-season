package com.neueda.leap.order.validation;

import com.neueda.leap.account.Account;
import com.neueda.leap.instrument.Instrument;
import com.neueda.leap.order.dto.OrderRequest;
import com.neueda.leap.user.User;

import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Runs every registered {@link OrderValidator} in order and stops at the
 * first rejection. Spring injects every {@code @Component} implementing
 * {@link OrderValidator} into the {@code validators} list automatically, in
 * the order Spring discovers the beans — implement {@link
 * org.springframework.core.Ordered} or use {@code @Order} on a validator if
 * a specific rule must run before another (e.g. an existence/lookup-style
 * check before a check that assumes the lookup succeeded).
 *
 * <p>This class is the "Trading rule pipeline" box from the KAN-95
 * architecture walkthrough. It has no knowledge of individual rules —
 * adding, removing, or reordering a rule never requires touching this file.
 */
@Component
public class OrderValidationPipeline {

    private final List<OrderValidator> validators;

    public OrderValidationPipeline(List<OrderValidator> validators) {
        this.validators = validators;
    }

    /**
     * Runs the order through every validator, returning the first rejection
     * encountered, or {@link ValidationResult#pass()} if none rejects it.
     */
    public ValidationResult run(OrderRequest request, User user, Account account, Instrument instrument) {
        for (OrderValidator validator : validators) {
            ValidationResult result = validator.validate(request, user, account, instrument);
            if (!result.passed()) {
                return result;
            }
        }
        return ValidationResult.pass();
    }
}
