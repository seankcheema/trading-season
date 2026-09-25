package app.order.execution;

import app.account.Account;
import app.account.AccountRepository;
import app.holding.Holding;
import app.holding.HoldingRepository;
import app.instrument.Instrument;
import app.order.Order;
import app.order.OrderRepository;
import app.order.audit.AuditTrailService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Covers the execution-time re-checks and the ledger rows a fill writes. Validation has already
 * passed by the time this service runs, so every rejection here is a stale-snapshot race.
 */
class OrderExecutionServiceTest {
    private static final int ACCOUNT_ID = 1;
    private static final int INSTRUMENT_ID = 2;
    private static final int FILL_ID = 77;

    private final AccountRepository accountRepository = mock(AccountRepository.class);
    private final HoldingRepository holdingRepository = mock(HoldingRepository.class);
    private final OrderRepository orderRepository = mock(OrderRepository.class);
    private final FillRepository fillRepository = mock(FillRepository.class);
    private final CashTransactionRepository cashTransactionRepository = mock(CashTransactionRepository.class);
    private final HoldingMovementRepository holdingMovementRepository = mock(HoldingMovementRepository.class);
    private final AuditTrailService auditTrailService = mock(AuditTrailService.class);

    private OrderExecutionService service;
    private Account account;

    @BeforeEach
    void setUp() {
        service = new OrderExecutionService(accountRepository, holdingRepository, orderRepository, fillRepository,
                cashTransactionRepository, holdingMovementRepository, auditTrailService);
        account = new Account();
        account.setId(ACCOUNT_ID);
        account.setCashBalance(new BigDecimal("1000.00"));
        when(accountRepository.findByIdForUpdate(ACCOUNT_ID)).thenReturn(Optional.of(account));
        when(holdingRepository.findByAccountIdAndInstrumentIdForUpdate(ACCOUNT_ID, INSTRUMENT_ID))
                .thenReturn(Optional.empty());
        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(fillRepository.save(any(Fill.class))).thenAnswer(invocation -> {
            Fill fill = invocation.getArgument(0);
            fill.setFillId(FILL_ID);
            return fill;
        });
    }

    @Test
    void buyFillsAtTheIndicativePriceAndOpensAHolding() {
        Order order = order(Order.TYPE_BUY, "10", "25.00");

        Order result = service.execute(order, new Instrument());

        assertEquals(Order.STATUS_FILLED, result.getStatus());
        assertNotNull(result.getResolvedAt());

        Fill fill = savedFill();
        assertEquals(FILL_ID, fill.getFillId());
        assertEquals(order.getOrderId(), fill.getOrderId());
        assertEquals(new BigDecimal("25.00"), fill.getQuotePrice());
        assertEquals(new BigDecimal("10"), fill.getQuantity());
        assertNotNull(fill.getFilledAt());

        CashTransaction cash = savedCashTransaction();
        assertEquals(ACCOUNT_ID, cash.getAccountId());
        assertEquals(FILL_ID, cash.getFillId());
        assertEquals(new BigDecimal("-250.00"), cash.getAmount());
        assertEquals(CashTransaction.REASON_ORDER_FILL, cash.getReason());
        assertEquals(fill.getFilledAt(), cash.getCreatedAt());
        assertEquals(new BigDecimal("750.00"), account.getCashBalance());

        HoldingMovement movement = savedMovement();
        assertEquals(ACCOUNT_ID, movement.getAccountId());
        assertEquals(INSTRUMENT_ID, movement.getInstrumentId());
        assertEquals(FILL_ID, movement.getFillId());
        assertEquals(new BigDecimal("10"), movement.getQuantityDelta());
        assertEquals(fill.getFilledAt(), movement.getCreatedAt());

        Holding holding = savedHolding();
        assertEquals(ACCOUNT_ID, holding.getAccountId());
        assertEquals(INSTRUMENT_ID, holding.getInstrumentId());
        assertEquals(new BigDecimal("10"), holding.getQuantity());

        verify(auditTrailService).record(order.getOrderId(), Order.STATUS_FILLED, "Filled 10 @ 25.00");
    }

