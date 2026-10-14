package app.order;
import app.order.dto.OrderCheckResponse;
import app.order.dto.OrderCheckRequest;
import app.order.execution.Fill;
import app.order.execution.FillRepository;
import app.holding.Holding;
import app.holding.HoldingRepository;
import app.order.execution.ExecutionPolicy;
import app.order.execution.ExecutionQuoteSource;
import app.account.Account;
import app.account.AccountNotFoundException;
import app.account.AccountRepository;
import app.auth.ForbiddenException;
import app.instrument.Instrument;
import app.instrument.InstrumentNotFoundException;
import app.instrument.InstrumentRepository;
import app.order.audit.AuditTrailService;
import app.order.dto.OrderRequest;
import app.order.event.OrderStatusEvent;
import app.order.execution.OrderExecutionService;
import app.order.validation.OrderValidationPipeline;
import app.order.validation.ValidationResult;
import app.user.TermsAcceptance;
import app.user.TermsAcceptanceId;
import app.user.TermsAcceptanceRepository;
import app.user.User;
import app.user.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Orchestrates one order submission in two transactions (BR-06).
 *
 * <p>The first, {@link #accept}, does the idempotency and ownership checks,
 * persists the order as {@code PENDING}, runs the trading-rule pipeline, and
 * commits the order as {@code REJECTED} or {@code ACCEPTED}. An accepted order
 * is the firm's record of intent; once committed, nothing downstream can
 * erase it.
 *
 * <p>The second is {@link OrderExecutionService#execute}, which runs in its
 * own transaction and moves the order to {@code FILLED}, or {@code REJECTED}
 * under the row lock. If execution throws unexpectedly, the failure is
 * written to the audit trail in a short third transaction and the order is
 * returned, and remains, {@code ACCEPTED}.
 *
 * <p>Each transaction raises an {@link OrderStatusEvent} for the status it
 * committed, published to Kafka after that commit by
 * {@link app.order.event.TradeEventPublisher}. A resubmission that returns an
 * existing order raises nothing.
 */
@Service
public class OrderService {

    private final ExecutionQuoteSource quotes;
    private final HoldingRepository holdingRepository;
    private final FillRepository fillRepository;
    /** Audit event type written when execution throws and the order stays {@code ACCEPTED}. */
    public static final String AUDIT_EXECUTION_FAILED = "EXECUTION_FAILED";

    /**
     * Longest failure description written to the audit trail. PostgreSQL's
     * {@code detail} column is unbounded text, but a driver exception can run
     * to kilobytes of SQL, and the audit row must never itself fail to write.
     */
    static final int MAX_FAILURE_DETAIL_LENGTH = 255;

    private static final Logger log = LoggerFactory.getLogger(OrderService.class);
    private final OrderRepository orderRepository;
    private final AccountRepository accountRepository;
    private final InstrumentRepository instrumentRepository;
    private final UserRepository userRepository;
    private final TermsAcceptanceRepository termsAcceptanceRepository;
    private final OrderValidationPipeline validationPipeline;
    private final OrderExecutionService orderExecutionService;
    private final AuditTrailService auditTrailService;
    private final ApplicationEventPublisher events;
    private final TransactionTemplate transactions;

    /**
     * Creates the service.
     *
     * @param quotes authoritative market source
     * @param holdingRepository holdings lookup
     * @param fillRepository executed prices
     * @param orderRepository order persistence
     * @param accountRepository account lookup and ownership checks
     * @param instrumentRepository instrument lookup
     * @param userRepository user lookup
     * @param termsAcceptanceRepository read-only lookup of accepted platform terms
     * @param validationPipeline trading-rule pipeline
     * @param orderExecutionService settlement of orders that pass validation
     * @param auditTrailService lifecycle event recorder
     * @param events publisher of the {@link app.order.event.OrderStatusEvent} raised at each committed status change
     * @param transactionManager manager behind the acceptance transaction, which commits before execution begins
     */
    public OrderService(OrderRepository orderRepository,
                         AccountRepository accountRepository,
                         InstrumentRepository instrumentRepository,
                         UserRepository userRepository,
                         TermsAcceptanceRepository termsAcceptanceRepository,
                         OrderValidationPipeline validationPipeline,
                         OrderExecutionService orderExecutionService,
                         AuditTrailService auditTrailService,
                         ExecutionQuoteSource quotes,
                         HoldingRepository holdingRepository,
                 ApplicationEventPublisher events,
                 PlatformTransactionManager transactionManager,
                 ExecutionQuoteSource quotes,
                 HoldingRepository holdingRepository,
                 FillRepository fillRepository) {
        this.quotes = quotes;
        this.holdingRepository = holdingRepository;
        this.fillRepository = fillRepository;
        this.orderRepository = orderRepository;
        this.accountRepository = accountRepository;
        this.instrumentRepository = instrumentRepository;
        this.userRepository = userRepository;
        this.termsAcceptanceRepository = termsAcceptanceRepository;
        this.validationPipeline = validationPipeline;
        this.orderExecutionService = orderExecutionService;
        this.auditTrailService = auditTrailService;
        this.events = events;
        this.transactions = new TransactionTemplate(transactionManager);
    }

    /**
     * Submits an order on an account the caller owns. The order is created
     * {@code PENDING}; it returns as {@code REJECTED} when a trading rule
     * fails, {@code FILLED} once the fill is written and the owning user's
     * available funds and the account's holdings have moved, or
     * {@code ACCEPTED} when it passed the rules but execution failed
     * unexpectedly, in which case the order stays on record and the failure
     * is in its audit trail. Never throws for a trade that fails a trading
     * rule or whose execution fails; those are outcomes, reflected in the
     * returned order's status, not HTTP-level errors. It throws only when the
     * request names something that doesn't exist or isn't the caller's, or
     * when the caller has not accepted the platform terms in force.
     *
     * <p>Ownership is settled before anything else, including the idempotency
     * lookup: an idempotency key is scoped to an account, so answering one
     * before checking the account would hand a caller the outcome of an order
     * on an account they don't own.
     *
     * <p>A caller who has not accepted the platform terms in force
     * ({@link TermsAcceptance#CURRENT_VERSION}) cannot place a new order, and
     * nothing is recorded for the attempt. The dashboard already asks for the
     * acceptance before it shows an order ticket; this is the same rule for a
     * request that did not come through the dashboard. A resubmission of an
     * order that is already on record still returns that order.
     *
     * @param request the validated submission
     * @param callerId the caller's user id, from the token's {@code sub} claim
     * @return the persisted order in its current status
     * @throws AccountNotFoundException    if {@code accountId} does not exist
     * @throws ForbiddenException          if {@code accountId} belongs to another user, or the
     *         caller has not accepted the platform terms in force
     * @throws InstrumentNotFoundException if {@code instrumentId} does not exist
     * @throws org.springframework.dao.DataAccessException if the acceptance transaction itself
     *         fails to persist; nothing is then on record
     * @throws IllegalStateException       if the account has no owning user
     */
    public Order submitOrder(OrderRequest request, UUID callerId) {
        Acceptance accepted = transactions.execute(status -> accept(request, callerId));
        if (!accepted.executable()) {
            return accepted.order();
        }
        try {
            return orderExecutionService.execute(accepted.order(), accepted.instrument());
        } catch (RuntimeException ex) {
            Integer orderId = accepted.order().getOrderId();
            log.error("Execution of order {} failed; the order stays ACCEPTED on record", orderId, ex);
            recordExecutionFailure(orderId, ex);
            return orderRepository.findById(orderId).orElse(accepted.order());
        }
    }

    /** What the acceptance transaction committed, and whether execution should follow. */
    private record Acceptance(Order order, Instrument instrument, boolean executable) {
    }

    private Acceptance accept(OrderRequest request, UUID callerId) {
        Account account = accountRepository.findById(request.accountId())
                .orElseThrow(() -> new AccountNotFoundException("No account " + request.accountId()));
        if (!account.getUserId().equals(callerId)) {
            throw new ForbiddenException("You do not have access to this account");
        }

        Optional<Order> existing = orderRepository
                .findByAccountIdAndClientReference(request.accountId(), request.clientReference());
        if (existing.isPresent()) {
            // Same idempotency key already processed (or in flight) for this account —
            // return its outcome rather than validating or executing a second time.
            // Note: a genuinely concurrent duplicate can still race past this check;
            // the DB's UNIQUE (account_id, client_reference) constraint is the backstop.
            return new Acceptance(withFillPrice(existing.get()), null, false);
        }

        if (!termsAcceptanceRepository.existsById(
                new TermsAcceptanceId(callerId, TermsAcceptance.CURRENT_VERSION))) {
            throw new ForbiddenException("Accept the platform terms before placing an order");
        }

        if (account.getArchivedAt() != null)
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.CONFLICT, "This account is archived");
        // Lock before first loading the user: a later locking query would retain
        // an already-managed stale balance in Hibernate's persistence context.
        User user = userRepository.findByIdForUpdate(account.getUserId())
                .orElseThrow(() -> new IllegalStateException(
                        "Account " + account.getAccountId() + " has no owning user"));
        Instrument instrument = instrumentRepository.findById(request.instrumentId())
                .orElseThrow(() -> new InstrumentNotFoundException("No instrument " + request.instrumentId()));

        BigDecimal bufferPercent = request.bufferPercent() != null
                ? request.bufferPercent()
                : user.getExecutionBufferPercent();

        OffsetDateTime now = OffsetDateTime.now();
        Order order = new Order();
        order.setAccountId(account.getAccountId());
        order.setInstrumentId(instrument.getInstrumentId());
        order.setClientReference(request.clientReference());
        order.setOrderType(request.orderType());
        order.setQuantity(request.quantity());
        order.setIndicativePrice(request.indicativePrice());
        order.setBufferPercent(bufferPercent);
        order.setStatus(Order.STATUS_PENDING);
        order.setSubmittedAt(now);
        order.setSimulatedAt(request.simulatedAt());
        order.setSessionId(request.sessionId());
        order = orderRepository.save(order);
        auditTrailService.record(order.getOrderId(), Order.STATUS_PENDING, null);

        ValidationResult result = validationPipeline.run(request, user, account, instrument);
        if (!result.passed()) {
            order.setStatus(Order.STATUS_REJECTED);
            order.setRejectionReason(result.reason());
            order.setResolvedAt(OffsetDateTime.now());
            order = orderRepository.save(order);
            auditTrailService.record(order.getOrderId(), Order.STATUS_REJECTED, result.reason());
            events.publishEvent(OrderStatusEvent.from(order, instrument));
            return new Acceptance(order, instrument, false);
        }

        // The rules passed (BR-05). Commit the order as ACCEPTED before anything
        // executes: this is the record of intent BR-06 requires, and it survives
        // whatever happens in the execution transaction.
        order.setStatus(Order.STATUS_ACCEPTED);
        order.setAcceptedAt(OffsetDateTime.now());
        order = orderRepository.save(order);
        auditTrailService.record(order.getOrderId(), Order.STATUS_ACCEPTED, null);
        events.publishEvent(OrderStatusEvent.from(order, instrument));
        return new Acceptance(order, instrument, true);
    }

    private void recordExecutionFailure(Integer orderId, RuntimeException failure) {
        String detail = describe(failure);
        try {
            transactions.executeWithoutResult(status ->
                    auditTrailService.record(orderId, AUDIT_EXECUTION_FAILED, detail));
        } catch (RuntimeException auditFailure) {
            log.error("Could not record the execution failure of order {}", orderId, auditFailure);
        }
    }

    private static String describe(RuntimeException failure) {
        String message = failure.getMessage() == null ? "" : failure.getMessage();
        String detail = failure.getClass().getSimpleName() + ": " + message;
        return detail.length() <= MAX_FAILURE_DETAIL_LENGTH
                ? detail
                : detail.substring(0, MAX_FAILURE_DETAIL_LENGTH);
    }

    private Order withFillPrice(Order order) {
        order.setExecutionPrice(fillRepository.findByOrderId(order.getOrderId())
                .map(Fill::getQuotePrice).orElse(null));
        return order;
    }

    /** Checks current eligibility without writing or reserving resources.
     * @param check advisory trade request
     * @param callerId verified owner
     * @return nonbinding assessment
     * @throws AccountNotFoundException if the account is missing
     * @throws ForbiddenException if another user owns the account
     * @throws InstrumentNotFoundException if the instrument is missing
     * @throws org.springframework.web.server.ResponseStatusException if archived */
    @Transactional(readOnly = true)
    public OrderCheckResponse check(OrderCheckRequest check, UUID callerId) {
        OrderRequest request = check.asOrderRequest();
        Account account = accountRepository.findById(request.accountId())
                .orElseThrow(() -> new AccountNotFoundException("No account " + request.accountId()));
        if (!account.getUserId().equals(callerId)) throw new ForbiddenException("You do not have access to this account");
        if (account.getArchivedAt() != null) throw new org.springframework.web.server.ResponseStatusException(
                org.springframework.http.HttpStatus.CONFLICT, "This account is archived");
        User user = userRepository.findById(callerId).orElseThrow(() -> new IllegalStateException("Account has no owning user"));
        Instrument instrument = instrumentRepository.findById(request.instrumentId())
                .orElseThrow(() -> new InstrumentNotFoundException("No instrument " + request.instrumentId()));
        BigDecimal buffer = request.bufferPercent() == null ? user.getExecutionBufferPercent() : request.bufferPercent();
        boolean valid = ExecutionPolicy.validBuffer(buffer);
        BigDecimal boundary = valid ? ExecutionPolicy.boundary(request.orderType(), request.indicativePrice(), buffer) : null;
        String code = valid ? null : "INVALID_BUFFER";
        String reason = code == null ? null : ExecutionPolicy.reason(code);
        ValidationResult validation = validationPipeline.run(request, user, account, instrument);
        if (code == null && !validation.passed()) { code = "TRADING_RULE_FAILED"; reason = validation.reason(); }
        ExecutionQuoteSource.Quote quote = null;
        if (code == null) {
            try { quote = quotes.current(instrument, request.sessionId()); }
            catch (ExecutionQuoteSource.QuoteUnavailableException ex) { code = "MARKET_PRICE_UNAVAILABLE"; reason = ex.getMessage(); }
        }
        if (quote != null) {
            BigDecimal held = holdingRepository.findByAccountIdAndInstrumentId(account.getAccountId(), instrument.getInstrumentId())
                    .map(Holding::getQuantity).orElse(BigDecimal.ZERO);
            code = ExecutionPolicy.failure(request.orderType(), request.quantity(), quote.price(), boundary, user.getAvailableFunds(), held);
            reason = code == null ? null : ExecutionPolicy.reason(code);
        }
        return new OrderCheckResponse(code == null, code, reason, buffer, request.indicativePrice(),
                quote == null ? null : quote.price(), quote == null ? null : request.quantity().multiply(quote.price()),
                boundary, quote == null ? null : quote.sessionId(), quote == null ? null : quote.timestamp());
    }

    /**
     * Lists the caller's own orders, newest submission first. Callers pass
     * the id from the verified token, never an id supplied in the request,
     * so a client can only read orders placed on accounts it owns. A user
     * with no orders gets an empty list rather than an error.
     *
     * @param userId the caller's user id from the token's sub claim
     * @return the caller's orders across all of their accounts, newest first
     */
    @Transactional(readOnly = true)
    public List<Order> getOwnOrders(UUID userId) {
        return orderRepository.findAllByOwningUserId(userId).stream().map(this::withFillPrice).toList();
    }
}
