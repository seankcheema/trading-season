package app.account;

/** No account exists for the given account id. */
public class AccountNotFoundException extends RuntimeException {

    public AccountNotFoundException(Integer accountId) {
        super("No account exists for the given account id: " + accountId);
    }
    public AccountNotFoundException(String message) {
        super(message);
    }

}


