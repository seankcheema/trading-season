package app.order.validation.impl;

import app.account.Account;
import app.instrument.Instrument;
import app.order.Order;
import app.order.dto.OrderRequest;
import app.order.validation.ValidationResult;
import app.user.User;
import app.user.UserAccount;
import app.user.UserAccountRepository;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Status is read from the auth service's table on every order, not from the
 * access token, so these tests stub the lookup rather than setting a field on
 * the profile. A token lives fifteen minutes; deactivation has to bite sooner.
 */
@Tag("unit")
class AccountStatusValidatorUnitTest {

    private final UserAccountRepository repository = mock(UserAccountRepository.class);
    private final AccountStatusValidator validator = new AccountStatusValidator(repository);

    private static final UUID USER_ID = UUID.randomUUID();

    private OrderRequest request() {
        return new OrderRequest(1, 1, Order.TYPE_BUY, BigDecimal.TEN,
                BigDecimal.valueOf(100), null, UUID.randomUUID());
    }

    private User profile() {
        User user = new User();
        user.setUserId(USER_ID);
        return user;
    }

    private ValidationResult validateWith(UserAccount account) {
        when(repository.findById(any())).thenReturn(Optional.ofNullable(account));
        return validator.validate(request(), profile(), new Account(), new Instrument());
    }

    @Test
    void passesWhenAccountIsActive() {
        ValidationResult result = validateWith(
                new UserAccount(USER_ID, "joanna@example.com", "TRADER", "ACTIVE"));

        assertTrue(result.passed());
    }

    @Test
    void rejectsWhenAccountIsDeactivated() {
        ValidationResult result = validateWith(
                new UserAccount(USER_ID, "joanna@example.com", "TRADER", "DEACTIVATED"));

        assertFalse(result.passed());
        assertEquals("Account is not active", result.reason());
    }

    @Test
    void rejectsWhenNoAccountExistsForTheProfile() {
        // The users.user_id foreign key should make this unreachable. If it
        // happens anyway, refusing the trade is the safe reading - a profile
        // with no credentials behind it is not an account anyone should trade
        // from.
        ValidationResult result = validateWith(null);

        assertFalse(result.passed());
    }

    @Test
    void readsTheStatusForTheProfileBeingValidated() {
        // Guards against looking the account up by anything other than the
        // profile's own id, which would check the wrong person's status.
        when(repository.findById(USER_ID)).thenReturn(
                Optional.of(new UserAccount(USER_ID, "joanna@example.com", "TRADER", "DEACTIVATED")));
        when(repository.findById(UUID.randomUUID())).thenReturn(Optional.empty());

        assertFalse(validator.validate(request(), profile(), new Account(), new Instrument()).passed());
    }
}
