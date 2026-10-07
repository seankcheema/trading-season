package app.order;

import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.support.TransactionTemplate;
import app.account.Account;
import app.account.AccountNotFoundException;
import app.account.AccountRepository;
import app.auth.ForbiddenException;
import app.holding.Holding;
import app.holding.HoldingRepository;
import app.instrument.Instrument;
import app.instrument.InstrumentNotFoundException;
import app.instrument.InstrumentRepository;
import app.order.audit.AuditTrail;
import app.order.audit.AuditTrailRepository;
import app.order.dto.OrderRequest;
import app.order.execution.CashTransactionRepository;
import app.order.execution.FillRepository;
import app.order.execution.HoldingMovementRepository;
import app.support.UserAccountFixture;
import app.user.User;
import app.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
class OrderServiceTest {

    private static final BigDecimal STARTING_FUNDS = new BigDecimal("100000.00");

    @Autowired
    private OrderService orderService;

    @Autowired
    private PlatformTransactionManager transactionManager;

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private AccountRepository accountRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private InstrumentRepository instrumentRepository;

    @Autowired
    private HoldingRepository holdingRepository;

    @Autowired
    private FillRepository fillRepository;

    @Autowired
    private CashTransactionRepository cashTransactionRepository;

    @Autowired
    private HoldingMovementRepository holdingMovementRepository;

    @Autowired
    private AuditTrailRepository auditTrailRepository;

    private Account account;
    @Autowired
    private JdbcTemplate jdbcTemplate;

    private User user;
    private Instrument instrument;

    @MockitoBean
    private app.order.execution.ExecutionQuoteSource quotes;

    @BeforeEach
    public void setUp() {
        org.mockito.Mockito.when(quotes.current(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any()))
                .thenReturn(new app.order.execution.ExecutionQuoteSource.Quote(new BigDecimal("50.00"), 1L, java.time.Instant.parse("2026-01-05T16:00:00Z")));
        auditTrailRepository.deleteAll();
        holdingMovementRepository.deleteAll();
        cashTransactionRepository.deleteAll();
        fillRepository.deleteAll();
        holdingRepository.deleteAll();
        orderRepository.deleteAll();
        accountRepository.deleteAll();
        userRepository.deleteAll();
        instrumentRepository.deleteAll();

        UserAccountFixture.deleteAll(jdbcTemplate);

        // The auth service creates the account before it issues a token.
        UUID userId = UUID.randomUUID();
        UserAccountFixture.createActiveAccount(jdbcTemplate, userId, "trader@example.com");

        // Create test user; funds belong to the user (KAN-93)
        user = new User();
        user.setUserId(userId);
        user.setFirstName("Test");
        user.setLastName("User");
        user.setSsn("123-45-6789");
        user.setAddress("123 Test St");
        user.setDateOfBirth(LocalDate.of(1990, 1, 1));
        user.setExecutionBufferPercent(new BigDecimal("5.0"));
        user.setAvailableFunds(STARTING_FUNDS);
        user.setCreatedAt(OffsetDateTime.now());
        user = userRepository.save(user);

        // Create test account with no cash of its own, to prove orders use the user's funds
        account = new Account();
        account.setUserId(user.getUserId());
        account.setOpenedDate(LocalDate.now());
        account.setCashBalance(BigDecimal.ZERO);
        account = accountRepository.save(account);

        // Create test instrument
        instrument = new Instrument();
        instrument.setTicker("TEST");
        instrument.setName("Test Instrument");
        instrument.setAssetClass("EQUITY");
        instrument.setCurrency("USD");
        instrument.setTradable(true);
        instrument = instrumentRepository.save(instrument);
    }

    private OrderRequest order(String orderType, String quantity, String price) {
        org.mockito.Mockito.when(quotes.current(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any()))
                .thenReturn(new app.order.execution.ExecutionQuoteSource.Quote(new BigDecimal(price), 1L, java.time.Instant.parse("2026-01-05T16:00:00Z")));
        return new OrderRequest(
                account.getAccountId(),
                instrument.getInstrumentId(),
                orderType,
                new BigDecimal(quantity),
                new BigDecimal(price),
                new BigDecimal("2.0"),
                UUID.randomUUID()
        );
    }

