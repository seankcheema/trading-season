package app.auth;

/**
 * A request that conflicts with the current state: registration when the account already has a profile or the
 * email is registered to another account, or accepting a version of the platform terms that is no longer in force.
 */
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


