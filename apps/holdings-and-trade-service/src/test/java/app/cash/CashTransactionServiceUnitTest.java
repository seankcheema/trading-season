package app.cash;

import app.account.Account;
import app.account.AccountNotFoundException;
import app.account.AccountRepository;
import app.record.CashTransferRecord;
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
import org.springframework.context.ApplicationEventPublisher;
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
    private static final UUID REF = UUID.fromString("c0ffee00-0000-4000-8000-000000000001");

    @Mock
    private CashTransactionRepository cashTransactionRepository;

    @Mock
    private AccountRepository accountRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private ApplicationEventPublisher events;

    private CashTransactionService service;

    @BeforeEach
    void setUp() {
        service = new CashTransactionService(cashTransactionRepository, accountRepository, userRepository, events);
    }

    @Test
    void aWithdrawalIsRaisedForReportingWithTheBalanceItLeft() {
        User user = user(new BigDecimal("100.00"));
        givenUserWithAccount(user, 7);
        when(cashTransactionRepository.save(any(CashTransaction.class))).thenAnswer(invocation -> {
            CashTransaction posted = invocation.getArgument(0);
            posted.setCashTransactionId(31);
            return posted;
        });

        CashTransaction saved = service.move(USER_ID, new BigDecimal("25.00"), "WITHDRAWAL", REF);

        ArgumentCaptor<CashTransferRecord> raised = ArgumentCaptor.forClass(CashTransferRecord.class);
        verify(events).publishEvent(raised.capture());
        CashTransferRecord record = raised.getValue();
        assertEquals(31, record.cashTransactionId());
        assertEquals(7, record.accountId());
        assertEquals(USER_ID, record.userId());
        assertEquals(new BigDecimal("-25.00"), record.amount());
        assertEquals("WITHDRAWAL", record.reason());
        assertEquals(saved.getCreatedAt(), record.createdAt());
        assertEquals(new BigDecimal("75.00"), record.availableFunds());
        assertEquals("CASH_TRANSFER", record.recordType());
        assertEquals("31", record.recordId());
    }

    @Test
    void aRefusedWithdrawalRaisesNothing() {
        User user = user(new BigDecimal("10.00"));
        givenUserWithAccount(user, 7);

        assertThrows(InsufficientFundsException.class,
                () -> service.move(USER_ID, new BigDecimal("10.01"), "WITHDRAWAL", REF));

        verify(events, never()).publishEvent(any());
    }

    @Test
    void depositAddsToAvailableFundsAndAppendsACreditRow() {
        User user = user(new BigDecimal("100.00"));
        givenUserWithAccount(user, 7);
        when(cashTransactionRepository.save(any(CashTransaction.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        CashTransaction saved = service.move(USER_ID, new BigDecimal("50.25"), "DEPOSIT", REF);

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

        CashTransaction saved = service.move(USER_ID, new BigDecimal("25.00"), "WITHDRAWAL", REF);

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

        service.move(USER_ID, new BigDecimal("100.00"), "WITHDRAWAL", REF);

        assertEquals(new BigDecimal("0.00"), user.getAvailableFunds());
    }

    @Test
    void withdrawalBeyondAvailableFundsIsRefusedAndNothingIsWritten() {
        User user = user(new BigDecimal("10.00"));
        givenUserWithAccount(user, 7);

        assertThrows(InsufficientFundsException.class,
                () -> service.move(USER_ID, new BigDecimal("10.01"), "WITHDRAWAL", REF));

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

        service.move(USER_ID, BigDecimal.ONE, "WITHDRAWAL", REF);

        verify(userRepository).findByIdForUpdate(USER_ID);
        verify(userRepository, never()).findById(USER_ID);
    }

    @Test
    void movingCashForAnUnregisteredUserIsNotFound() {
        when(userRepository.findByIdForUpdate(USER_ID)).thenReturn(Optional.empty());

        assertThrows(UserNotFoundException.class,
                () -> service.move(USER_ID, BigDecimal.TEN, "DEPOSIT", REF));

        verify(cashTransactionRepository, never()).save(any(CashTransaction.class));
    }

    @Test
    void movingCashWithNoAccountToBookItAgainstIsNotFound() {
        when(userRepository.findByIdForUpdate(USER_ID))
                .thenReturn(Optional.of(user(BigDecimal.TEN)));
        when(accountRepository.findFirstByUserIdOrderByOpenedDateAscIdAsc(USER_ID))
                .thenReturn(Optional.empty());

        assertThrows(AccountNotFoundException.class,
                () -> service.move(USER_ID, BigDecimal.ONE, "DEPOSIT", REF));
    }

    @Test
    void anAmountThatIsNotPositiveIsRejectedBeforeAnythingIsRead() {
        assertThrows(IllegalArgumentException.class,
                () -> service.move(USER_ID, BigDecimal.ZERO, "DEPOSIT", REF));
        assertThrows(IllegalArgumentException.class,
                () -> service.move(USER_ID, new BigDecimal("-1"), "DEPOSIT", REF));
        assertThrows(IllegalArgumentException.class,
                () -> service.move(USER_ID, null, "DEPOSIT", REF));

        verify(userRepository, never()).findByIdForUpdate(any());
    }

    @Test
    void aRepeatedClientReferenceReturnsTheOriginalRowAndMovesNothing() {
        User user = user(new BigDecimal("100.00"));
        givenUserWithAccount(user, 7);
        CashTransaction earlier = new CashTransaction();
        earlier.setCashTransactionId(31);
        earlier.setAccountId(7);
        earlier.setAmount(new BigDecimal("25.00"));
        earlier.setReason("DEPOSIT");
        earlier.setClientReference(REF);
        when(cashTransactionRepository.findByClientReference(REF)).thenReturn(Optional.of(earlier));
        Account owner = new Account();
        owner.setId(7);
        owner.setUserId(USER_ID);
        when(accountRepository.findById(7)).thenReturn(Optional.of(owner));

        CashTransaction result = service.move(USER_ID, new BigDecimal("25.00"), "DEPOSIT", REF);

        assertSame(earlier, result);
        assertEquals(new BigDecimal("100.00"), user.getAvailableFunds());
        verify(userRepository, never()).save(any(User.class));
        verify(cashTransactionRepository, never()).save(any(CashTransaction.class));
        verify(events, never()).publishEvent(any());
    }

    @Test
    void anotherUsersClientReferenceIsNotReplayedForTheCaller() {
        // The key belongs to someone else's movement, so it is not theirs to repeat; the
        // insert goes ahead and the unique constraint refuses the duplicate key.
        User user = user(new BigDecimal("100.00"));
        givenUserWithAccount(user, 7);
        CashTransaction theirs = new CashTransaction();
        theirs.setAccountId(99);
        theirs.setClientReference(REF);
        when(cashTransactionRepository.findByClientReference(REF)).thenReturn(Optional.of(theirs));
        Account stranger = new Account();
        stranger.setId(99);
        stranger.setUserId(UUID.randomUUID());
        when(accountRepository.findById(99)).thenReturn(Optional.of(stranger));
        when(cashTransactionRepository.save(any(CashTransaction.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        CashTransaction saved = service.move(USER_ID, new BigDecimal("5.00"), "DEPOSIT", REF);

        assertEquals(REF, saved.getClientReference());
        assertEquals(7, saved.getAccountId());
        verify(cashTransactionRepository).save(any(CashTransaction.class));
    }

    @Test
    void aMissingClientReferenceIsRejectedBeforeAnythingIsRead() {
        assertThrows(IllegalArgumentException.class,
                () -> service.move(USER_ID, BigDecimal.TEN, "DEPOSIT", null));

        verify(userRepository, never()).findByIdForUpdate(any());
    }

    @Test
    void anUnknownReasonIsRejected() {
        assertThrows(IllegalArgumentException.class,
                () -> service.move(USER_ID, BigDecimal.TEN, "ORDER_FILL", REF));
        assertThrows(IllegalArgumentException.class,
                () -> service.move(USER_ID, BigDecimal.TEN, null, REF));

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
        when(accountRepository.findFirstByUserIdOrderByOpenedDateAscIdAsc(USER_ID))
                .thenReturn(Optional.of(account));
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
