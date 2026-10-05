package app.order.validation.impl;

import app.account.Account;
import app.instrument.Instrument;
import app.order.dto.OrderRequest;
import app.order.validation.OrderValidator;
import app.order.validation.ValidationResult;
import app.user.User;
import app.user.UserAccountRepository;
import org.springframework.stereotype.Component;

/** Rejects trading by a profile whose credential record no longer exists. */
@Component
public class AccountCredentialsValidator implements OrderValidator {
    private final UserAccountRepository repository;

    /**
     * Creates the credential existence check.
     * @param repository read-only credential records
     */
    public AccountCredentialsValidator(UserAccountRepository repository) {
        this.repository = repository;
    }

    /**
     * Checks that the authenticated profile still has credentials.
     * @param request submitted order
     * @param user authenticated profile
     * @param account owned trading account
     * @param instrument selected instrument
     * @return a rejection if credentials are missing, otherwise a pass
     */
    @Override
    public ValidationResult validate(OrderRequest request, User user, Account account, Instrument instrument) {
        return repository.findById(user.getUserId()).isPresent()
                ? ValidationResult.pass() : ValidationResult.reject("Credential account does not exist");
    }
}
