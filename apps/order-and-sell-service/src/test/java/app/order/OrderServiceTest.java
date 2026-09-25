package app.order;

import app.account.Account;
import app.account.AccountNotFoundException;
import app.account.AccountRepository;
import app.instrument.Instrument;
import app.instrument.InstrumentNotFoundException;
import app.instrument.InstrumentRepository;
import app.order.dto.OrderRequest;
import app.user.User;
import app.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
class OrderServiceTest {

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

    private Account account;
    private User user;
    private Instrument instrument;

    @BeforeEach
    void setUp() {
        orderRepository.deleteAll();
        accountRepository.deleteAll();
        userRepository.deleteAll();
        instrumentRepository.deleteAll();

        // Create test user
        user = new User();
        user.setUserId(UUID.randomUUID());
        user.setFirstName("Test");
        user.setLastName("User");
        user.setEmail("test@example.com");
        user.setSsn("123-45-6789");
        user.setAddress("123 Test St");
        user.setDateOfBirth(LocalDate.of(1990, 1, 1));
        user.setExecutionBufferPercent(new BigDecimal("5.0"));
        user.setCreatedAt(OffsetDateTime.now());
        user = userRepository.save(user);

        // Create test account
        account = new Account();
        account.setUserId(user.getUserId());
        account.setOpenedDate(LocalDate.now());
        account.setCashBalance(new BigDecimal("100000.00"));
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
