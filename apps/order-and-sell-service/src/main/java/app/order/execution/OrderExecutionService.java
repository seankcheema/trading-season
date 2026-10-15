package app.order.execution;

import app.account.Account;
import app.account.AccountRepository;
import app.holding.Holding;
import app.holding.HoldingRepository;
import app.instrument.Instrument;
import app.order.Order;
import app.order.OrderRepository;
import app.order.audit.AuditTrailService;
import app.order.event.OrderStatusEvent;
import app.user.User;
import app.user.UserRepository;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * Turns an {@code ACCEPTED} order into a fill, atomically, and moves it to
 * {@code FILLED} (KAN-93). This class does not itself decide whether a trade
 * is allowed, it carries out one that already was.
 *
 * <p>It runs in its own transaction, separate from the one that committed
 * the order as accepted (BR-06). The fill, the cash movement, the holding
 * movement, the updated holding and the audit row are written together or
 * not at all (BR-09); an unexpected failure rolls back only this execution
 * and leaves the accepted order on record. The committed outcome is raised
 * as an {@link OrderStatusEvent} and published to Kafka after this
 * transaction commits; a fill's event carries the fill, both ledger postings
 * and the balances they left, because the reporting service reads none of
 * those tables.
 *
 * <p>Prices come from the authoritative Holdings and Trade replay cursor. Limits
 * remain open until eligible; stops latch once triggered. Market executions
 * enforce the immutable submission quote and saved buffer before any ledger write.
 * Cancellation and competing evaluations serialize under owner and order locks.
 *
 * <p><b>Funds:</b> cash belongs to the user, not to an account, so a BUY
 * debits and a SELL credits the owning user's {@code availableFunds}
 * (KAN-93). {@code accounts.cash_balance} is not moved. A
 * {@code cash_transactions} row is still written for every fill so the
 * movement is on the ledger.
 *
 * <p>Funds and holdings were already checked once by the pipeline, against
 * a snapshot that can go stale between validation and execution. This class
 * re-checks both under a row lock immediately before writing the fill, so
 * two concurrent orders can't both spend the same balance or the same
 * holding. An order that fails that re-check is {@code REJECTED}.
 */
@Service
public class OrderExecutionService {

    @org.springframework.beans.factory.annotation.Autowired
    private ExecutionQuoteSource quotes;
    @org.springframework.beans.factory.annotation.Autowired
    private app.user.UserAccountRepository credentials;
    @jakarta.persistence.PersistenceContext
    private jakarta.persistence.EntityManager entityManager;
    private final AccountRepository accountRepository;
    private final UserRepository userRepository;
    private final HoldingRepository holdingRepository;
    private final OrderRepository orderRepository;
    private final FillRepository fillRepository;
    private final CashTransactionRepository cashTransactionRepository;
    private final HoldingMovementRepository holdingMovementRepository;
    private final AuditTrailService auditTrailService;
    private final ApplicationEventPublisher events;

    /**
     * Creates the service.
     *
     * @param accountRepository account lookup
     * @param userRepository user lookup with row locking
     * @param holdingRepository holding lookup with row locking
     * @param orderRepository order persistence
     * @param fillRepository fill persistence
     * @param cashTransactionRepository cash ledger persistence
     * @param holdingMovementRepository position ledger persistence
     * @param auditTrailService lifecycle event recorder
     * @param events publisher of the {@link app.order.event.OrderStatusEvent} raised when execution commits
     */
    public OrderExecutionService(AccountRepository accountRepository,
                                  UserRepository userRepository,
                                  HoldingRepository holdingRepository,
                                  OrderRepository orderRepository,
                                  FillRepository fillRepository,
                                  CashTransactionRepository cashTransactionRepository,
                                  HoldingMovementRepository holdingMovementRepository,
                                  AuditTrailService auditTrailService,
                                  ApplicationEventPublisher events) {
        this.accountRepository = accountRepository;
        this.userRepository = userRepository;
        this.holdingRepository = holdingRepository;
        this.orderRepository = orderRepository;
        this.fillRepository = fillRepository;
        this.cashTransactionRepository = cashTransactionRepository;
        this.holdingMovementRepository = holdingMovementRepository;
        this.auditTrailService = auditTrailService;
        this.events = events;
    }

