package app.account;

import app.cash.CashTransactionService;
import app.user.User;
import app.user.UserRepository;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.math.BigDecimal;
import java.time.*;
import java.util.UUID;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
class AccountLifecycleConcurrencyTest {
    @Autowired AccountRepository accounts;
    @Autowired AccountLifecycleService lifecycle;
    @Autowired UserRepository users;
    @Autowired CashTransactionService cash;
    @Autowired JdbcTemplate jdbc;
    @Autowired PlatformTransactionManager manager;
    UUID owner;
    Account first;
    Account second;
    ExecutorService workers;
    @BeforeEach void setup() {
        owner = UUID.randomUUID(); workers = Executors.newFixedThreadPool(2);
        User user = new User(); user.setUserId(owner); user.setFirstName("Test"); user.setLastName("Owner");
        user.setAddress("Test address"); user.setSsn(owner.toString());
        user.setDateOfBirth(LocalDate.of(1990,1,1)); user.setCreatedAt(OffsetDateTime.now());
        users.saveAndFlush(user);
        first = create("First", LocalDate.of(2026,1,1)); second = create("Second", LocalDate.of(2026,1,2));
    }
    Account create(String name, LocalDate date) {
        Account a = new Account(); a.setUserId(owner); a.setName(name); a.setOpenedDate(date);
        return accounts.saveAndFlush(a);
    }
    @AfterEach void cleanup() throws InterruptedException {
        workers.shutdownNow(); assertTrue(workers.awaitTermination(5, TimeUnit.SECONDS));
        jdbc.update("DELETE FROM orders WHERE account_id IN (?, ?)", first.getId(), second.getId());
        jdbc.update("DELETE FROM cash_transactions WHERE account_id IN (?, ?)", first.getId(), second.getId());
        accounts.deleteAllById(java.util.List.of(first.getId(), second.getId())); users.deleteById(owner);
    }
    static void await(CountDownLatch latch) {
        try { if (!latch.await(5, TimeUnit.SECONDS)) throw new AssertionError("Timed out awaiting transaction"); }
        catch (InterruptedException e) { Thread.currentThread().interrupt(); throw new AssertionError(e); }
    }
    @Test void concurrentClosuresKeepBothAccountRowsAndTheirArchiveState() throws Exception {
        CountDownLatch start = new CountDownLatch(1);
        var one = workers.submit(() -> close(first, start));
        var two = workers.submit(() -> close(second, start)); start.countDown();
        assertTrue(one.get(10, TimeUnit.SECONDS)); assertTrue(two.get(10, TimeUnit.SECONDS));
        assertEquals(2, accounts.findByUserIdOrderByOpenedDateDesc(owner).stream().filter(a -> "ARCHIVED".equals(a.getStatus())).count());
    }
    boolean close(Account account, CountDownLatch start) {
        await(start);
        try { lifecycle.delete(account.getId(), owner, true); return true; }
        catch (AccountStateException blocked) { return false; }
    }
    @Test void aTransferCommitsBeforeArchiveAndFutureTransfersUseTheRemainingAccount() throws Exception {
        CountDownLatch written = new CountDownLatch(1), release = new CountDownLatch(1);
        var transfer = workers.submit(() -> new TransactionTemplate(manager).executeWithoutResult(tx -> {
            cash.move(owner, BigDecimal.TEN, "DEPOSIT", UUID.randomUUID()); written.countDown(); await(release);
        }));
        await(written);
        var archive = workers.submit(() -> lifecycle.delete(first.getId(), owner, true));
        try { assertThrows(TimeoutException.class, () -> archive.get(200, TimeUnit.MILLISECONDS)); }
        finally { release.countDown(); }
        transfer.get(10, TimeUnit.SECONDS); archive.get(10, TimeUnit.SECONDS);
        cash.move(owner, BigDecimal.ONE, "WITHDRAWAL", UUID.randomUUID());
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM cash_transactions WHERE account_id=?", Integer.class, first.getId()));
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM cash_transactions WHERE account_id=?", Integer.class, second.getId()));
        assertEquals("ARCHIVED", accounts.findById(first.getId()).orElseThrow().getStatus());
        assertEquals(0, users.findById(owner).orElseThrow().getAvailableFunds().compareTo(new BigDecimal("9")));
    }
    @Test void orderAcceptanceAndArchiveSerializeOnTheAccountLock() throws Exception {
        CountDownLatch accepted = new CountDownLatch(1), release = new CountDownLatch(1);
        var order = workers.submit(() -> new TransactionTemplate(manager).executeWithoutResult(tx -> {
            accounts.findByIdForUpdate(first.getId()).orElseThrow();
            jdbc.update("INSERT INTO orders(order_id,account_id,status) VALUES (900001,?,'ACCEPTED')", first.getId());
            accepted.countDown(); await(release);
        }));
        await(accepted);
        var archive = workers.submit(() -> lifecycle.archive(first.getId(), owner));
        try { assertThrows(TimeoutException.class, () -> archive.get(200, TimeUnit.MILLISECONDS)); }
        finally { release.countDown(); }
        order.get(10, TimeUnit.SECONDS);
        ExecutionException failure = assertThrows(ExecutionException.class, () -> archive.get(10, TimeUnit.SECONDS));
        assertInstanceOf(AccountStateException.class, failure.getCause());
        assertEquals("ACTIVE", accounts.findById(first.getId()).orElseThrow().getStatus());
    }
}
