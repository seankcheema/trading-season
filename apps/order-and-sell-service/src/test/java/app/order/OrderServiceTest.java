package app.order;

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
    @org.springframework.test.context.bean.override.mockito.MockitoBean
    private app.order.execution.ExecutionQuoteSource quoteSource;

    private Order submit(app.order.dto.OrderRequest request, java.util.UUID owner) {
        org.mockito.Mockito.when(quoteSource.current(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any()))
                .thenReturn(new app.order.execution.ExecutionQuoteSource.Quote(request.indicativePrice(), 1L,
                        java.time.OffsetDateTime.parse("2026-01-05T15:00:00Z")));
        return orderService.submitOrder(request, owner);
    }


    private static final BigDecimal STARTING_FUNDS = new BigDecimal("100000.00");

    @Autowired
    private OrderService orderService;

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

    @BeforeEach
    void setUp() {
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
        UserAccountFixture.acceptCurrentTerms(jdbcTemplate, userId);

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
        return new OrderRequest(
                account.getAccountId(),
                instrument.getInstrumentId(),
                orderType,
                new BigDecimal(quantity),
                new BigDecimal(price),
                null, UUID.randomUUID()
        );
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
    void buyOrderIsCreatedPendingAndEndsFilled() {
        Order order = submit(order("BUY", "100", "50.00"), user.getUserId());

        assertEquals(Order.STATUS_FILLED, order.getStatus());
        assertNull(order.getRejectionReason());
        assertNotNull(order.getAcceptedAt());
        assertNotNull(order.getResolvedAt());
        assertEquals(List.of(Order.STATUS_PENDING, Order.STATUS_ACCEPTED, Order.STATUS_FILLED), auditEventsFor(order));
    }

    @Test
    void buyOrderDecreasesUsersAvailableFunds() {
        submit(order("BUY", "100", "50.00"), user.getUserId());

        assertEquals(0, new BigDecimal("95000.00").compareTo(availableFunds()));
        assertEquals(1, fillRepository.count());
        assertEquals(1, cashTransactionRepository.count());
        // The account's own cash balance is not the funds source and is left alone
        assertEquals(0, BigDecimal.ZERO.compareTo(
                accountRepository.findById(account.getAccountId()).orElseThrow().getCashBalance()));
    }

    @Test
    void buyOrderAddsToHoldings() {
        submit(order("BUY", "100", "50.00"), user.getUserId());

        Holding holding = holdingRepository
                .findByAccountIdAndInstrumentId(account.getAccountId(), instrument.getInstrumentId())
                .orElseThrow();
        assertEquals(0, new BigDecimal("100").compareTo(holding.getQuantity()));
    }

    @Test
    void buyOrderWithInsufficientFundsIsRejected() {
        user.setAvailableFunds(new BigDecimal("1000.00"));
        userRepository.save(user);

        Order order = submit(order("BUY", "100", "50.00"), user.getUserId());

        assertEquals(Order.STATUS_REJECTED, order.getStatus());
        assertTrue(order.getRejectionReason().contains("BR-09"));
        assertNotNull(order.getResolvedAt());
        assertEquals(0, new BigDecimal("1000.00").compareTo(availableFunds()));
        assertEquals(0, fillRepository.count());
        assertEquals(List.of(Order.STATUS_PENDING, Order.STATUS_REJECTED), auditEventsFor(order));
    }

    @Test
    void buyOrderThatExactlyMatchesAvailableFundsIsFilled() {
        user.setExecutionBufferPercent(BigDecimal.ZERO);
        user.setAvailableFunds(new BigDecimal("5000.00"));
        userRepository.save(user);

        Order order = submit(order("BUY", "100", "50.00"), user.getUserId());

        assertEquals(Order.STATUS_FILLED, order.getStatus());
        assertEquals(0, BigDecimal.ZERO.compareTo(availableFunds()));
    }

    @Test
    void sellOrderAddsFundsBackToUser() {
        holdingOf("50");

        Order order = submit(order("SELL", "50", "100.00"), user.getUserId());

        assertEquals(Order.STATUS_FILLED, order.getStatus());
        assertEquals(0, new BigDecimal("105000.00").compareTo(availableFunds()));
        Holding holding = holdingRepository
                .findByAccountIdAndInstrumentId(account.getAccountId(), instrument.getInstrumentId())
                .orElseThrow();
        assertEquals(0, BigDecimal.ZERO.compareTo(holding.getQuantity()));
        assertEquals(List.of(Order.STATUS_PENDING, Order.STATUS_ACCEPTED, Order.STATUS_FILLED), auditEventsFor(order));
    }

    @Test
    void sellOrderWithoutEnoughHoldingsIsRejected() {
        holdingOf("10");

        Order order = submit(order("SELL", "50", "100.00"), user.getUserId());

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
                null, UUID.randomUUID()
        );

        Order order = submit(request, user.getUserId());

        assertNotNull(order);
        assertNotNull(order.getOrderId());
        assertEquals(account.getAccountId(), order.getAccountId());
        assertEquals(instrument.getInstrumentId(), order.getInstrumentId());
        assertEquals("BUY", order.getOrderType());
        assertEquals(0, new BigDecimal("100").compareTo(order.getQuantity()));
        assertEquals(new BigDecimal("50.00"), order.getIndicativePrice());
        assertEquals(0, user.getExecutionBufferPercent().compareTo(order.getBufferPercent()));
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

        Order order = submit(request, user.getUserId());

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
                null, clientRef
        );

        Order firstOrder = submit(request1, user.getUserId());
        Integer firstOrderId = firstOrder.getOrderId();

        // Submit with same client reference
        OrderRequest request2 = new OrderRequest(
                account.getAccountId(),
                instrument.getInstrumentId(),
                "BUY",
                new BigDecimal("100"),
                new BigDecimal("50.00"),
                null, clientRef
        );

        Order secondOrder = submit(request2, user.getUserId());
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
                null, UUID.randomUUID()
        );

        assertThrows(AccountNotFoundException.class, () -> submit(request, user.getUserId()));
    }

    @Test
    void submitOrderThrowsInstrumentNotFound() {
        OrderRequest request = new OrderRequest(
                account.getAccountId(),
                9999,
                "BUY",
                new BigDecimal("100"),
                new BigDecimal("50.00"),
                null, UUID.randomUUID()
        );

        assertThrows(InstrumentNotFoundException.class, () -> submit(request, user.getUserId()));
    }

    @Test
    void submitOrderPersistsToRepository() {
        OrderRequest request = new OrderRequest(
                account.getAccountId(),
                instrument.getInstrumentId(),
                "BUY",
                new BigDecimal("200"),
                new BigDecimal("75.50"),
                null, UUID.randomUUID()
        );

        Order order = submit(request, user.getUserId());

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
                null, UUID.randomUUID()
        );

        OffsetDateTime beforeSubmit = OffsetDateTime.now();
        Order order = submit(request, user.getUserId());
        OffsetDateTime afterSubmit = OffsetDateTime.now();

        assertNotNull(order.getSubmittedAt());
        assertFalse(order.getSubmittedAt().isBefore(beforeSubmit));
        assertFalse(order.getSubmittedAt().isAfter(afterSubmit));
    }

    @Test
    void archivedAccountsRejectNewOrdersAndPreserveHistoryReplays() {
        OrderRequest original = order("BUY", "1", "10.00");
        Order placed = submit(original, user.getUserId());
        account.setStatus("ARCHIVED"); account.setArchivedAt(java.time.Instant.now());
        accountRepository.saveAndFlush(account);
        assertThrows(ForbiddenException.class,
                () -> submit(order("BUY", "1", "10.00"), user.getUserId()));
        assertEquals(placed.getOrderId(), submit(original, user.getUserId()).getOrderId());
        assertEquals(1, orderRepository.count());
    }

    @Test
    void submitOrderRefusesAnAccountTheCallerDoesNotOwn() {
        OrderRequest request = order("BUY", "1", "10.00");

        assertThrows(ForbiddenException.class,
                () -> submit(request, UUID.randomUUID()));
        // Refused before anything is written: no order row, so no PENDING to explain later.
        assertTrue(orderRepository.findAll().isEmpty());
    }

    @Test
    void submitOrderRefusesAnotherUsersIdempotencyKeyBeforeAnsweringIt() {
        // The key belongs to this account, and its outcome is this owner's to read.
        Order placed = submit(order("BUY", "10", "20.00"), user.getUserId());
        OrderRequest replay = new OrderRequest(
                account.getAccountId(),
                instrument.getInstrumentId(),
                "BUY",
                new BigDecimal("10"),
                new BigDecimal("20.00"),
                new BigDecimal("2.0"),
                placed.getClientReference()
        );

        assertThrows(ForbiddenException.class,
                () -> submit(replay, UUID.randomUUID()));
    }

    @Test
    void submitOrderAnswersTheOwnersOwnReplayWithTheOriginalOutcome() {
        Order placed = submit(order("BUY", "10", "20.00"), user.getUserId());
        OrderRequest replay = new OrderRequest(
                account.getAccountId(),
                instrument.getInstrumentId(),
                "BUY",
                new BigDecimal("10"),
                new BigDecimal("20.00"),
                new BigDecimal("2.0"),
                placed.getClientReference()
        );

        Order replayed = submit(replay, user.getUserId());

        assertEquals(placed.getOrderId(), replayed.getOrderId());
        assertEquals(1, orderRepository.findAll().size());
    }

    @Autowired private app.order.execution.OrderExecutionService execution;

    private Order typed(String side, String type, String limit, String stop, String quote, String quantity) {
        var request = new OrderRequest(account.getAccountId(), instrument.getInstrumentId(), side,
                new BigDecimal(quantity), new BigDecimal("0.01"), null, UUID.randomUUID(), null, type,
                limit == null ? null : new BigDecimal(limit), stop == null ? null : new BigDecimal(stop), 1L);
        org.mockito.Mockito.when(quoteSource.current(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any()))
                .thenReturn(new app.order.execution.ExecutionQuoteSource.Quote(new BigDecimal(quote), 1L,
                        OffsetDateTime.parse("2026-01-05T15:00:00Z")));
        return orderService.submitOrder(request, user.getUserId());
    }
    private Order tick(Order order, String price, int seconds) {
        return execution.evaluate(order.getOrderId(), instrument,
                new app.order.execution.ExecutionQuoteSource.Quote(new BigDecimal(price), 1L, order.getReferenceAt().plusSeconds(seconds)));
    }
    @Test void limitReservesUntilEligibleThenFillsOnceAtTheMarketQuote() {
        Order open = typed("BUY", "LIMIT", "95", null, "100", "10");
        assertEquals("ACCEPTED", open.getStatus());
        assertEquals(0, new BigDecimal("950").compareTo(open.getReservedCash()));
        assertEquals(0, fillRepository.count());
        assertEquals("ACCEPTED", tick(open, "96", 1).getStatus());
        Order filled = tick(open, "95", 2);
        assertEquals("FILLED", filled.getStatus());
        assertEquals(0, new BigDecimal("95").compareTo(filled.getExecutionPrice()));
        assertEquals(0, filled.getReservedCash().signum());
        assertEquals("FILLED", tick(open, "94", 3).getStatus());
        assertEquals(1, fillRepository.count());
    }
    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.CsvSource({"BUY,LIMIT,95,", "SELL,LIMIT,105,", "BUY,STOP,,105", "SELL,STOP,,95", "BUY,STOP_LIMIT,102,105", "SELL,STOP_LIMIT,98,95"})
    void everyConditionalOrderExpiresAndReleasesResources(String side, String type, String limit, String stop) {
        if ("SELL".equals(side)) holdingRepository.save(holdingOf("10"));
        Order open = typed(side, type, limit, stop, "100", "1");
        var expiry = app.order.execution.ExecutionPolicy.expiresAt(open);
        var quote = new app.order.execution.ExecutionQuoteSource.Quote(new BigDecimal("100"), 1L, expiry);
        Order expired = execution.evaluate(open.getOrderId(), instrument, quote);
        assertEquals("CANCELLED", expired.getStatus());
        assertEquals("ORDER_EXPIRED", expired.getRejectionCode());
        assertEquals(0, expired.getReservedCash().signum());
        assertEquals(0, expired.getReservedShares().signum());
        assertEquals("CANCELLED", tick(open, "100", 1).getStatus());
        assertEquals(0, fillRepository.count());
        assertEquals("CANCELLED", orderService.cancel(open.getOrderId(), user.getUserId()).getStatus());
    }
    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.CsvSource({"BUY,LIMIT,95,,95", "SELL,LIMIT,105,,105", "BUY,STOP,,105,106", "SELL,STOP,,95,94", "BUY,STOP_LIMIT,106,105,106", "SELL,STOP_LIMIT,94,95,94"})
    void conditionalExecutionsRemainTerminalAfterRewindsAndDuplicateTicks(String side, String type, String limit, String stop, String fillPrice) {
        if ("SELL".equals(side)) holdingRepository.save(holdingOf("10"));
        Order open = typed(side, type, limit, stop, "100", "1");
        assertEquals("FILLED", tick(open, fillPrice, 3600).getStatus());
        assertEquals("FILLED", tick(open, "100", 1).getStatus());
        assertEquals("FILLED", tick(open, fillPrice, 3600).getStatus());
        assertEquals(1, fillRepository.count());
    }
    private OrderRequest replacement(Order original, String quantity, String limit) {
        return new OrderRequest(original.getAccountId(), original.getInstrumentId(), original.getOrderType(),
                new BigDecimal(quantity), new BigDecimal("100"), null, UUID.randomUUID(), null,
                "LIMIT", new BigDecimal(limit), null, original.getSessionId());
    }
    @Test void editReleasesOnlyTheOriginalReservationAndRetriesIdempotently() {
        Order open = typed("BUY", "LIMIT", "95", null, "100", "10");
        OrderRequest request = replacement(open, "20", "94");
        Order updated = orderService.replace(open.getOrderId(), request, user.getUserId());
        assertEquals("ACCEPTED", updated.getStatus());
        assertEquals(0, new BigDecimal("1880").compareTo(updated.getReservedCash()));
        Order original = orderRepository.findById(open.getOrderId()).orElseThrow();
        assertEquals("CANCELLED", original.getStatus());
        assertEquals("ORDER_REPLACED", original.getRejectionCode());
        assertEquals(0, original.getReservedCash().signum());
        assertEquals(updated.getOrderId(), orderService.replace(open.getOrderId(), request, user.getUserId()).getOrderId());
        assertEquals(2, orderRepository.count());
    }
    @Test void invalidEditRollsBackAndKeepsTheOriginalOpen() {
        Order open = typed("BUY", "LIMIT", "95", null, "100", "10");
        assertThrows(org.springframework.web.server.ResponseStatusException.class,
                () -> orderService.replace(open.getOrderId(), replacement(open, "2000", "94"), user.getUserId()));
        Order original = orderRepository.findById(open.getOrderId()).orElseThrow();
        assertEquals("ACCEPTED", original.getStatus());
        assertEquals(0, new BigDecimal("950").compareTo(original.getReservedCash()));
        assertEquals(1, orderRepository.count());
    }
    @Test void editCannotReachAnotherUserOrReviveACancelledOrder() {
        Order open = typed("BUY", "LIMIT", "95", null, "100", "1");
        assertThrows(AccountNotFoundException.class,
                () -> orderService.replace(open.getOrderId(), replacement(open, "1", "94"), UUID.randomUUID()));
        orderService.cancel(open.getOrderId(), user.getUserId());
        assertThrows(org.springframework.web.server.ResponseStatusException.class,
                () -> orderService.replace(open.getOrderId(), replacement(open, "1", "94"), user.getUserId()));
    }
    @Test void editRejectsARewindBehindTheOrdersWatermark() {
        Order open = typed("BUY", "LIMIT", "95", null, "100", "1");
        tick(open, "100", 10);
        assertThrows(org.springframework.web.server.ResponseStatusException.class,
                () -> orderService.replace(open.getOrderId(), replacement(open, "1", "94"), user.getUserId()));
        assertEquals("ACCEPTED", orderRepository.findById(open.getOrderId()).orElseThrow().getStatus());
    }
    private app.order.execution.ExecutionQuoteSource.Quote quoteAt(OffsetDateTime at) {
        return new app.order.execution.ExecutionQuoteSource.Quote(new BigDecimal("100"), 1L, at);
    }
    private void quotesAt(OffsetDateTime first, OffsetDateTime... later) {
        org.mockito.Mockito.when(quoteSource.current(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any()))
                .thenReturn(quoteAt(first), java.util.Arrays.stream(later).map(this::quoteAt)
                        .toArray(app.order.execution.ExecutionQuoteSource.Quote[]::new));
    }
    private void assertEditRefused(Order open, OrderRequest request, int status) {
        var refusal = assertThrows(org.springframework.web.server.ResponseStatusException.class,
                () -> orderService.replace(open.getOrderId(), request, user.getUserId()));
        assertEquals(status, refusal.getStatusCode().value());
        assertEquals("ACCEPTED", orderRepository.findById(open.getOrderId()).orElseThrow().getStatus());
        assertEquals(1, orderRepository.count());
    }
    private OrderRequest limitRequest(Integer accountId, Integer instrumentId, String side, UUID reference, Long sessionId) {
        return new OrderRequest(accountId, instrumentId, side, BigDecimal.ONE, new BigDecimal("100"), null, reference, null,
                "LIMIT", new BigDecimal("94"), null, sessionId);
    }
    @Test void editCannotChangeTheAccountStockSideOrSession() {
        Order open = typed("BUY", "LIMIT", "95", null, "100", "1");
        Integer account = open.getAccountId();
        Integer stock = open.getInstrumentId();
        assertEditRefused(open, limitRequest(account + 1, stock, "BUY", UUID.randomUUID(), open.getSessionId()), 400);
        assertEditRefused(open, limitRequest(account, stock + 1, "BUY", UUID.randomUUID(), open.getSessionId()), 400);
        assertEditRefused(open, limitRequest(account, stock, "SELL", UUID.randomUUID(), open.getSessionId()), 400);
        assertEditRefused(open, limitRequest(account, stock, "BUY", UUID.randomUUID(), 99L), 400);
    }
    @Test void editCannotReuseAnotherOrdersClientReference() {
        Order open = typed("BUY", "LIMIT", "95", null, "100", "1");
        assertEditRefused(open, limitRequest(open.getAccountId(), open.getInstrumentId(), "BUY", open.getClientReference(),
                open.getSessionId()), 409);
    }
    @Test void editIsRefusedOutsideTheOrdersSimulationWindow() {
        Order open = typed("BUY", "LIMIT", "95", null, "100", "1");
        OrderRequest request = replacement(open, "1", "94");
        quotesAt(open.getReferenceAt().minusSeconds(1));
        assertEditRefused(open, request, 409);
        quotesAt(app.order.execution.ExecutionPolicy.expiresAt(open));
        assertEditRefused(open, request, 409);
    }
    @Test void editIsRefusedWhenTheSimulationMovesWhileTheReplacementIsAccepted() {
        Order open = typed("BUY", "LIMIT", "95", null, "100", "1");
        OrderRequest request = replacement(open, "1", "94");
        var start = open.getReferenceAt();
        quotesAt(start, start.minusSeconds(1));
        assertEditRefused(open, request, 409);
        quotesAt(start, app.order.execution.ExecutionPolicy.expiresAt(open));
        assertEditRefused(open, request, 409);
        open.setEvaluatedAt(null);
        orderRepository.saveAndFlush(open);
        quotesAt(start, start.minusSeconds(1));
        assertEditRefused(open, request, 409);
    }
    @Test void aRetryBackoffHoldsTheOrderUntilTheFinalSecondThenExpiresIt() {
        Order open = typed("BUY", "LIMIT", "95", null, "100", "1");
        open.setRetryAfter(OffsetDateTime.now().plusHours(1));
        orderRepository.saveAndFlush(open);
        assertEquals("ACCEPTED", tick(open, "90", 1).getStatus());
        assertEquals(0, fillRepository.count());
        var last = app.order.execution.ExecutionPolicy.expiresAt(open).minusSeconds(1);
        assertEquals("CANCELLED", execution.evaluate(open.getOrderId(), instrument, quoteAt(last)).getStatus());
    }
    @Test void anOrderWithoutAReferencePriceOrWatermarkIsEvaluatedSafely() {
        Order open = typed("BUY", "LIMIT", "95", null, "100", "1");
        open.setEvaluatedAt(null);
        orderRepository.saveAndFlush(open);
        assertEquals("FILLED", tick(open, "95", 1).getStatus());
        Order legacy = typed("BUY", "LIMIT", "95", null, "100", "1");
        legacy.setReferencePrice(null);
        orderRepository.saveAndFlush(legacy);
        assertEquals("ACCEPTED", tick(legacy, "90", 1).getStatus());
        assertEquals(1, fillRepository.count());
    }
    @Test void aLatchedStopWithoutATriggerPriceUsesTheSubmissionQuoteForItsBuffer() {
        Order open = typed("BUY", "STOP", null, "105", "100", "1");
        open.setTriggeredAt(open.getReferenceAt().plusSeconds(1));
        orderRepository.saveAndFlush(open);
        assertEquals("FILLED", tick(open, "101", 2).getStatus());
    }
    @Test void finalSeededTickCanFillButUnmetOrdersExpire() {
        Order eligible = typed("BUY", "LIMIT", "95", null, "100", "1");
        var last = app.order.execution.ExecutionPolicy.expiresAt(eligible).minusSeconds(1);
        assertEquals("FILLED", execution.evaluate(eligible.getOrderId(), instrument,
                new app.order.execution.ExecutionQuoteSource.Quote(new BigDecimal("95"), 1L, last)).getStatus());
        Order waiting = typed("BUY", "LIMIT", "90", null, "100", "1");
        assertEquals("CANCELLED", execution.evaluate(waiting.getOrderId(), instrument,
                new app.order.execution.ExecutionQuoteSource.Quote(new BigDecimal("95"), 1L, last)).getStatus());
    }
    @Test void stopGapUsesTriggerQuoteAndPreservesSubmissionAudit() {
        Order open = typed("BUY", "STOP", null, "105", "100", "10");
        assertEquals("ACCEPTED", open.getStatus());
        Order filled = tick(open, "106", 1);
        assertEquals("FILLED", filled.getStatus());
        assertEquals(0, new BigDecimal("106").compareTo(filled.getTriggerPrice()));
        assertEquals(0, new BigDecimal("100").compareTo(filled.getReferencePrice()));
        assertNotNull(filled.getTriggeredAt());
        assertEquals(0, filled.getReservedCash().signum());
        assertEquals(1, fillRepository.count());
    }
    @Test void stopRetryKeepsItsFirstTriggerReferenceAndRejectsFurtherAdverseMovement() {
        user.setExecutionBufferPercent(BigDecimal.ONE); userRepository.save(user);
        Order open = typed("BUY", "STOP", null, "105", "100", "1");
        open.setTriggeredAt(open.getReferenceAt().plusSeconds(1));
        open.setTriggerPrice(new BigDecimal("105"));
        orderRepository.saveAndFlush(open);
        Order rejected = tick(open, "106.050001", 2);
        assertEquals("REJECTED", rejected.getStatus());
        assertEquals("EXECUTION_BUFFER_EXCEEDED", rejected.getRejectionCode());
        assertEquals(0, new BigDecimal("105").compareTo(rejected.getTriggerPrice()));
        assertEquals(0, rejected.getReservedCash().signum());
    }
    @Test void stopRetryCanFillExactlyAtTriggerBasedBoundary() {
        user.setExecutionBufferPercent(BigDecimal.ONE); userRepository.save(user);
        Order open = typed("BUY", "STOP", null, "105", "100", "1");
        open.setTriggeredAt(open.getReferenceAt().plusSeconds(1));
        open.setTriggerPrice(new BigDecimal("105"));
        orderRepository.saveAndFlush(open);
        assertEquals("FILLED", tick(open, "106.05", 2).getStatus());
    }
    @Test void stopLimitLatchesAndCanFillAfterPriceRetreatsBelowTheStop() {
        Order open = typed("BUY", "STOP_LIMIT", "102", "105", "100", "10");
        Order triggered = tick(open, "106", 1);
        assertEquals("ACCEPTED", triggered.getStatus());
        assertNotNull(triggered.getTriggeredAt());
        Order filled = tick(open, "102", 2);
        assertEquals("FILLED", filled.getStatus());
        assertEquals(triggered.getTriggeredAt(), filled.getTriggeredAt());
    }
    @Test void cancellationIsIdempotentAndTerminalOrdersCannotExecute() {
        Order open = typed("BUY", "LIMIT", "95", null, "100", "10");
        assertEquals("CANCELLED", orderService.cancel(open.getOrderId(), user.getUserId()).getStatus());
        assertEquals("CANCELLED", orderService.cancel(open.getOrderId(), user.getUserId()).getStatus());
        assertEquals("CANCELLED", tick(open, "90", 1).getStatus());
        assertEquals(0, fillRepository.count());
        assertThrows(AccountNotFoundException.class, () -> orderService.cancel(open.getOrderId(), UUID.randomUUID()));
    }
    @Test void preferenceUpdatesOnlyAffectNewOrdersAndNeverClientIndicativePrices() {
        user.setExecutionBufferPercent(BigDecimal.ONE); userRepository.save(user);
        Order first = typed("BUY", "STOP", null, "105", "100", "1");
        user.setExecutionBufferPercent(new BigDecimal("10"));
        userRepository.save(user);
        Order second = typed("BUY", "STOP", null, "105", "100", "1");
        assertEquals(0, new BigDecimal("100").compareTo(first.getReferencePrice()));
        assertEquals(0, new BigDecimal("1").compareTo(first.getBufferPercent()));
        assertEquals(0, new BigDecimal("10").compareTo(second.getBufferPercent()));
        assertEquals("FILLED", tick(first, "106", 1).getStatus());
        assertEquals("FILLED", tick(second, "106", 1).getStatus());
    }
    @Test void reservationsPreventOverspendingAcrossAccounts() {
        user.setAvailableFunds(new BigDecimal("1000")); userRepository.save(user);
        Order first = typed("BUY", "LIMIT", "95", null, "100", "10");
        Account another = new Account(); another.setUserId(user.getUserId()); another.setOpenedDate(LocalDate.now());
        another = accountRepository.save(another);
        var request = new OrderRequest(another.getAccountId(), instrument.getInstrumentId(), "BUY", BigDecimal.ONE,
                new BigDecimal("100"), null, UUID.randomUUID(), null, "LIMIT", new BigDecimal("95"), null, 1L);
        Order second = orderService.submitOrder(request, user.getUserId());
        assertEquals("ACCEPTED", first.getStatus()); assertEquals("REJECTED", second.getStatus());
        orderService.cancel(first.getOrderId(), user.getUserId());
        assertEquals(0, orderRepository.findReservations(user.getUserId()).size());
    }
    @Test void mismatchedSessionsAndRewindsDoNotExecute() {
        Order open = typed("BUY", "LIMIT", "95", null, "100", "1");
        var foreign = new app.order.execution.ExecutionQuoteSource.Quote(new BigDecimal("90"), 2L, open.getReferenceAt().plusSeconds(1));
        assertEquals("ACCEPTED", execution.evaluate(open.getOrderId(), instrument, foreign).getStatus());
        assertEquals("ACCEPTED", tick(open, "90", -1).getStatus());
        assertEquals(0, fillRepository.count());
    }
    @Test void concurrentDuplicateSubmissionsReturnOneOrderAndOneFill() throws Exception {
        OrderRequest request = order("BUY", "1", "50");
        org.mockito.Mockito.when(quoteSource.current(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any()))
                .thenReturn(new app.order.execution.ExecutionQuoteSource.Quote(new BigDecimal("50"), 1L,
                        OffsetDateTime.parse("2026-01-05T15:00:00Z")));
        try (var workers = java.util.concurrent.Executors.newFixedThreadPool(2)) {
            var gate = new java.util.concurrent.CountDownLatch(1);
            java.util.concurrent.Callable<Order> task = () -> { gate.await(); return orderService.submitOrder(request, user.getUserId()); };
            var one = workers.submit(task); var two = workers.submit(task); gate.countDown();
            assertEquals(one.get(10, java.util.concurrent.TimeUnit.SECONDS).getOrderId(), two.get(10, java.util.concurrent.TimeUnit.SECONDS).getOrderId());
            assertEquals(1, orderRepository.count()); assertEquals(1, fillRepository.count());
        }
    }
    @Test void simultaneousFillAndCancelHaveExactlyOneTerminalOutcome() throws Exception {
        Order open = typed("BUY", "LIMIT", "95", null, "100", "1");
        try (var workers = java.util.concurrent.Executors.newFixedThreadPool(2)) {
            var gate = new java.util.concurrent.CountDownLatch(1);
            var fill = workers.submit(() -> { gate.await(); return tick(open, "95", 1); });
            var cancel = workers.submit(() -> { gate.await(); try { return orderService.cancel(open.getOrderId(), user.getUserId()); }
                catch (org.springframework.web.server.ResponseStatusException conflict) { assertEquals(409, conflict.getStatusCode().value()); return null; } });
            gate.countDown(); fill.get(10, java.util.concurrent.TimeUnit.SECONDS); cancel.get(10, java.util.concurrent.TimeUnit.SECONDS);
            Order terminal = orderRepository.findById(open.getOrderId()).orElseThrow();
            assertTrue(java.util.Set.of("FILLED", "CANCELLED").contains(terminal.getStatus()));
            assertEquals("FILLED".equals(terminal.getStatus()) ? 1 : 0, fillRepository.count());
            assertEquals(0, terminal.getReservedCash().signum());
        }
    }

    @Test void sellLimitAndStopsReserveSharesAndUseInclusiveBounds() {
        holdingRepository.save(holdingOf("10"));
        Order limit = typed("SELL", "LIMIT", "105", null, "100", "3");
        assertEquals("ACCEPTED", limit.getStatus());
        assertEquals(0, new BigDecimal("3").compareTo(limit.getReservedShares()));
        assertEquals("ACCEPTED", tick(limit, "104", 1).getStatus());
        assertEquals("FILLED", tick(limit, "105", 2).getStatus());
        Order stop = typed("SELL", "STOP", null, "95", "100", "2");
        assertEquals("FILLED", tick(stop, "95", 1).getStatus());
        Order gap = typed("SELL", "STOP", null, "95", "100", "2");
        assertEquals("FILLED", tick(gap, "94.999999", 1).getStatus());
        Order stopLimit = typed("SELL", "STOP_LIMIT", "96", "95", "100", "2");
        assertEquals("ACCEPTED", tick(stopLimit, "94", 1).getStatus());
        assertEquals("FILLED", tick(stopLimit, "96", 2).getStatus());
    }
    @Test void pendingSellReservationsPreventOversellingAndCancellationReleasesThem() {
        holdingRepository.save(holdingOf("5"));
        Order first = typed("SELL", "LIMIT", "110", null, "100", "4");
        Order second = typed("SELL", "LIMIT", "110", null, "100", "2");
        assertEquals("ACCEPTED", first.getStatus()); assertEquals("REJECTED", second.getStatus());
        orderService.cancel(first.getOrderId(), user.getUserId());
        assertEquals("ACCEPTED", typed("SELL", "LIMIT", "110", null, "100", "5").getStatus());
    }
    @Test void concurrentTickDeliveryCannotCreateDuplicateFills() throws Exception {
        Order open = typed("BUY", "LIMIT", "95", null, "100", "1");
        try (var workers = java.util.concurrent.Executors.newFixedThreadPool(2)) {
            var gate = new java.util.concurrent.CountDownLatch(1);
            java.util.concurrent.Callable<Order> task = () -> { gate.await(); return tick(open, "95", 1); };
            var one = workers.submit(task); var two = workers.submit(task); gate.countDown();
            assertEquals("FILLED", one.get(10, java.util.concurrent.TimeUnit.SECONDS).getStatus());
            assertEquals("FILLED", two.get(10, java.util.concurrent.TimeUnit.SECONDS).getStatus());
            assertEquals(1, fillRepository.count());
        }
    }

    @Test void removingCredentialsRejectsAnOpenOrderAndReleasesItsReservation() {
        Order open = typed("BUY", "LIMIT", "95", null, "100", "1");
        jdbcTemplate.update("DELETE FROM user_accounts WHERE user_id = ?", user.getUserId());
        Order rejected = tick(open, "95", 1);
        assertEquals("REJECTED", rejected.getStatus());
        assertEquals("Credential account does not exist", rejected.getRejectionReason());
        assertEquals(0, rejected.getReservedCash().signum());
        assertEquals(0, fillRepository.count());
    }
}
