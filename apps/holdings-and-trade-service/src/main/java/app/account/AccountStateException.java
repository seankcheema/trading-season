package app.account;

/** A lifecycle transition refused to preserve account assets or retained history. */
@org.springframework.web.bind.annotation.ResponseStatus(org.springframework.http.HttpStatus.CONFLICT)
public class AccountStateException extends RuntimeException {
    /** @param message specific requirement the account does not meet */
    public AccountStateException(String message) { super(message); }
}
