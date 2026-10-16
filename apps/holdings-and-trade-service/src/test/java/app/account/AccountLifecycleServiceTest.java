package app.account;

import app.auth.ForbiddenException;
import app.user.UserRepository;
import app.record.TradingAccountRecord;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.context.ApplicationEventPublisher;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class AccountLifecycleServiceTest {
    AccountRepository accounts = mock(AccountRepository.class);
    UserRepository users = mock(UserRepository.class);
    ApplicationEventPublisher events = mock(ApplicationEventPublisher.class);
    AccountLifecycleService service = new AccountLifecycleService(accounts, users, events);
    UUID owner = UUID.randomUUID();
    Account account;
    Map<String, Long> rows = new HashMap<>();

    @BeforeEach void setup() {
        account = new Account(); account.setId(1); account.setUserId(owner);
        account.setName("Spare"); account.setOpenedDate(java.time.LocalDate.now());
        Account other = new Account(); other.setUserId(owner); other.setId(2);
        when(accounts.findById(1)).thenReturn(Optional.of(account));
        when(accounts.findByIdForUpdate(1)).thenReturn(Optional.of(account));
        when(accounts.findByUserIdOrderByOpenedDateDesc(owner)).thenReturn(List.of(account, other));
        when(accounts.countNonzeroHoldings(1)).thenAnswer(i -> rows.getOrDefault("quantity <> 0", 0L));
        when(accounts.countUnresolvedOrders(1)).thenAnswer(i -> rows.getOrDefault("status NOT IN", 0L));
    }
    @Test void archivesEmptyAndRetainsHistory() {
        assertTrue(service.eligibility(1, owner).deleteBlockers().isEmpty());
        assertTrue(service.eligibility(1, owner).archiveBlockers().isEmpty());
        assertSame(account, service.archive(1, owner));
        assertEquals("ARCHIVED", account.getStatus()); assertNotNull(account.getArchivedAt());
        assertEquals(List.of(account), service.archived(owner));
        verify(events).publishEvent(TradingAccountRecord.from(account));
        verify(accounts, never()).delete(any());
        var locks = inOrder(users, accounts);
        locks.verify(users).findByIdForUpdate(owner); locks.verify(accounts).findByIdForUpdate(1);
        assertThrows(AccountStateException.class, () -> service.archive(1, owner));
        assertThrows(AccountStateException.class, () -> service.delete(1, owner, true));
    }
    @Test void deleteArchivesAndRequiresConfirmationWithoutDeletingRows() {
        assertThrows(IllegalArgumentException.class, () -> service.delete(1, owner, false));
        service.delete(1, owner, true);
        verify(accounts, never()).delete(any());
        assertEquals("ARCHIVED", account.getStatus());
        verify(events).publishEvent(TradingAccountRecord.from(account));
        assertThrows(AccountStateException.class, () -> service.delete(1, owner, true));
    }
    @Test void aMissingAccountCannotBeDeleted() {
        when(accounts.findByIdForUpdate(1)).thenReturn(Optional.empty());
        assertThrows(AccountNotFoundException.class, () -> service.delete(1, owner, true));
    }
    @ParameterizedTest @ValueSource(strings = {"1", "-1", "0.01"})
    void nonzeroCashBlocksBoth(String cash) {
        account.setCashBalance(new BigDecimal(cash));
        assertThrows(AccountStateException.class, () -> service.archive(1, owner));
        assertThrows(AccountStateException.class, () -> service.delete(1, owner, true));
    }
    @ParameterizedTest @ValueSource(strings = {"quantity <> 0", "status NOT IN"})
    void holdingsAndNonterminalOrdersBlockBoth(String condition) {
        rows.put(condition, 1L);
        assertThrows(AccountStateException.class, () -> service.archive(1, owner));
        assertThrows(AccountStateException.class, () -> service.delete(1, owner, true));
    }
    @Test void theLastActiveAccountCanBeArchived() {
        when(accounts.findByUserIdOrderByOpenedDateDesc(owner)).thenReturn(List.of(account));
        service.delete(1, owner, true);
        assertEquals("ARCHIVED", account.getStatus());
        account.setStatus("ARCHIVED"); account.setArchivedAt(Instant.now());
        assertFalse(service.eligibility(1, owner).archiveBlockers().isEmpty());
    }
    @Test void isolatesOwnersAndMissingAccounts() {
        UUID stranger = UUID.randomUUID();
        assertThrows(ForbiddenException.class, () -> service.eligibility(1, stranger));
        assertThrows(ForbiddenException.class, () -> service.archive(1, stranger));
        assertThrows(ForbiddenException.class, () -> service.delete(1, stranger, true));
        assertThrows(AccountNotFoundException.class, () -> service.eligibility(99, owner));
        assertThrows(AccountNotFoundException.class, () -> service.archive(99, owner));
        assertTrue(service.archived(stranger).isEmpty());
    }
}
