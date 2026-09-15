package com.neueda.leap.order.validation;

/**
 * The outcome of one {@link OrderValidator} check.
 *
 * @param passed whether the order satisfies this rule
 * @param reason set only when {@code passed} is false; written to
 *               {@code orders.rejection_reason} and the audit trail
 */
public record ValidationResult(boolean passed, String reason) {

    private static final ValidationResult PASS = new ValidationResult(true, null);

    public static ValidationResult pass() {
        return PASS;
    }

    public static ValidationResult reject(String reason) {
        return new ValidationResult(false, reason);
    }
}
