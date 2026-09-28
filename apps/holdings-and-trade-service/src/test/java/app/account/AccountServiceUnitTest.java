package app.account;

import app.auth.ForbiddenException;
import app.holding.Holding;
import app.holding.HoldingRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@Tag("unit")
class AccountServiceUnitTest {

    private static final UUID USER_ID = UUID.fromString("7c9e6679-7425-40de-944b-e07fc1f90ae7");
    private static final UUID OTHER_USER_ID = UUID.fromString("8d9e6679-7425-40de-944b-e07fc1f90ae8");

    @Mock
    private AccountRepository accountRepository;

    @Mock
    private HoldingRepository holdingRepository;

    private AccountService accountService;

    @BeforeEach
    void setUp() {
        accountService = new AccountService(accountRepository, holdingRepository);
    }

    @Test
    void getAccountsForUserReturnsOnlyUsersAccounts() {
        Account account1 = createAccount(1, USER_ID, "Main Account");
        Account account2 = createAccount(2, USER_ID, "Secondary Account");
        
        when(accountRepository.findByUserIdOrderByOpenedDateDesc(USER_ID))
                .thenReturn(List.of(account2, account1)); // Newest first

        List<Account> result = accountService.getAccountsForUser(USER_ID);

        assertEquals(2, result.size());
        assertEquals("Secondary Account", result.get(0).getName());
        assertEquals("Main Account", result.get(1).getName());
        verify(accountRepository).findByUserIdOrderByOpenedDateDesc(USER_ID);
    }

    @Test
    void getAccountsForUserReturnsEmptyListWhenNoAccounts() {
        when(accountRepository.findByUserIdOrderByOpenedDateDesc(USER_ID))
                .thenReturn(List.of());

        List<Account> result = accountService.getAccountsForUser(USER_ID);

        assertTrue(result.isEmpty());
    }

    @Test
    void getAccountForUserReturnsAccountWhenOwned() {
        Account account = createAccount(1, USER_ID, "Main Account");
        when(accountRepository.findByIdAndUserId(1, USER_ID))
                .thenReturn(Optional.of(account));

        Account result = accountService.getAccountForUser(1, USER_ID);

        assertEquals(account, result);
        assertEquals("Main Account", result.getName());
    }

    @Test
    void getAccountForUserThrowsForbiddenWhenNotOwned() {
        when(accountRepository.findByIdAndUserId(1, USER_ID))
                .thenReturn(Optional.empty());
        when(accountRepository.existsById(1))
                .thenReturn(true);

        assertThrows(ForbiddenException.class, 
                () -> accountService.getAccountForUser(1, USER_ID));
    }

    @Test
    void getAccountForUserThrowsNotFoundWhenAccountDoesNotExist() {
        when(accountRepository.findByIdAndUserId(99, USER_ID))
                .thenReturn(Optional.empty());
        when(accountRepository.existsById(99))
                .thenReturn(false);

        assertThrows(AccountNotFoundException.class, 
                () -> accountService.getAccountForUser(99, USER_ID));
    }

    @Test
    void verifyAccountOwnershipReturnsTrueWhenOwned() {
        Account account = createAccount(1, USER_ID, "Main Account");
        when(accountRepository.findByIdAndUserId(1, USER_ID))
                .thenReturn(Optional.of(account));

        boolean result = accountService.verifyAccountOwnership(1, USER_ID);

        assertTrue(result);
    }

    @Test
    void verifyAccountOwnershipReturnsFalseWhenNotOwned() {
        when(accountRepository.findByIdAndUserId(1, USER_ID))
                .thenReturn(Optional.empty());

        boolean result = accountService.verifyAccountOwnership(1, USER_ID);

        assertFalse(result);
    }

    @Test
    void createAccountSavesNewAccountWithUserIdAndName() {
        Account savedAccount = createAccount(1, USER_ID, "My Account");
        when(accountRepository.save(any(Account.class)))
                .thenReturn(savedAccount);

        Account result = accountService.createAccount(USER_ID, "My Account");

        ArgumentCaptor<Account> captor = ArgumentCaptor.forClass(Account.class);
        verify(accountRepository).save(captor.capture());
        
        Account captured = captor.getValue();
        assertEquals(USER_ID, captured.getUserId());
        assertEquals("My Account", captured.getName());
        assertEquals(LocalDate.now(), captured.getOpenedDate());
        assertEquals("USD", captured.getCurrency());
        assertEquals(BigDecimal.ZERO, captured.getCashBalance());
        
        assertEquals(result, savedAccount);
    }

