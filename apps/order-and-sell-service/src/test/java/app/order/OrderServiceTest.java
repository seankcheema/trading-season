package app.order;

import app.account.Account;
import app.account.AccountNotFoundException;
import app.account.AccountRepository;
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

        // The auth service creates the account before it issues a token, and
        // AccountStatusValidator reads that row on every order.
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
        Order order = orderService.submitOrder(order("BUY", "100", "50.00"));

        assertEquals(Order.STATUS_FILLED, order.getStatus());
        assertNull(order.getRejectionReason());
        assertNotNull(order.getAcceptedAt());
        assertNotNull(order.getResolvedAt());
        assertEquals(List.of(Order.STATUS_PENDING, Order.STATUS_FILLED), auditEventsFor(order));
    }

    @Test
    void buyOrderDecreasesUsersAvailableFunds() {
        orderService.submitOrder(order("BUY", "100", "50.00"));

        assertEquals(0, new BigDecimal("95000.00").compareTo(availableFunds()));
        assertEquals(1, fillRepository.count());
        assertEquals(1, cashTransactionRepository.count());
        // The account's own cash balance is not the funds source and is left alone
        assertEquals(0, BigDecimal.ZERO.compareTo(
                accountRepository.findById(account.getAccountId()).orElseThrow().getCashBalance()));
    }

    @Test
    void buyOrderAddsToHoldings() {
        orderService.submitOrder(order("BUY", "100", "50.00"));

        Holding holding = holdingRepository
                .findByAccountIdAndInstrumentId(account.getAccountId(), instrument.getInstrumentId())
                .orElseThrow();
        assertEquals(0, new BigDecimal("100").compareTo(holding.getQuantity()));
    }

    @Test
    void buyOrderWithInsufficientFundsIsRejected() {
        user.setAvailableFunds(new BigDecimal("1000.00"));
        userRepository.save(user);

        Order order = orderService.submitOrder(order("BUY", "100", "50.00"));

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

        Order order = orderService.submitOrder(order("BUY", "100", "50.00"));

        assertEquals(Order.STATUS_FILLED, order.getStatus());
        assertEquals(0, BigDecimal.ZERO.compareTo(availableFunds()));
    }

    @Test
    void sellOrderAddsFundsBackToUser() {
        holdingOf("50");

        Order order = orderService.submitOrder(order("SELL", "50", "100.00"));

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

        Order order = orderService.submitOrder(order("SELL", "50", "100.00"));

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

        Order order = orderService.submitOrder(request);

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

        Order order = orderService.submitOrder(request);

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

        Order firstOrder = orderService.submitOrder(request1);
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

        Order secondOrder = orderService.submitOrder(request2);
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

        assertThrows(AccountNotFoundException.class, () -> orderService.submitOrder(request));
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

        assertThrows(InstrumentNotFoundException.class, () -> orderService.submitOrder(request));
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

        Order order = orderService.submitOrder(request);

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
        Order order = orderService.submitOrder(request);
        OffsetDateTime afterSubmit = OffsetDateTime.now();

        assertNotNull(order.getSubmittedAt());
        assertFalse(order.getSubmittedAt().isBefore(beforeSubmit));
        assertFalse(order.getSubmittedAt().isAfter(afterSubmit));
    }
}
