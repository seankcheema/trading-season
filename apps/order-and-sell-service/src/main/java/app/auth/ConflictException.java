package app.auth;

/** Registration rejected because the account already has a profile, or the email is registered to another account. */
public class ConflictException extends RuntimeException {
    /**
     * Creates the exception.
     *
     * @param message the reason returned to the caller
     */
    public ConflictException(String message) {
        super(message);
    }
}