    @Test
    void createDefaultAccountForUserCreatesMainAccount() {
        Account savedAccount = createAccount(1, USER_ID, "Main Account");
        when(accountRepository.save(any(Account.class)))
                .thenReturn(savedAccount);

        Account result = accountService.createDefaultAccountForUser(USER_ID);

        ArgumentCaptor<Account> captor = ArgumentCaptor.forClass(Account.class);
        verify(accountRepository).save(captor.capture());
        
        Account captured = captor.getValue();
        assertEquals(USER_ID, captured.getUserId());
        assertEquals("Main Account", captured.getName());
        assertEquals(result, savedAccount);
    }

    @Test
    void updateAccountNameUpdatesWhenOwned() {
        Account account = createAccount(1, USER_ID, "Old Name");
        when(accountRepository.findByIdAndUserId(1, USER_ID))
                .thenReturn(Optional.of(account));
        when(accountRepository.save(any(Account.class)))
                .thenReturn(account);

        Account result = accountService.updateAccountName(1, USER_ID, "New Name");

        ArgumentCaptor<Account> captor = ArgumentCaptor.forClass(Account.class);
        verify(accountRepository).save(captor.capture());
        
        Account captured = captor.getValue();
        assertEquals("New Name", captured.getName());
        assertEquals(result, account);
    }

    @Test
    void updateAccountNameThrowsForbiddenWhenNotOwned() {
        when(accountRepository.findByIdAndUserId(1, USER_ID))
                .thenReturn(Optional.empty());
        when(accountRepository.existsById(1))
                .thenReturn(true);

        assertThrows(ForbiddenException.class, 
                () -> accountService.updateAccountName(1, USER_ID, "New Name"));
    }

    @Test
    void getHoldingsForAccountReturnsHoldingsWhenOwned() {
        Account account = createAccount(1, USER_ID, "Main Account");
        Holding holding1 = createHolding(1, 1, 100, BigDecimal.TEN);
        Holding holding2 = createHolding(2, 1, 101, BigDecimal.ONE);
        
        when(accountRepository.findByIdAndUserId(1, USER_ID))
                .thenReturn(Optional.of(account));
        when(holdingRepository.findByAccountId(1))
                .thenReturn(List.of(holding1, holding2));

        List<Holding> result = accountService.getHoldingsForAccount(1, USER_ID);

        assertEquals(2, result.size());
        assertEquals(holding1, result.get(0));
        assertEquals(holding2, result.get(1));
        verify(holdingRepository).findByAccountId(1);
    }

    @Test
    void getHoldingsForAccountThrowsForbiddenWhenNotOwned() {
        when(accountRepository.findByIdAndUserId(1, USER_ID))
                .thenReturn(Optional.empty());
        when(accountRepository.existsById(1))
                .thenReturn(true);

        assertThrows(ForbiddenException.class, 
                () -> accountService.getHoldingsForAccount(1, USER_ID));
        
        verify(holdingRepository, never()).findByAccountId(any());
    }

    @Test
    void getHoldingsForAccountReturnsEmptyListWhenNoHoldings() {
        Account account = createAccount(1, USER_ID, "Main Account");
        when(accountRepository.findByIdAndUserId(1, USER_ID))
                .thenReturn(Optional.of(account));
        when(holdingRepository.findByAccountId(1))
                .thenReturn(List.of());

        List<Holding> result = accountService.getHoldingsForAccount(1, USER_ID);

        assertTrue(result.isEmpty());
    }

    @Test
    void createAccountWithDifferentNameSucceeds() {
        Account savedAccount = createAccount(1, USER_ID, "Trading Account");
        when(accountRepository.save(any(Account.class)))
                .thenReturn(savedAccount);

        Account result = accountService.createAccount(USER_ID, "Trading Account");

        assertEquals("Trading Account", result.getName());
        assertEquals(USER_ID, result.getUserId());
    }

    @Test
    void createAccountSetsProperDateAndCurrency() {
        Account savedAccount = createAccount(1, USER_ID, "Test");
        when(accountRepository.save(any(Account.class)))
                .thenAnswer(invocation -> {
                    Account arg = invocation.getArgument(0);
                    assertNotNull(arg.getOpenedDate());
                    assertEquals("USD", arg.getCurrency());
                    return savedAccount;
                });

        accountService.createAccount(USER_ID, "Test");
        verify(accountRepository).save(any(Account.class));
    }