    @Test void checkIsAdvisoryAndExecutionRechecksPrice() {
        var request = new app.order.dto.OrderCheckRequest(account.getAccountId(), instrument.getInstrumentId(), "BUY",
                new BigDecimal("10"), new BigDecimal("50"), null, 7L, null);
        var assessment = orderService.check(request, user.getUserId());
        assertTrue(assessment.eligible());
        assertEquals(0, orderRepository.count()); assertEquals(0, auditTrailRepository.count());
        assertEquals(0, fillRepository.count()); assertEquals(0, cashTransactionRepository.count());
        org.mockito.Mockito.when(quotes.current(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any()))
                .thenReturn(new app.order.execution.ExecutionQuoteSource.Quote(new BigDecimal("60"), 7L, java.time.Instant.parse("2026-01-05T16:00:01Z")));
        Order result = orderService.submitOrder(request.asOrderRequest(), user.getUserId());
        assertEquals("REJECTED", result.getStatus()); assertEquals(0, fillRepository.count());
        assertEquals(0, STARTING_FUNDS.compareTo(availableFunds()));
    }
    @Test void checkReportsInvalidBufferRulesUnavailablePricesAndResources() {
        var request = new app.order.dto.OrderCheckRequest(account.getAccountId(), instrument.getInstrumentId(), "BUY",
                new BigDecimal("10"), new BigDecimal("50"), null, null, null);
        assertNotNull(assertThrows(ForbiddenException.class, () -> orderService.check(request, UUID.randomUUID())));
        user.setExecutionBufferPercent(new BigDecimal("11")); userRepository.save(user);
        assertEquals("INVALID_BUFFER", orderService.check(request, user.getUserId()).rejectionCode());
        user.setExecutionBufferPercent(BigDecimal.ONE); user.setAvailableFunds(BigDecimal.ONE); userRepository.save(user);
        assertEquals("INSUFFICIENT_FUNDS", orderService.check(request, user.getUserId()).rejectionCode());
        org.mockito.Mockito.when(quotes.current(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any()))
                .thenThrow(new app.order.execution.ExecutionQuoteSource.QuoteUnavailableException());
        assertEquals("MARKET_PRICE_UNAVAILABLE", orderService.check(request, user.getUserId()).rejectionCode());
        instrument.setTradable(false); instrumentRepository.save(instrument);
        assertEquals("TRADING_RULE_FAILED", orderService.check(request, user.getUserId()).rejectionCode());
        account.setArchivedAt(java.time.Instant.now()); accountRepository.save(account);
        assertNotNull(assertThrows(ResponseStatusException.class, () -> orderService.check(request, user.getUserId())));
    }
    @Test void historyAndRetryReadActualPersistedFillPrice() {
        var request = order("BUY", "1", "50");
        org.mockito.Mockito.when(quotes.current(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any()))
                .thenReturn(new app.order.execution.ExecutionQuoteSource.Quote(new BigDecimal("49"), 7L, java.time.Instant.parse("2026-01-05T16:00:01Z")));
        Order filled = orderService.submitOrder(request, user.getUserId());
        assertEquals(0, new BigDecimal("49").compareTo(filled.getExecutionPrice()));
        assertEquals(0, new BigDecimal("49").compareTo(orderService.getOwnOrders(user.getUserId()).getFirst().getExecutionPrice()));
        assertEquals(0, new BigDecimal("49").compareTo(orderService.submitOrder(request, user.getUserId()).getExecutionPrice()));
        assertNotNull(filled.getExecutedSimulatedAt()); assertEquals(7L, filled.getSessionId());
    }

