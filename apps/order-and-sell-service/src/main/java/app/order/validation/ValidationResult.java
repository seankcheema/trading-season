package app.order.validation;

/**
 * The outcome of one {@link OrderValidator} check.
 *
 * @param passed whether the order satisfies this rule
 * @param reason set only when {@code passed} is false; written to
 *               {@code orders.rejection_reason} and the audit trail
 */
public record ValidationResult(boolean passed, String reason) {

    private static final ValidationResult PASS = new ValidationResult(true, null);

    /**
     * Returns the shared passing result.
     *
     * @return a result with {@code passed} true and no reason
     */
    public static ValidationResult pass() {
        return PASS;
    }

    /**
     * Creates a rejecting result.
     *
     * @param reason why the order failed the rule
     * @return a result with {@code passed} false and the given reason
     */
    public static ValidationResult reject(String reason) {
        return new ValidationResult(false, reason);
    }
}


