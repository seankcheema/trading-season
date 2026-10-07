package app.cash;

import app.account.Account;
import app.account.AccountRepository;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
@Tag("integration")
class CashTransactionRepositoryTest {

    @Autowired
    private CashTransactionRepository cashTransactionRepository;

    @Autowired
    private AccountRepository accountRepository;

    @Test
    void fundingForUserSpansEveryAccountTheyOwnAndExcludesOtherUsers() {
        UUID alice = UUID.randomUUID();
        UUID bob = UUID.randomUUID();
        Integer aliceFirst = openAccount(alice, LocalDate.of(2026, 1, 1));
        Integer aliceSecond = openAccount(alice, LocalDate.of(2026, 2, 1));
        Integer bobAccount = openAccount(bob, LocalDate.of(2026, 1, 1));

        record(aliceFirst, new BigDecimal("100.00"), "DEPOSIT", "2026-03-01T10:00:00Z");
        record(aliceSecond, new BigDecimal("-20.00"), "WITHDRAWAL", "2026-03-05T10:00:00Z");
        record(bobAccount, new BigDecimal("999.00"), "DEPOSIT", "2026-03-06T10:00:00Z");

        List<CashTransaction> found = cashTransactionRepository
                .findFundingForUser(alice, PageRequest.of(0, 50));

        // Cash is the user's, so the history covers all of their accounts, newest first.
        assertEquals(2, found.size());
        assertEquals(new BigDecimal("-20.00"), found.get(0).getAmount());
        assertEquals(new BigDecimal("100.00"), found.get(1).getAmount());
    }

    @Test
    void fundingForUserLeavesOutOrderFills() {
        UUID user = UUID.randomUUID();
        Integer accountId = openAccount(user, LocalDate.of(2026, 1, 1));
        record(accountId, new BigDecimal("100.00"), "DEPOSIT", "2026-03-01T10:00:00Z");
        record(accountId, new BigDecimal("-10.00"), "ORDER_FILL", "2026-03-02T10:00:00Z");

        List<CashTransaction> found = cashTransactionRepository
                .findFundingForUser(user, PageRequest.of(0, 50));

        assertEquals(1, found.size());
        assertEquals("DEPOSIT", found.get(0).getReason());
    }

    @Test
    void fundingForUserAppliesThePageSize() {
        UUID user = UUID.randomUUID();
        Integer accountId = openAccount(user, LocalDate.of(2026, 1, 1));
        record(accountId, new BigDecimal("1.00"), "DEPOSIT", "2026-03-01T10:00:00Z");
        record(accountId, new BigDecimal("2.00"), "DEPOSIT", "2026-03-02T10:00:00Z");
        record(accountId, new BigDecimal("3.00"), "DEPOSIT", "2026-03-03T10:00:00Z");

        List<CashTransaction> found = cashTransactionRepository
                .findFundingForUser(user, PageRequest.of(0, 2));

        assertEquals(2, found.size());
        assertEquals(new BigDecimal("3.00"), found.get(0).getAmount());
    }

    @Test
    void aUserWithNoTransactionsHasAnEmptyHistory() {
        UUID user = UUID.randomUUID();
        openAccount(user, LocalDate.of(2026, 1, 1));

        assertTrue(cashTransactionRepository.findFundingForUser(user, PageRequest.of(0, 50)).isEmpty());
    }

    @Test
    void activeCashTargetsExcludeArchivedAccountsButTheirLedgerRemainsReadable() {
        UUID user = UUID.randomUUID();
        Integer archivedId = openAccount(user, LocalDate.of(2026, 1, 1));
        Integer activeId = openAccount(user, LocalDate.of(2026, 2, 1));
        Account archived = accountRepository.findById(archivedId).orElseThrow();
        archived.setArchivedAt(java.time.Instant.now());
        accountRepository.saveAndFlush(archived);
        record(archivedId, BigDecimal.TEN, "DEPOSIT", "2026-01-01T12:00:00Z");
        assertEquals(List.of(activeId), accountRepository.findActiveForUpdate(user).stream().map(Account::getId).toList());
        assertEquals(1, cashTransactionRepository.findFundingForUser(user, PageRequest.of(0, 50)).size());
        Account active = accountRepository.findById(activeId).orElseThrow();
        active.setArchivedAt(java.time.Instant.now());
        accountRepository.saveAndFlush(active);
        assertTrue(accountRepository.findActiveForUpdate(user).isEmpty());
    }

    @Test
    void firstAccountOfAUserIsTheEarliestOneOpened() {
        UUID user = UUID.randomUUID();
        Integer earliest = openAccount(user, LocalDate.of(2026, 1, 1));
        openAccount(user, LocalDate.of(2026, 6, 1));

        assertEquals(earliest, accountRepository
                .findFirstByUserIdOrderByOpenedDateAscIdAsc(user)
                .orElseThrow()
                .getAccountId());
    }

    @Test
    void firstAccountIsEmptyForAUserWithNoAccounts() {
        assertTrue(accountRepository
                .findFirstByUserIdOrderByOpenedDateAscIdAsc(UUID.randomUUID())
                .isEmpty());
    }

    private Integer openAccount(UUID userId, LocalDate openedDate) {
        Account account = new Account();
        account.setUserId(userId);
        account.setName("Main Account");
        account.setOpenedDate(openedDate);
        account.setCashBalance(BigDecimal.ZERO);
        account.setCurrency("USD");
        return accountRepository.save(account).getAccountId();
    }

    private void record(Integer accountId, BigDecimal amount, String reason, String createdAt) {
        CashTransaction transaction = new CashTransaction();
        transaction.setAccountId(accountId);
        transaction.setAmount(amount);
        transaction.setReason(reason);
        transaction.setCreatedAt(OffsetDateTime.parse(createdAt));
        cashTransactionRepository.save(transaction);
    }
}
