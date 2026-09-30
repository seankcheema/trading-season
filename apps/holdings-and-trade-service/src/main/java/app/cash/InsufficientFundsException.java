package app.cash;

/**
 * A withdrawal asked for more than the user's available funds.
 *
 * <p>Distinct from a validation failure: the request is well formed, it is the
 * account state that refuses it, so it is reported as 422 rather than 400.
 */
public class InsufficientFundsException extends RuntimeException {

    /**
     * Creates the exception.
     *
     * @param message the reason shown to the caller
     */
    public InsufficientFundsException(String message) {
        super(message);
    }
}
