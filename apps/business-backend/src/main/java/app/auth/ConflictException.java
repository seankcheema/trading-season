package app.auth;

/** Registration rejected because the username or email is already taken. */
public class ConflictException extends RuntimeException {
    /**
     * Creates a conflict with a client-safe message.
     *
     * @param message conflict description
     */
    public ConflictException(String message) {
        super(message);
    }
}