    @Test
    void concurrentOrdersOnDifferentAccountsCannotSpendTheSameUserCash() throws Exception {
        user.setAvailableFunds(new BigDecimal("50.00"));
        userRepository.save(user);
        Account second = new Account();
        second.setUserId(user.getUserId());
        second.setOpenedDate(LocalDate.now());
        second.setCashBalance(BigDecimal.ZERO);
        second = accountRepository.save(second);
        OrderRequest firstRequest = order("BUY", "1", "50.00");
        OrderRequest secondRequest = new OrderRequest(second.getAccountId(), instrument.getInstrumentId(),
                "BUY", BigDecimal.ONE, new BigDecimal("50.00"), null, UUID.randomUUID());
        var start = new java.util.concurrent.CountDownLatch(1);
        try (var pool = java.util.concurrent.Executors.newFixedThreadPool(2)) {
            var first = pool.submit(() -> { start.await(); return orderService.submitOrder(firstRequest, user.getUserId()); });
            var other = pool.submit(() -> { start.await(); return orderService.submitOrder(secondRequest, user.getUserId()); });
            start.countDown();
            var statuses = java.util.stream.Stream.of(first.get(10, java.util.concurrent.TimeUnit.SECONDS),
                    other.get(10, java.util.concurrent.TimeUnit.SECONDS)).map(Order::getStatus).sorted().toList();
            assertEquals(List.of("FILLED", "REJECTED"), statuses);
        }
        assertEquals(0, availableFunds().signum());
        assertEquals(1, fillRepository.count());
    }

    @Test
    void ledgerFailureRollsBackTheOrderFillCashAndHoldingsTogether() {
        jdbcTemplate.execute("alter table holding_movements add constraint buffer_test_failure check (quantity_delta <= 0)");
        try {
            var request = order("BUY", "1", "50.00");
            var failure = assertThrows(DataIntegrityViolationException.class,
                    () -> orderService.submitOrder(request, user.getUserId()));
            assertNotNull(failure);
            assertEquals(0, orderRepository.count());
            assertEquals(0, fillRepository.count());
            assertEquals(0, cashTransactionRepository.count());
            assertEquals(0, holdingMovementRepository.count());
            assertEquals(0, holdingRepository.count());
            assertEquals(0, auditTrailRepository.count());
            assertEquals(0, STARTING_FUNDS.compareTo(availableFunds()));
        } finally {
            jdbcTemplate.execute("alter table holding_movements drop constraint buffer_test_failure");
        }
    }

    private Holding holdingOf(String quantity) {
        Holding holding = new Holding();
        holding.setAccountId(account.getAccountId());
        holding.setInstrumentId(instrument.getInstrumentId());
        holding.setQuantity(new BigDecimal(quantity));
        holding.setUpdatedAt(OffsetDateTime.now());
        return holdingRepository.save(holding);
    }

    private BigDecimal availableFunds() {
        return userRepository.findById(user.getUserId()).orElseThrow().getAvailableFunds();
    }

    private List<String> auditEventsFor(Order order) {
        return auditTrailRepository.findAll().stream()
                .filter(event -> event.getOrderId().equals(order.getOrderId()))
                .sorted(Comparator.comparing(AuditTrail::getAuditId))
                .map(AuditTrail::getEventType)
                .toList();
    }

    @Test
    void submissionWaitsForConcurrentArchiveAndCannotFillAfterward() throws Exception {
        var transactions = new TransactionTemplate(transactionManager);
        var locked = new java.util.concurrent.CountDownLatch(1);
        var release = new java.util.concurrent.CountDownLatch(1);
        var submitting = new java.util.concurrent.CountDownLatch(1);
        var pool = java.util.concurrent.Executors.newFixedThreadPool(2);
        try {
            var archive = pool.submit(() -> transactions.executeWithoutResult(status -> {
                Account target = accountRepository.findByIdForUpdate(account.getAccountId()).orElseThrow();
                target.setArchivedAt(java.time.Instant.now());
                accountRepository.saveAndFlush(target);
                locked.countDown();
                try { assertTrue(release.await(5, java.util.concurrent.TimeUnit.SECONDS)); }
                catch (InterruptedException interrupted) { Thread.currentThread().interrupt(); throw new IllegalStateException(interrupted); }
            }));
            assertTrue(locked.await(5, java.util.concurrent.TimeUnit.SECONDS));
            var request = order("BUY", "1", "50.00");
            var trade = pool.submit(() -> {
                submitting.countDown();
                return orderService.submitOrder(request, user.getUserId());
            });
            assertTrue(submitting.await(5, java.util.concurrent.TimeUnit.SECONDS));
            assertNotNull(assertThrows(java.util.concurrent.TimeoutException.class,
                    () -> trade.get(200, java.util.concurrent.TimeUnit.MILLISECONDS)));
            release.countDown();
            archive.get(5, java.util.concurrent.TimeUnit.SECONDS);
            var failure = assertThrows(java.util.concurrent.ExecutionException.class,
                    () -> trade.get(5, java.util.concurrent.TimeUnit.SECONDS));
            var cause = assertInstanceOf(ResponseStatusException.class, failure.getCause());
            assertEquals(409, cause.getStatusCode().value());
            assertEquals(0, orderRepository.count());
            assertEquals(0, fillRepository.count());
            assertEquals(0, cashTransactionRepository.count());
        } finally {
            release.countDown();
            pool.shutdownNow();
        }
    }