    @Test
    void getAccountsForUserPreservesOrder() {
        Account newest = createAccount(3, USER_ID, "Newest");
        newest.setOpenedDate(LocalDate.now());
        Account middle = createAccount(2, USER_ID, "Middle");
        middle.setOpenedDate(LocalDate.now().minusDays(5));
        Account oldest = createAccount(1, USER_ID, "Oldest");
        oldest.setOpenedDate(LocalDate.now().minusDays(10));
        
        when(accountRepository.findByUserIdOrderByOpenedDateDesc(USER_ID))
                .thenReturn(List.of(newest, middle, oldest));

        List<Account> result = accountService.getAccountsForUser(USER_ID);

        assertEquals(3, result.size());
        assertEquals("Newest", result.get(0).getName());
        assertEquals("Middle", result.get(1).getName());
        assertEquals("Oldest", result.get(2).getName());
    }

    @Test
    void verifyAccountOwnershipWithDifferentUser() {
        when(accountRepository.findByIdAndUserId(1, OTHER_USER_ID))
                .thenReturn(Optional.empty());

        boolean result = accountService.verifyAccountOwnership(1, OTHER_USER_ID);

        assertFalse(result);
    }

    @Test
    void updateAccountNameToEmptyString() {
        Account account = createAccount(1, USER_ID, "Original");
        when(accountRepository.findByIdAndUserId(1, USER_ID))
                .thenReturn(Optional.of(account));
        when(accountRepository.save(any(Account.class)))
                .thenReturn(account);

        Account result = accountService.updateAccountName(1, USER_ID, "");

        ArgumentCaptor<Account> captor = ArgumentCaptor.forClass(Account.class);
        verify(accountRepository).save(captor.capture());
        
        Account captured = captor.getValue();
        assertEquals("", captured.getName());
    }

    @Test
    void updateAccountNameToVeryLongString() {
        Account account = createAccount(1, USER_ID, "Original");
        String longName = "A".repeat(500);
        when(accountRepository.findByIdAndUserId(1, USER_ID))
                .thenReturn(Optional.of(account));
        when(accountRepository.save(any(Account.class)))
                .thenReturn(account);

        Account result = accountService.updateAccountName(1, USER_ID, longName);

        ArgumentCaptor<Account> captor = ArgumentCaptor.forClass(Account.class);
        verify(accountRepository).save(captor.capture());
        
        Account captured = captor.getValue();
        assertEquals(longName, captured.getName());
    }

    @Test
    void getHoldingsForAccountWithMultipleHoldings() {
        Account account = createAccount(1, USER_ID, "Main Account");
        Holding holding1 = createHolding(1, 1, 100, BigDecimal.TEN);
        Holding holding2 = createHolding(2, 1, 101, BigDecimal.ONE);
        Holding holding3 = createHolding(3, 1, 102, new BigDecimal("100.50"));
        
        when(accountRepository.findByIdAndUserId(1, USER_ID))
                .thenReturn(Optional.of(account));
        when(holdingRepository.findByAccountId(1))
                .thenReturn(List.of(holding1, holding2, holding3));

        List<Holding> result = accountService.getHoldingsForAccount(1, USER_ID);

        assertEquals(3, result.size());
        assertEquals(holding1, result.get(0));
        assertEquals(holding2, result.get(1));
        assertEquals(holding3, result.get(2));
    }

    @Test
    void getAccountForUserThrowsNotFoundWhenAccountDoesNotExistAtAll() {
        when(accountRepository.findByIdAndUserId(999, USER_ID))
                .thenReturn(Optional.empty());
        when(accountRepository.existsById(999))
                .thenReturn(false);

        AccountNotFoundException exception = assertThrows(AccountNotFoundException.class, 
                () -> accountService.getAccountForUser(999, USER_ID));
        
        assertTrue(exception.getMessage().contains("999"));
    }

    @Test
    void getHoldingsForAccountThrowsNotFoundWhenAccountDoesNotExist() {
        when(accountRepository.findByIdAndUserId(999, USER_ID))
                .thenReturn(Optional.empty());
        when(accountRepository.existsById(999))
                .thenReturn(false);

        assertThrows(AccountNotFoundException.class, 
                () -> accountService.getHoldingsForAccount(999, USER_ID));
        
        verify(holdingRepository, never()).findByAccountId(any());
    }

