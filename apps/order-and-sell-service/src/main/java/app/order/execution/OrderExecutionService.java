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
 * transaction commits.
 *
 * <p><b>Simplification:</b> this fills at the order's client-submitted
 * {@code indicativePrice} rather than a live market quote — business-backend
 * doesn't yet read the {@code quotes}/{@code market_ticks} tables FMS
 * writes. BR-08 calls for the quote price prevailing at execution time, and
 * KAN-100's buffer_percent tolerance only means something once there's a
 * live price to compare the indicative price against. Wiring that up is
 * follow-on work (plausibly KAN-129) — {@code fillPrice} below is the one
 * line to change once a quote source exists; everything downstream of it
 * (ledger writes, balance/holding updates) doesn't need to change.
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
     * @return the order as {@code FILLED}, or {@code REJECTED} if funds or
     *         holdings were no longer sufficient under the row lock
     * @throws IllegalStateException if the account or its owning user no longer exists
     * @throws org.springframework.dao.DataAccessException if a ledger write fails; this
     *         transaction rolls back and the order stays {@code ACCEPTED}
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Order execute(Order order, Instrument instrument) {
        boolean isBuy = Order.TYPE_BUY.equals(order.getOrderType());
        BigDecimal fillPrice = order.getIndicativePrice();
        BigDecimal tradeValue = order.getQuantity().multiply(fillPrice);

        Account account = accountRepository.findById(order.getAccountId())
                .orElseThrow(() -> new IllegalStateException(
                        "Account " + order.getAccountId() + " disappeared mid-execution"));
        User user = userRepository.findByIdForUpdate(account.getUserId())
                .orElseThrow(() -> new IllegalStateException(
                        "Account " + account.getAccountId() + " has no owning user"));

        if (isBuy && tradeValue.compareTo(user.getAvailableFunds()) > 0) {
            return reject(order, instrument, "BR-09: insufficient funds at execution time");
        }

        Holding holding = holdingRepository
                .findByAccountIdAndInstrumentIdForUpdate(order.getAccountId(), order.getInstrumentId())
                .orElse(null);
        BigDecimal currentQuantity = holding == null ? BigDecimal.ZERO : holding.getQuantity();
        if (!isBuy && order.getQuantity().compareTo(currentQuantity) > 0) {
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

        order.setStatus(Order.STATUS_FILLED);
        order.setResolvedAt(now);
        final Order savedOrder = orderRepository.save(order);
        auditTrailService.record(savedOrder.getOrderId(), Order.STATUS_FILLED,
                "Filled " + savedOrder.getQuantity() + " @ " + fillPrice);
        events.publishEvent(OrderStatusEvent.from(savedOrder, instrument));
        return savedOrder;
    }

    private Order reject(Order order, Instrument instrument, String reason) {
        order.setStatus(Order.STATUS_REJECTED);
        order.setRejectionReason(reason);
        order.setResolvedAt(OffsetDateTime.now());
        final Order savedOrder = orderRepository.save(order);
        auditTrailService.record(savedOrder.getOrderId(), Order.STATUS_REJECTED, reason);
        events.publishEvent(OrderStatusEvent.from(savedOrder, instrument));
        return savedOrder;
    }
}


