package app.auth;

/** Login rejected: unknown user, bad password, locked, or inactive account. */
public class UnauthorizedException extends RuntimeException {
    /**
     * Creates an authentication failure with a client-safe message.
     *
     * @param message authentication failure description
     */
    public UnauthorizedException(String message) {
        super(message);
    }
}