    /**
     * Executes an accepted order in a new transaction.
     *
     * @param order      the {@code ACCEPTED} order to execute
     * @param instrument the instrument being traded
     * @return the current order, including ACCEPTED when conditions are unmet,
     *         FILLED after atomic settlement, or REJECTED when protection or
     *         resources fail; legacy orders without server context are unchanged
     * @throws ExecutionQuoteSource.QuoteUnavailableException if the current market quote is unavailable
     * @throws IllegalStateException if the account or its owning user no longer exists
     * @throws org.springframework.dao.DataAccessException if a ledger write fails; this
     *         transaction rolls back and the order stays {@code ACCEPTED}
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Order execute(Order order, Instrument instrument) {
        if (order.getReferencePrice() == null) return order;
        var quote = "MARKET".equals(order.getExecutionType()) ? quotes.current(instrument, order.getSessionId())
                : new ExecutionQuoteSource.Quote(order.getReferencePrice(), order.getSessionId(), order.getReferenceAt());
        return evaluate(order.getOrderId(), instrument, quote);
    }

    /** Evaluates one ordered market tick in an independent settlement transaction.
     * @param orderId persisted order
     * @param instrument traded instrument
     * @param quote authoritative tick in the order's fixed session
     * @return current, filled or rejected order
     * @throws org.springframework.dao.DataAccessException if settlement rolls back */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Order evaluate(Integer orderId, Instrument instrument, ExecutionQuoteSource.Quote quote) {
        Order visible = orderRepository.findById(orderId).orElseThrow();
        Account ownerAccount = accountRepository.findById(visible.getAccountId())
                .orElseThrow(() -> new IllegalStateException("Account " + visible.getAccountId() + " disappeared mid-execution"));
        User user = userRepository.findByIdForUpdate(ownerAccount.getUserId())
                .orElseThrow(() -> new IllegalStateException("Account " + ownerAccount.getAccountId() + " has no owning user"));
        Account account = accountRepository.findByIdForUpdate(visible.getAccountId()).orElseThrow();
        Order order = orderRepository.findByIdForUpdate(orderId).orElseThrow();
        entityManager.refresh(order);
        if (!Order.STATUS_ACCEPTED.equals(order.getStatus()) || order.getReferencePrice() == null
                || !order.getSessionId().equals(quote.sessionId())
                || quote.timestamp().isBefore(order.getReferenceAt())
                || (order.getEvaluatedAt() != null && quote.timestamp().isBefore(order.getEvaluatedAt()))) return order;
        if (order.getRetryAfter() != null && OffsetDateTime.now().isBefore(order.getRetryAfter())) return order;
        if (credentials.findById(user.getUserId()).isEmpty()) return reject(order, instrument, "Credential account does not exist");
        boolean isBuy = Order.TYPE_BUY.equals(order.getOrderType());
        BigDecimal fillPrice = quote.price();
        BigDecimal tradeValue = order.getQuantity().multiply(fillPrice).setScale(2, java.math.RoundingMode.HALF_UP);
        order.setEvaluatedAt(quote.timestamp());
        boolean stop = "STOP".equals(order.getExecutionType()) || "STOP_LIMIT".equals(order.getExecutionType());
        boolean newlyTriggered = false;
        if (stop && order.getTriggeredAt() == null) {
            if (!ExecutionPolicy.triggers(order.getOrderType(), fillPrice, order.getStopPrice())) return orderRepository.save(order);
            order.setTriggeredAt(quote.timestamp());
            auditTrailService.record(orderId, "TRIGGERED", "Stop triggered at " + fillPrice);
            newlyTriggered = true;
        }
        if (order.getLimitPrice() != null) {
            if (!ExecutionPolicy.within(order.getOrderType(), fillPrice, order.getLimitPrice())) {
                orderRepository.save(order);
                if (newlyTriggered) events.publishEvent(OrderStatusEvent.from(order, instrument));
                return order;
            }
        } else if (!ExecutionPolicy.within(order.getOrderType(), fillPrice,
                ExecutionPolicy.boundary(order.getOrderType(), order.getReferencePrice(), order.getBufferPercent()))) {
            order.setRejectionCode("EXECUTION_BUFFER_EXCEEDED");
            return reject(order, instrument, "Execution buffer exceeded: market price " + fillPrice
                    + " is outside your " + order.getBufferPercent() + "% protection");
        }

        BigDecimal otherCash = orderRepository.findReservations(user.getUserId()).stream()
                .filter(o -> !o.getOrderId().equals(orderId)).map(Order::getReservedCash)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        if (isBuy && tradeValue.compareTo(user.getAvailableFunds().subtract(otherCash)) > 0) {
            return reject(order, instrument, "BR-09: insufficient funds at execution time");
        }

        Holding holding = holdingRepository
                .findByAccountIdAndInstrumentIdForUpdate(order.getAccountId(), order.getInstrumentId())
                .orElse(null);
        BigDecimal currentQuantity = holding == null ? BigDecimal.ZERO : holding.getQuantity();
        BigDecimal otherShares = orderRepository.findReservations(user.getUserId()).stream()
                .filter(o -> !o.getOrderId().equals(orderId) && o.getAccountId().equals(order.getAccountId())
                        && o.getInstrumentId().equals(order.getInstrumentId()))
                .map(Order::getReservedShares).reduce(BigDecimal.ZERO, BigDecimal::add);
        if (!isBuy && order.getQuantity().compareTo(currentQuantity.subtract(otherShares)) > 0) {
            return reject(order, instrument, "Insufficient holdings at execution time");
        }

        OffsetDateTime now = OffsetDateTime.now();

        Fill fill = new Fill();
        fill.setOrderId(order.getOrderId());
        fill.setQuotePrice(fillPrice);
        fill.setQuantity(order.getQuantity());
        fill.setFilledAt(now);
        fill = fillRepository.save(fill);

        BigDecimal cashDelta = isBuy ? tradeValue.negate() : tradeValue;
        CashTransaction cashTransaction = new CashTransaction();
        cashTransaction.setAccountId(account.getAccountId());
        cashTransaction.setFillId(fill.getFillId());
        cashTransaction.setAmount(cashDelta);
        cashTransaction.setReason(CashTransaction.REASON_ORDER_FILL);
        cashTransaction.setCreatedAt(now);
        cashTransactionRepository.save(cashTransaction);
        user.setAvailableFunds(user.getAvailableFunds().add(cashDelta));
        userRepository.save(user);

        BigDecimal quantityDelta = isBuy ? order.getQuantity() : order.getQuantity().negate();
        HoldingMovement movement = new HoldingMovement();
        movement.setAccountId(account.getAccountId());
        movement.setInstrumentId(order.getInstrumentId());
        movement.setFillId(fill.getFillId());
        movement.setQuantityDelta(quantityDelta);
        movement.setCreatedAt(now);
        holdingMovementRepository.save(movement);

        if (holding == null) {
            holding = new Holding();
            holding.setAccountId(order.getAccountId());
            holding.setInstrumentId(order.getInstrumentId());
            holding.setQuantity(quantityDelta);
        } else {
            holding.setQuantity(holding.getQuantity().add(quantityDelta));
        }
        holding.setUpdatedAt(now);
        holdingRepository.save(holding);

        order.setExecutionPrice(fillPrice);
        order.setRetryAfter(null);
        order.setReservedCash(BigDecimal.ZERO);
        order.setReservedShares(BigDecimal.ZERO);
        order.setStatus(Order.STATUS_FILLED);
        order.setResolvedAt(now);
        final Order savedOrder = orderRepository.save(order);
        auditTrailService.record(savedOrder.getOrderId(), Order.STATUS_FILLED,
                "Filled " + savedOrder.getQuantity() + " @ " + fillPrice);
        events.publishEvent(OrderStatusEvent.from(savedOrder, instrument, new OrderStatusEvent.Execution(
                user.getUserId(), fill.getFillId(), fillPrice, savedOrder.getQuantity(), now,
                cashTransaction.getCashTransactionId(), cashDelta, user.getAvailableFunds(),
                movement.getHoldingMovementId(), quantityDelta, holding.getQuantity())));
        return savedOrder;
    }

    private Order reject(Order order, Instrument instrument, String reason) {
        order.setReservedCash(BigDecimal.ZERO);
        order.setReservedShares(BigDecimal.ZERO);
        if (order.getRejectionCode() == null) order.setRejectionCode("TRADING_RULE_FAILED");
        order.setStatus(Order.STATUS_REJECTED);
        order.setRejectionReason(reason);
        order.setResolvedAt(OffsetDateTime.now());
        final Order savedOrder = orderRepository.save(order);
        auditTrailService.record(savedOrder.getOrderId(), Order.STATUS_REJECTED, reason);
        events.publishEvent(OrderStatusEvent.from(savedOrder, instrument));
        return savedOrder;
    }
}


