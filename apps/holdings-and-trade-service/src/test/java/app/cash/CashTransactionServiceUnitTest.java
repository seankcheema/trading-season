package app.cash;

import app.account.Account;
import app.account.AccountNotFoundException;
import app.account.AccountRepository;
import app.user.User;
import app.user.UserNotFoundException;
import app.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@Tag("unit")
class CashTransactionServiceUnitTest {

    private static final UUID USER_ID = UUID.fromString("7c9e6679-7425-40de-944b-e07fc1f90ae7");

    @Mock
    private CashTransactionRepository cashTransactionRepository;

    @Mock
    private AccountRepository accountRepository;

    @Mock
    private UserRepository userRepository;

    private CashTransactionService service;

    // JUnit invokes this lifecycle hook through reflection.
    @BeforeEach
    public void setUp() {
        service = new CashTransactionService(cashTransactionRepository, accountRepository, userRepository);
    }

    @Test
    void depositAddsToAvailableFundsAndAppendsACreditRow() {
        User user = user(new BigDecimal("100.00"));
        givenUserWithAccount(user, 7);
        when(cashTransactionRepository.save(any(CashTransaction.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        CashTransaction saved = service.move(USER_ID, new BigDecimal("50.25"), "DEPOSIT");

        assertEquals(new BigDecimal("150.25"), user.getAvailableFunds());
        assertEquals(new BigDecimal("50.25"), saved.getAmount());
        assertEquals("DEPOSIT", saved.getReason());
        assertEquals(7, saved.getAccountId());
        assertNotNull(saved.getCreatedAt());
        verify(userRepository).save(user);
    }

    @Test
    void withdrawalSubtractsFromAvailableFundsAndAppendsADebitRow() {
        User user = user(new BigDecimal("100.00"));
        givenUserWithAccount(user, 7);
        when(cashTransactionRepository.save(any(CashTransaction.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        CashTransaction saved = service.move(USER_ID, new BigDecimal("25.00"), "WITHDRAWAL");

        assertEquals(new BigDecimal("75.00"), user.getAvailableFunds());
        // Stored signed, so the ledger sums to the balance it backs.
        assertEquals(new BigDecimal("-25.00"), saved.getAmount());
        assertEquals("WITHDRAWAL", saved.getReason());
    }

    @Test
    void withdrawalOfTheWholeBalanceIsAllowed() {
        User user = user(new BigDecimal("100.00"));
        givenUserWithAccount(user, 7);
        when(cashTransactionRepository.save(any(CashTransaction.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        service.move(USER_ID, new BigDecimal("100.00"), "WITHDRAWAL");

        assertEquals(new BigDecimal("0.00"), user.getAvailableFunds());
    }

    @Test
    void withdrawalBeyondAvailableFundsIsRefusedAndNothingIsWritten() {
        User user = user(new BigDecimal("10.00"));
        givenUserWithAccount(user, 7);

        assertNotNull(assertThrows(InsufficientFundsException.class,
                () -> service.move(USER_ID, new BigDecimal("10.01"), "WITHDRAWAL")));

        assertEquals(new BigDecimal("10.00"), user.getAvailableFunds());
        verify(userRepository, never()).save(any(User.class));
        verify(cashTransactionRepository, never()).save(any(CashTransaction.class));
    }

    @Test
    void balanceIsReadUnderALockSoConcurrentWithdrawalsCannotOverdraw() {
        User user = user(new BigDecimal("100.00"));
        givenUserWithAccount(user, 7);
        when(cashTransactionRepository.save(any(CashTransaction.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        service.move(USER_ID, BigDecimal.ONE, "WITHDRAWAL");

        verify(userRepository).findByIdForUpdate(USER_ID);
        verify(userRepository, never()).findById(USER_ID);
    }

    @Test
    void movingCashForAnUnregisteredUserIsNotFound() {
        Account account = new Account();
        when(accountRepository.findActiveForUpdate(USER_ID)).thenReturn(List.of(account));
        when(userRepository.findByIdForUpdate(USER_ID)).thenReturn(Optional.empty());

        assertNotNull(assertThrows(UserNotFoundException.class,
                () -> service.move(USER_ID, BigDecimal.TEN, "DEPOSIT")));

        verify(cashTransactionRepository, never()).save(any(CashTransaction.class));
    }

    @Test
    void movingCashWithNoAccountToBookItAgainstIsNotFound() {

        when(accountRepository.findActiveForUpdate(USER_ID))
                .thenReturn(List.of());

        assertNotNull(assertThrows(AccountNotFoundException.class,
                () -> service.move(USER_ID, BigDecimal.ONE, "DEPOSIT")));
    }

    @Test
    void anAmountThatIsNotPositiveIsRejectedBeforeAnythingIsRead() {
        assertNotNull(assertThrows(IllegalArgumentException.class,
                () -> service.move(USER_ID, BigDecimal.ZERO, "DEPOSIT")));
        assertNotNull(assertThrows(IllegalArgumentException.class,
                () -> service.move(USER_ID, new BigDecimal("-1"), "DEPOSIT")));
        assertNotNull(assertThrows(IllegalArgumentException.class,
                () -> service.move(USER_ID, null, "DEPOSIT")));

        verify(userRepository, never()).findByIdForUpdate(any());
    }

    @Test
    void anUnknownReasonIsRejected() {
        assertNotNull(assertThrows(IllegalArgumentException.class,
                () -> service.move(USER_ID, BigDecimal.TEN, "ORDER_FILL")));
        assertNotNull(assertThrows(IllegalArgumentException.class,
                () -> service.move(USER_ID, BigDecimal.TEN, null)));

        verify(userRepository, never()).findByIdForUpdate(any());
    }

    @Test
    void historyIsScopedToTheUserAndUsesTheDefaultPageWhenNoLimitIsGiven() {
        CashTransaction row = new CashTransaction();
        when(cashTransactionRepository.findFundingForUser(any(UUID.class), any(Pageable.class)))
                .thenReturn(List.of(row));

        List<CashTransaction> history = service.getFundingHistory(USER_ID, null);

        assertSame(row, history.get(0));
        ArgumentCaptor<Pageable> page = ArgumentCaptor.forClass(Pageable.class);
        verify(cashTransactionRepository).findFundingForUser(any(UUID.class), page.capture());
        assertEquals(CashTransactionService.DEFAULT_LIMIT, page.getValue().getPageSize());
    }

    @Test
    void historyHonoursTheCallerLimitAndCapsIt() {
        when(cashTransactionRepository.findFundingForUser(any(UUID.class), any(Pageable.class)))
                .thenReturn(List.of());

        service.getFundingHistory(USER_ID, 5);
        service.getFundingHistory(USER_ID, CashTransactionService.MAX_LIMIT + 1);
        service.getFundingHistory(USER_ID, 0);
        service.getFundingHistory(USER_ID, -3);

        verify(cashTransactionRepository).findFundingForUser(USER_ID, PageRequest.of(0, 5));
        verify(cashTransactionRepository)
                .findFundingForUser(USER_ID, PageRequest.of(0, CashTransactionService.MAX_LIMIT));
        // A nonsensical limit falls back rather than failing the read.
        verify(cashTransactionRepository, times(2))
                .findFundingForUser(USER_ID, PageRequest.of(0, CashTransactionService.DEFAULT_LIMIT));
    }

    private void givenUserWithAccount(User user, int accountId) {
        when(userRepository.findByIdForUpdate(USER_ID)).thenReturn(Optional.of(user));
        Account account = new Account();
        account.setId(accountId);
        account.setUserId(USER_ID);
        account.setName("Main Account");
        account.setOpenedDate(LocalDate.of(2026, 1, 1));
        when(accountRepository.findActiveForUpdate(USER_ID))
                .thenReturn(List.of(account));
    }

    private static User user(BigDecimal funds) {
        User user = new User();
        user.setUserId(USER_ID);
        user.setFirstName("Ada");
        user.setLastName("Lovelace");
        user.setAvailableFunds(funds);
        return user;
    }
}
