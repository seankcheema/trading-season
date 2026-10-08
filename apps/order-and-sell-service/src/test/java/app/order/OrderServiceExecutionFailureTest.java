package app.order;

import app.account.Account;
import app.account.AccountRepository;
import app.instrument.Instrument;
import app.instrument.InstrumentRepository;
import app.order.audit.AuditTrail;
import app.order.audit.AuditTrailRepository;
import app.order.dto.OrderRequest;
import app.order.execution.FillRepository;
import app.order.execution.OrderExecutionService;
import app.support.UserAccountFixture;
import app.user.User;
import app.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * BR-06: an accepted order is a firm commitment that does not depend on
 * execution succeeding. Execution is replaced by a mock that fails like a
 * lost database connection would, and the accepted order must still be on
 * record afterwards with the failure in its audit trail.
 */
@SpringBootTest
@ActiveProfiles("test")
class OrderServiceExecutionFailureTest {

    @MockitoBean
    private OrderExecutionService orderExecutionService;

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
    private FillRepository fillRepository;
    @Autowired
    private AuditTrailRepository auditTrailRepository;
    @Autowired
    private JdbcTemplate jdbcTemplate;

    private User user;
    private Account account;
    private Instrument instrument;

    @BeforeEach
    void setUp() {
        auditTrailRepository.deleteAll();
        fillRepository.deleteAll();
        orderRepository.deleteAll();
        accountRepository.deleteAll();
        userRepository.deleteAll();
        instrumentRepository.deleteAll();
        UserAccountFixture.deleteAll(jdbcTemplate);

        UUID userId = UUID.randomUUID();
        UserAccountFixture.createActiveAccount(jdbcTemplate, userId, "trader@example.com");

        user = new User();
        user.setUserId(userId);
        user.setFirstName("Test");
        user.setLastName("User");
        user.setSsn("123-45-6789");
        user.setAddress("123 Test St");
        user.setDateOfBirth(LocalDate.of(1990, 1, 1));
        user.setExecutionBufferPercent(new BigDecimal("5.0"));
        user.setAvailableFunds(new BigDecimal("100000.00"));
        user.setCreatedAt(OffsetDateTime.now());
        user = userRepository.save(user);

        account = new Account();
        account.setUserId(user.getUserId());
        account.setOpenedDate(LocalDate.now());
        account.setCashBalance(BigDecimal.ZERO);
        account = accountRepository.save(account);

        instrument = new Instrument();
        instrument.setTicker("TEST");
        instrument.setName("Test Instrument");
        instrument.setAssetClass("EQUITY");
        instrument.setCurrency("USD");
        instrument.setTradable(true);
        instrument = instrumentRepository.save(instrument);

        when(orderExecutionService.execute(any(), any()))
                .thenThrow(new DataAccessResourceFailureException("connection to the database was lost"));
    }

    private List<String> auditEventsFor(Order order) {
        return auditTrailRepository.findAll().stream()
                .filter(event -> event.getOrderId().equals(order.getOrderId()))
                .sorted(Comparator.comparing(AuditTrail::getAuditId))
                .map(AuditTrail::getEventType)
                .toList();
    }

    @Test
    void anExecutionFailureLeavesTheAcceptedOrderOnRecord() {
        UUID clientReference = UUID.randomUUID();
        OrderRequest request = new OrderRequest(account.getAccountId(), instrument.getInstrumentId(), "BUY",
                new BigDecimal("100"), new BigDecimal("50.00"), new BigDecimal("2.0"), clientReference, null);

        Order order = orderService.submitOrder(request, user.getUserId());

        assertEquals(Order.STATUS_ACCEPTED, order.getStatus());
        assertNotNull(order.getAcceptedAt());
        assertNull(order.getResolvedAt());

        Order stored = orderRepository.findById(order.getOrderId()).orElseThrow();
        assertEquals(Order.STATUS_ACCEPTED, stored.getStatus(), "the record of intent survived the failure");
        assertEquals(List.of(Order.STATUS_PENDING, Order.STATUS_ACCEPTED, OrderService.AUDIT_EXECUTION_FAILED),
                auditEventsFor(order));
        assertEquals(0, fillRepository.count());
        assertEquals(0, new BigDecimal("100000.00").compareTo(
                userRepository.findById(user.getUserId()).orElseThrow().getAvailableFunds()));

        // Resubmitting the same client reference returns the accepted order and does not execute again.
        Order again = orderService.submitOrder(request, user.getUserId());
        assertEquals(order.getOrderId(), again.getOrderId());
        assertEquals(Order.STATUS_ACCEPTED, again.getStatus());
        verify(orderExecutionService, times(1)).execute(any(), any());
    }
}
