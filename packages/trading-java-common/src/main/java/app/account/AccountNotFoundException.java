package app.account;

/** No account exists for the given account id. */
public class AccountNotFoundException extends RuntimeException {

    /**
     * Creates the exception for an account id that does not exist.
     *
     * @param accountId the missing account id
     */
    public AccountNotFoundException(Integer accountId) {
        super("No account exists for the given account id: " + accountId);
    }

    /**
     * Creates the exception with a custom message.
     *
     * @param message the detail message
     */
    public AccountNotFoundException(String message) {
        super(message);
    }

}