    @Test
    void archivedAccountRejectsNewOrdersButKeepsIdempotentHistory() {
        OrderRequest original = order("BUY", "1", "50.00");
        Order saved = orderService.submitOrder(original, user.getUserId());
        account.setArchivedAt(java.time.Instant.now());
        accountRepository.save(account);
        assertEquals(saved.getOrderId(), orderService.submitOrder(original, user.getUserId()).getOrderId());
        var error = assertThrows(ResponseStatusException.class,
                () -> orderService.submitOrder(order("BUY", "1", "50.00"), user.getUserId()));
        assertEquals(409, error.getStatusCode().value());
        assertEquals(1, orderRepository.count());
        assertEquals(1, fillRepository.count());
        assertEquals(1, cashTransactionRepository.count());
        assertEquals(1, holdingMovementRepository.count());
        assertEquals(1, orderService.getOwnOrders(user.getUserId()).size());
    }

    @Test
    void buyOrderIsCreatedPendingAndEndsFilled() {
        Order order = orderService.submitOrder(order("BUY", "100", "50.00"), user.getUserId());

        assertEquals(Order.STATUS_FILLED, order.getStatus());
        assertNull(order.getRejectionReason());
        assertNotNull(order.getAcceptedAt());
        assertNotNull(order.getResolvedAt());
        assertEquals(List.of(Order.STATUS_PENDING, Order.STATUS_FILLED), auditEventsFor(order));
    }

    @Test
    void buyOrderDecreasesUsersAvailableFunds() {
        orderService.submitOrder(order("BUY", "100", "50.00"), user.getUserId());

        assertEquals(0, new BigDecimal("95000.00").compareTo(availableFunds()));
        assertEquals(1, fillRepository.count());
        assertEquals(1, cashTransactionRepository.count());
        // The account's own cash balance is not the funds source and is left alone
        assertEquals(0, BigDecimal.ZERO.compareTo(
                accountRepository.findById(account.getAccountId()).orElseThrow().getCashBalance()));
    }

    @Test
    void buyOrderAddsToHoldings() {
        orderService.submitOrder(order("BUY", "100", "50.00"), user.getUserId());

        Holding holding = holdingRepository
                .findByAccountIdAndInstrumentId(account.getAccountId(), instrument.getInstrumentId())
                .orElseThrow();
        assertEquals(0, new BigDecimal("100").compareTo(holding.getQuantity()));
    }

    @Test
    void buyOrderWithInsufficientFundsIsRejected() {
        user.setAvailableFunds(new BigDecimal("1000.00"));
        userRepository.save(user);

        Order order = orderService.submitOrder(order("BUY", "100", "50.00"), user.getUserId());

        assertEquals(Order.STATUS_REJECTED, order.getStatus());
        assertTrue(order.getRejectionReason().contains("BR-09"));
        assertNotNull(order.getResolvedAt());
        assertEquals(0, new BigDecimal("1000.00").compareTo(availableFunds()));
        assertEquals(0, fillRepository.count());
        assertEquals(List.of(Order.STATUS_PENDING, Order.STATUS_REJECTED), auditEventsFor(order));
    }

