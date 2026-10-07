package app.order.execution;

import app.account.Account;
import app.account.AccountRepository;
import app.holding.Holding;
import app.holding.HoldingRepository;
import app.instrument.Instrument;
import app.order.Order;
import app.order.OrderRepository;
import app.order.audit.AuditTrailService;
import app.user.User;
import app.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * Turns a PENDING order that passed the rule pipeline into a fill,
 * atomically, and moves it to {@code FILLED} (KAN-93). This class does not
 * itself decide whether a trade is allowed, it carries out one that already
 * was.
 *
 * <p>The fill uses one current quote from Holdings and Trade's replay clock,
 * obtained after resource locks. Adverse movement outside the order's buffer,
 * unavailable quotes, or insufficient resources reject without ledger writes.
 * Favorable movement is always permitted. Audit times remain real server time.
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

    private final ExecutionQuoteSource quotes;
    private final AccountRepository accountRepository;
    private final UserRepository userRepository;
    private final HoldingRepository holdingRepository;
    private final OrderRepository orderRepository;
    private final FillRepository fillRepository;
    private final CashTransactionRepository cashTransactionRepository;
    private final HoldingMovementRepository holdingMovementRepository;
    private final AuditTrailService auditTrailService;

    /**
     * Creates the service.
     *
     * @param quotes authoritative replay quote source
     * @param accountRepository account lookup
     * @param userRepository user lookup with row locking
     * @param holdingRepository holding lookup with row locking
     * @param orderRepository order persistence
     * @param fillRepository fill persistence
     * @param cashTransactionRepository cash ledger persistence
     * @param holdingMovementRepository position ledger persistence
     * @param auditTrailService lifecycle event recorder
     */
    public OrderExecutionService(AccountRepository accountRepository,
                                  UserRepository userRepository,
                                  HoldingRepository holdingRepository,
                                  OrderRepository orderRepository,
                                  FillRepository fillRepository,
                                  CashTransactionRepository cashTransactionRepository,
                                  HoldingMovementRepository holdingMovementRepository,
                                  AuditTrailService auditTrailService, ExecutionQuoteSource quotes) {
        this.quotes = quotes;
        this.accountRepository = accountRepository;
        this.userRepository = userRepository;
        this.holdingRepository = holdingRepository;
        this.orderRepository = orderRepository;
        this.fillRepository = fillRepository;
        this.cashTransactionRepository = cashTransactionRepository;
        this.holdingMovementRepository = holdingMovementRepository;
        this.auditTrailService = auditTrailService;
    }

    /**
     * Executes an order whose trading rules have passed.
     *
     * @throws org.springframework.web.server.ResponseStatusException if the account is archived
     * @param order      the {@code PENDING} order to execute
     * @param instrument the instrument being traded
     * @return the order as {@code FILLED}, or {@code REJECTED} when its buffer,
     *         quote availability, funds or holdings fail execution checks
     * @throws IllegalStateException if the account or its owning user no longer exists
     */
    @Transactional
    public Order execute(Order order, Instrument instrument) {
        boolean isBuy = Order.TYPE_BUY.equals(order.getOrderType());

        Account account = accountRepository.findByIdForUpdate(order.getAccountId())
                .orElseThrow(() -> new IllegalStateException(
                        "Account " + order.getAccountId() + " disappeared mid-execution"));
        if (account.getArchivedAt() != null)
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.CONFLICT, "This account is archived");
        User user = userRepository.findByIdForUpdate(account.getUserId())
                .orElseThrow(() -> new IllegalStateException(
                        "Account " + account.getAccountId() + " has no owning user"));

        Holding holding = holdingRepository
                .findByAccountIdAndInstrumentIdForUpdate(order.getAccountId(), order.getInstrumentId())
                .orElse(null);
        BigDecimal currentQuantity = holding == null ? BigDecimal.ZERO : holding.getQuantity();
        if (!ExecutionPolicy.validBuffer(order.getBufferPercent()))
            return reject(order, ExecutionPolicy.reason("INVALID_BUFFER"));
        ExecutionQuoteSource.Quote quote;
        try { quote = quotes.current(instrument, order.getSessionId()); }
        catch (ExecutionQuoteSource.QuoteUnavailableException ex) { return reject(order, ex.getMessage()); }
        BigDecimal fillPrice = quote.price();
        BigDecimal tradeValue = order.getQuantity().multiply(fillPrice);
        BigDecimal boundary = ExecutionPolicy.boundary(order.getOrderType(), order.getIndicativePrice(), order.getBufferPercent());
        String failure = ExecutionPolicy.failure(order.getOrderType(), order.getQuantity(), fillPrice,
                boundary, user.getAvailableFunds(), currentQuantity);
        if (failure != null) return reject(order, ExecutionPolicy.reason(failure));
        order.setSessionId(quote.sessionId());
        order.setExecutedSimulatedAt(quote.timestamp().atOffset(java.time.ZoneOffset.UTC));
        order.setExecutionPrice(fillPrice);

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
        return savedOrder;
    }

    private Order reject(Order order, String reason) {
        order.setStatus(Order.STATUS_REJECTED);
        order.setRejectionReason(reason);
        order.setResolvedAt(OffsetDateTime.now());
        final Order savedOrder = orderRepository.save(order);
        auditTrailService.record(savedOrder.getOrderId(), Order.STATUS_REJECTED, reason);
        return savedOrder;
    }
}


