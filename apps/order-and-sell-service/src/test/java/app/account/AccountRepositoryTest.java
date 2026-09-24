package app.account;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class AccountRepositoryTest {

    @Autowired
    private AccountRepository accountRepository;

    @Test
    void newAccountsStartEmptyInUsd() {
        Account account = new Account();

        assertEquals(BigDecimal.ZERO, account.getCashBalance());
        assertEquals("USD", account.getCurrency());
    }

    @Test
    void persistsEveryColumnAndReadsItBackUnderALock() {
        UUID owner = UUID.randomUUID();
        Account account = new Account();
        account.setUserId(owner);
        account.setCashBalance(new BigDecimal("2500.00"));
        account.setOpenedDate(LocalDate.of(2026, 1, 5));
        account.setCurrency("CAD");
        Integer id = accountRepository.saveAndFlush(account).getAccountId();

        Account locked = accountRepository.findByIdForUpdate(id).orElseThrow();

        assertNotNull(id);
        assertEquals(id, locked.getId());
        assertEquals(owner, locked.getUserId());
        assertEquals(0, new BigDecimal("2500.00").compareTo(locked.getCashBalance()));
        assertEquals(LocalDate.of(2026, 1, 5), locked.getOpenedDate());
        assertEquals("CAD", locked.getCurrency());
    }

    @Test
    void lockedLookupOfAMissingAccountIsEmpty() {
        assertTrue(accountRepository.findByIdForUpdate(-1).isEmpty());
    }

    @Test
    void identifierCanBeAssignedExplicitly() {
        Account account = new Account();
        account.setId(42);

        assertEquals(42, account.getAccountId());
    }

    @Test
    void notFoundExceptionsNameTheAccount() {
        assertEquals("No account exists for the given account id: 9",
                new AccountNotFoundException(9).getMessage());
        assertEquals("custom", new AccountNotFoundException("custom").getMessage());
    }
}