    @Test
    void buyOrderThatExactlyMatchesAvailableFundsIsFilled() {
        user.setAvailableFunds(new BigDecimal("5000.00"));
        userRepository.save(user);

        Order order = orderService.submitOrder(order("BUY", "100", "50.00"), user.getUserId());

        assertEquals(Order.STATUS_FILLED, order.getStatus());
        assertEquals(0, BigDecimal.ZERO.compareTo(availableFunds()));
    }

    @Test
    void sellOrderAddsFundsBackToUser() {
        holdingOf("50");

        Order order = orderService.submitOrder(order("SELL", "50", "100.00"), user.getUserId());

        assertEquals(Order.STATUS_FILLED, order.getStatus());
        assertEquals(0, new BigDecimal("105000.00").compareTo(availableFunds()));
        Holding holding = holdingRepository
                .findByAccountIdAndInstrumentId(account.getAccountId(), instrument.getInstrumentId())
                .orElseThrow();
        assertEquals(0, BigDecimal.ZERO.compareTo(holding.getQuantity()));
        assertEquals(List.of(Order.STATUS_PENDING, Order.STATUS_FILLED), auditEventsFor(order));
    }

    @Test
    void sellOrderWithoutEnoughHoldingsIsRejected() {
        holdingOf("10");

        Order order = orderService.submitOrder(order("SELL", "50", "100.00"), user.getUserId());

        assertEquals(Order.STATUS_REJECTED, order.getStatus());
        assertNotNull(order.getRejectionReason());
        assertEquals(0, STARTING_FUNDS.compareTo(availableFunds()));
        assertEquals(0, fillRepository.count());
    }

    @Test
    void submitOrderSuccessfullyCreatesOrder() {
        OrderRequest request = new OrderRequest(
                account.getAccountId(),
                instrument.getInstrumentId(),
                "BUY",
                new BigDecimal("100"),
                new BigDecimal("50.00"),
                new BigDecimal("2.0"),
                UUID.randomUUID()
        );

        Order order = orderService.submitOrder(request, user.getUserId());

        assertNotNull(order);
        assertNotNull(order.getOrderId());
        assertEquals(account.getAccountId(), order.getAccountId());
        assertEquals(instrument.getInstrumentId(), order.getInstrumentId());
        assertEquals("BUY", order.getOrderType());
        assertEquals(new BigDecimal("100"), order.getQuantity());
        assertEquals(new BigDecimal("50.00"), order.getIndicativePrice());
        assertEquals(new BigDecimal("2.0"), order.getBufferPercent());
        assertNotNull(order.getSubmittedAt());
    }

    @Test
    void submitOrderUsesUserDefaultBufferWhenNotSpecified() {
        OrderRequest request = new OrderRequest(
                account.getAccountId(),
                instrument.getInstrumentId(),
                "SELL",
                new BigDecimal("50"),
                new BigDecimal("100.00"),
                null,
                UUID.randomUUID()
        );

        Order order = orderService.submitOrder(request, user.getUserId());

        assertNotNull(order);
        assertEquals(0, user.getExecutionBufferPercent().compareTo(order.getBufferPercent()));
    }

    @Test
    void submitOrderWithDuplicateClientReferenceReturnsExistingOrder() {
        UUID clientRef = UUID.randomUUID();
        OrderRequest request1 = new OrderRequest(
                account.getAccountId(),
                instrument.getInstrumentId(),
                "BUY",
                new BigDecimal("100"),
                new BigDecimal("50.00"),
                new BigDecimal("2.0"),
                clientRef
        );

        Order firstOrder = orderService.submitOrder(request1, user.getUserId());
        Integer firstOrderId = firstOrder.getOrderId();

        // Submit with same client reference
        OrderRequest request2 = new OrderRequest(
                account.getAccountId(),
                instrument.getInstrumentId(),
                "BUY",
                new BigDecimal("100"),
                new BigDecimal("50.00"),
                new BigDecimal("2.0"),
                clientRef
        );

        Order secondOrder = orderService.submitOrder(request2, user.getUserId());
        assertEquals(firstOrderId, secondOrder.getOrderId());
    }

