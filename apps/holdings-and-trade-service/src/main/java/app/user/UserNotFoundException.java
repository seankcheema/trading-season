package app.user;

/** The authenticated caller has no business account yet, typically because registration was not completed. */
public class UserNotFoundException extends RuntimeException {
    /**
     * Creates the exception.
     *
     * @param message the reason returned to the caller
     */
    public UserNotFoundException(String message) {
        super(message);
    }
}