    @Test
    void sellCreditsCashAndReducesTheExistingHolding() {
        Holding existing = new Holding();
        existing.setAccountId(ACCOUNT_ID);
        existing.setInstrumentId(INSTRUMENT_ID);
        existing.setQuantity(new BigDecimal("8"));
        when(holdingRepository.findByAccountIdAndInstrumentIdForUpdate(ACCOUNT_ID, INSTRUMENT_ID))
                .thenReturn(Optional.of(existing));

        Order result = service.execute(order(Order.TYPE_SELL, "3", "40.00"), new Instrument());

        assertEquals(Order.STATUS_FILLED, result.getStatus());
        assertEquals(new BigDecimal("120.00"), savedCashTransaction().getAmount());
        assertEquals(new BigDecimal("1120.00"), account.getCashBalance());
        assertEquals(new BigDecimal("-3"), savedMovement().getQuantityDelta());
        assertEquals(new BigDecimal("5"), existing.getQuantity());
        assertNotNull(existing.getUpdatedAt());
        verify(holdingRepository).save(existing);
    }

    @Test
    void buyFailsWhenCashNoLongerCoversTheTrade() {
        Order result = service.execute(order(Order.TYPE_BUY, "41", "25.00"), new Instrument());

        assertFailed(result, "BR-09: insufficient funds at execution time");
        assertEquals(new BigDecimal("1000.00"), account.getCashBalance());
    }

    @Test
    void sellFailsWhenNoHoldingRemains() {
        Order result = service.execute(order(Order.TYPE_SELL, "1", "25.00"), new Instrument());

        assertFailed(result, "Insufficient holdings at execution time");
    }

    @Test
    void sellFailsWhenTheHoldingIsSmallerThanTheOrder() {
        Holding existing = new Holding();
        existing.setQuantity(new BigDecimal("2"));
        when(holdingRepository.findByAccountIdAndInstrumentIdForUpdate(ACCOUNT_ID, INSTRUMENT_ID))
                .thenReturn(Optional.of(existing));

        Order result = service.execute(order(Order.TYPE_SELL, "3", "25.00"), new Instrument());

        assertFailed(result, "Insufficient holdings at execution time");
        assertEquals(new BigDecimal("2"), existing.getQuantity());
    }

    @Test
    void executionStopsIfTheAccountDisappears() {
        when(accountRepository.findByIdForUpdate(ACCOUNT_ID)).thenReturn(Optional.empty());

        var error = assertThrows(IllegalStateException.class,
                () -> service.execute(order(Order.TYPE_BUY, "1", "1.00"), new Instrument()));

        assertEquals("Account 1 disappeared mid-execution", error.getMessage());
        verify(orderRepository, never()).save(any());
    }

    private void assertFailed(Order result, String reason) {
        assertEquals(Order.STATUS_EXECUTION_FAILED, result.getStatus());
        assertEquals(reason, result.getRejectionReason());
        assertNotNull(result.getResolvedAt());
        verify(fillRepository, never()).save(any());
        verify(cashTransactionRepository, never()).save(any());
        verify(auditTrailService).record(result.getOrderId(), Order.STATUS_EXECUTION_FAILED, reason);
    }

    private static Order order(String type, String quantity, String price) {
        Order order = new Order();
        order.setOrderId(500);
        order.setAccountId(ACCOUNT_ID);
        order.setInstrumentId(INSTRUMENT_ID);
        order.setOrderType(type);
        order.setQuantity(new BigDecimal(quantity));
        order.setIndicativePrice(new BigDecimal(price));
        order.setStatus(Order.STATUS_ACCEPTED);
        return order;
    }

    private Fill savedFill() {
        ArgumentCaptor<Fill> captor = ArgumentCaptor.forClass(Fill.class);
        verify(fillRepository).save(captor.capture());
        return captor.getValue();
    }

    private CashTransaction savedCashTransaction() {
        ArgumentCaptor<CashTransaction> captor = ArgumentCaptor.forClass(CashTransaction.class);
        verify(cashTransactionRepository).save(captor.capture());
        return captor.getValue();
    }

    private HoldingMovement savedMovement() {
        ArgumentCaptor<HoldingMovement> captor = ArgumentCaptor.forClass(HoldingMovement.class);
        verify(holdingMovementRepository).save(captor.capture());
        return captor.getValue();
    }

    private Holding savedHolding() {
        ArgumentCaptor<Holding> captor = ArgumentCaptor.forClass(Holding.class);
        verify(holdingRepository).save(captor.capture());
        return captor.getValue();
    }
}