    @Test
    void updateAccountNameThrowsNotFoundWhenAccountDoesNotExist() {
        when(accountRepository.findByIdAndUserId(999, USER_ID))
                .thenReturn(Optional.empty());
        when(accountRepository.existsById(999))
                .thenReturn(false);

        assertThrows(AccountNotFoundException.class, 
                () -> accountService.updateAccountName(999, USER_ID, "New Name"));
    }

    @Test
    void verifyOwnershipMultipleTimesWithSameAccountAndUser() {
        Account account = createAccount(1, USER_ID, "Test");
        when(accountRepository.findByIdAndUserId(1, USER_ID))
                .thenReturn(Optional.of(account));

        boolean result1 = accountService.verifyAccountOwnership(1, USER_ID);
        boolean result2 = accountService.verifyAccountOwnership(1, USER_ID);
        boolean result3 = accountService.verifyAccountOwnership(1, USER_ID);

        assertTrue(result1);
        assertTrue(result2);
        assertTrue(result3);
        verify(accountRepository, times(3)).findByIdAndUserId(1, USER_ID);
    }

    @Test
    void getAccountForUserCallsRepositoryWithCorrectParameters() {
        Account account = createAccount(1, USER_ID, "Main");
        when(accountRepository.findByIdAndUserId(1, USER_ID))
                .thenReturn(Optional.of(account));

        accountService.getAccountForUser(1, USER_ID);

        verify(accountRepository).findByIdAndUserId(1, USER_ID);
        verify(accountRepository, never()).existsById(any());
    }

    @Test
    void getHoldingsVerifiesOwnershipBeforeFetchingHoldings() {
        Account account = createAccount(1, USER_ID, "Main");
        when(accountRepository.findByIdAndUserId(1, USER_ID))
                .thenReturn(Optional.of(account));
        when(holdingRepository.findByAccountId(1))
                .thenReturn(List.of());

        accountService.getHoldingsForAccount(1, USER_ID);

        verify(accountRepository).findByIdAndUserId(1, USER_ID);
        verify(holdingRepository).findByAccountId(1);
    }

    @Test
    void createAccountDoesNotModifyUserId() {
        UUID userId = UUID.randomUUID();
        Account savedAccount = createAccount(1, userId, "Account");
        when(accountRepository.save(any(Account.class)))
                .thenAnswer(invocation -> {
                    Account arg = invocation.getArgument(0);
                    assertEquals(userId, arg.getUserId());
                    return savedAccount;
                });

        accountService.createAccount(userId, "Account");

        verify(accountRepository).save(any(Account.class));
    }

    @Test
    void getAccountsForMultipleDifferentUsers() {
        Account account1 = createAccount(1, USER_ID, "User1 Account");
        Account account2 = createAccount(2, OTHER_USER_ID, "User2 Account");
        
        when(accountRepository.findByUserIdOrderByOpenedDateDesc(USER_ID))
                .thenReturn(List.of(account1));
        when(accountRepository.findByUserIdOrderByOpenedDateDesc(OTHER_USER_ID))
                .thenReturn(List.of(account2));

        List<Account> result1 = accountService.getAccountsForUser(USER_ID);
        List<Account> result2 = accountService.getAccountsForUser(OTHER_USER_ID);

        assertEquals(1, result1.size());
        assertEquals("User1 Account", result1.get(0).getName());
        assertEquals(1, result2.size());
        assertEquals("User2 Account", result2.get(0).getName());
    }

    // Helper methods
    private Account createAccount(Integer id, UUID userId, String name) {
        Account account = new Account();
        account.setId(id);
        account.setUserId(userId);
        account.setName(name);
        account.setOpenedDate(LocalDate.now());
        account.setCashBalance(BigDecimal.ZERO);
        account.setCurrency("USD");
        return account;
    }

    private Holding createHolding(Integer holdingId, Integer accountId, Integer instrumentId, BigDecimal quantity) {
        Holding holding = new Holding();
        holding.setHoldingId(holdingId);
        holding.setAccountId(accountId);
        holding.setInstrumentId(instrumentId);
        holding.setQuantity(quantity);
        holding.setUpdatedAt(OffsetDateTime.now());
        return holding;
    }
}
