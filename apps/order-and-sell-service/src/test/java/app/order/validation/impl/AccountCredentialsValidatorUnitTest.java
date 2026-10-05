package app.order.validation.impl;

import app.user.User;
import app.user.UserAccount;
import java.util.Optional;
import app.user.UserAccountRepository;
import org.junit.jupiter.api.Test;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AccountCredentialsValidatorUnitTest {
    @Test
    void passesOnlyWhenCredentialsStillExist() {
        UserAccountRepository repository = mock(UserAccountRepository.class);
        AccountCredentialsValidator validator = new AccountCredentialsValidator(repository);
        User user = new User();
        user.setUserId(UUID.randomUUID());
        when(repository.findById(user.getUserId())).thenReturn(Optional.empty());
        assertFalse(validator.validate(null, user, null, null).passed());
        when(repository.findById(user.getUserId())).thenReturn(Optional.of(new UserAccount(user.getUserId(), "trader@example.com", "TRADER")));
        assertTrue(validator.validate(null, user, null, null).passed());
    }
}