    @Test
    void submitOrderThrowsAccountNotFound() {
        OrderRequest request = new OrderRequest(
                9999,
                instrument.getInstrumentId(),
                "BUY",
                new BigDecimal("100"),
                new BigDecimal("50.00"),
                new BigDecimal("2.0"),
                UUID.randomUUID()
        );

        assertNotNull(assertThrows(AccountNotFoundException.class, () -> orderService.submitOrder(request, user.getUserId())));
    }

    @Test
    void submitOrderThrowsInstrumentNotFound() {
        OrderRequest request = new OrderRequest(
                account.getAccountId(),
                9999,
                "BUY",
                new BigDecimal("100"),
                new BigDecimal("50.00"),
                new BigDecimal("2.0"),
                UUID.randomUUID()
        );

        assertNotNull(assertThrows(InstrumentNotFoundException.class, () -> orderService.submitOrder(request, user.getUserId())));
    }

    @Test
    void submitOrderPersistsToRepository() {
        OrderRequest request = new OrderRequest(
                account.getAccountId(),
                instrument.getInstrumentId(),
                "BUY",
                new BigDecimal("200"),
                new BigDecimal("75.50"),
                new BigDecimal("3.0"),
                UUID.randomUUID()
        );

        Order order = orderService.submitOrder(request, user.getUserId());

        Optional<Order> retrieved = orderRepository.findById(order.getOrderId());
        assertTrue(retrieved.isPresent());
        assertEquals(order.getOrderId(), retrieved.get().getOrderId());
        assertEquals(0, new BigDecimal("200").compareTo(retrieved.get().getQuantity()));
    }

    @Test
    void submitOrderRecordsSubmittedTimestamp() {
        OrderRequest request = new OrderRequest(
                account.getAccountId(),
                instrument.getInstrumentId(),
                "SELL",
                new BigDecimal("75"),
                new BigDecimal("80.00"),
                new BigDecimal("2.5"),
                UUID.randomUUID()
        );

        OffsetDateTime beforeSubmit = OffsetDateTime.now();
        Order order = orderService.submitOrder(request, user.getUserId());
        OffsetDateTime afterSubmit = OffsetDateTime.now();

        assertNotNull(order.getSubmittedAt());
        assertFalse(order.getSubmittedAt().isBefore(beforeSubmit));
        assertFalse(order.getSubmittedAt().isAfter(afterSubmit));
    }

    @Test
    void submitOrderRefusesAnAccountTheCallerDoesNotOwn() {
        OrderRequest request = order("BUY", "1", "10.00");

        assertNotNull(assertThrows(ForbiddenException.class,
                () -> orderService.submitOrder(request, UUID.randomUUID())));
        // Refused before anything is written: no order row, so no PENDING to explain later.
        assertTrue(orderRepository.findAll().isEmpty());
    }

    @Test
    void submitOrderRefusesAnotherUsersIdempotencyKeyBeforeAnsweringIt() {
        // The key belongs to this account, and its outcome is this owner's to read.
        Order placed = orderService.submitOrder(order("BUY", "10", "20.00"), user.getUserId());
        OrderRequest replay = new OrderRequest(
                account.getAccountId(),
                instrument.getInstrumentId(),
                "BUY",
                new BigDecimal("10"),
                new BigDecimal("20.00"),
                new BigDecimal("2.0"),
                placed.getClientReference()
        );

        assertNotNull(assertThrows(ForbiddenException.class,
                () -> orderService.submitOrder(replay, UUID.randomUUID())));
    }

    @Test
    void submitOrderAnswersTheOwnersOwnReplayWithTheOriginalOutcome() {
        Order placed = orderService.submitOrder(order("BUY", "10", "20.00"), user.getUserId());
        OrderRequest replay = new OrderRequest(
                account.getAccountId(),
                instrument.getInstrumentId(),
                "BUY",
                new BigDecimal("10"),
                new BigDecimal("20.00"),
                new BigDecimal("2.0"),
                placed.getClientReference()
        );

        Order replayed = orderService.submitOrder(replay, user.getUserId());

        assertEquals(placed.getOrderId(), replayed.getOrderId());
        assertEquals(1, orderRepository.findAll().size());
    }
}
