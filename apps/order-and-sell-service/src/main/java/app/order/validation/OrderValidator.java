package app.order.validation;

import app.account.Account;
import app.instrument.Instrument;
import app.order.dto.OrderRequest;
import app.user.User;

/**
 * One trading rule. Implementations are {@code @Component} beans;
 * {@link OrderValidationPipeline} collects all of them automatically, so
 * adding a new rule is adding a new class here, not editing the pipeline.
 *
 * <p>Keep each implementation named after the rule it enforces and reference
 * its BR-/KAN- number in a comment, matching the convention already used in
 * {@code V001__Initial_schema.sql} — that mapping is what makes a rejection
 * reason traceable back to a specific requirement in the audit trail.
 */
public interface OrderValidator {

    /**
     * Checks the order against this one rule. Implementations must not
     * mutate {@code account}, {@code instrument}, or {@code user}, must have
     * no side effects, and must not assume anything about which other
     * validators have or haven't run — {@link OrderValidationPipeline} stops
     * at the first rejection, so a validator can't rely on an earlier one
     * having already ruled out some case.
     *
     * @param request the order being validated
     * @param user the order owner
     * @param account the account the order is placed against
     * @param instrument the instrument being traded
     * @return the outcome of this rule
     */
    ValidationResult validate(OrderRequest request, User user, Account account, Instrument instrument);
}


