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
import app.order.execution.OrderExecutionService;
import app.order.validation.OrderValidationPipeline;
import app.order.validation.ValidationResult;
import app.user.User;
import app.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import java.util.Optional;

/**
 * Orchestrates one order submission: resolving and ownership-checking the
 * account, the idempotency check, loading the entities the rule pipeline
 * needs, persisting the order as {@code PENDING}, running the pipeline, and
 * — only if it passes — handing off to {@link OrderExecutionService}. A
 * failed rule leaves the order {@code REJECTED}; a successful execution
 * leaves it {@code FILLED} (KAN-93). This is the "Order controller" +
 * "Trading rule pipeline" handoff from the KAN-95 walkthrough, minus the
 * HTTP concerns, which stay in {@link OrderController}.
 */
@Service
public class OrderService {

    private final ExecutionQuoteSource quotes;
    private final HoldingRepository holdingRepository;
    private final FillRepository fillRepository;
    private final OrderRepository orderRepository;
    private final AccountRepository accountRepository;
    private final InstrumentRepository instrumentRepository;
    private final UserRepository userRepository;
    private final OrderValidationPipeline validationPipeline;
    private final OrderExecutionService orderExecutionService;
    private final AuditTrailService auditTrailService;

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
     * @param validationPipeline trading-rule pipeline
     * @param orderExecutionService settlement of orders that pass validation
     * @param auditTrailService lifecycle event recorder
     */
    public OrderService(OrderRepository orderRepository,
                         AccountRepository accountRepository,
                         InstrumentRepository instrumentRepository,
                         UserRepository userRepository,
                         OrderValidationPipeline validationPipeline,
                         OrderExecutionService orderExecutionService,
                         AuditTrailService auditTrailService,
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
        this.validationPipeline = validationPipeline;
        this.orderExecutionService = orderExecutionService;
        this.auditTrailService = auditTrailService;
    }

    /**
     * Submits an order on an account the caller owns. The order is created
     * {@code PENDING}; it returns as {@code REJECTED} when a trading rule
     * fails, or {@code FILLED} once the fill is written and the owning user's
     * available funds and the account's holdings have moved. Never throws for
     * a trade that fails a trading rule — that's a normal outcome, reflected
     * in the returned order's status, not an HTTP-level error. It throws only
     * when the request names something that doesn't exist or isn't the
     * caller's.
     *
     * <p>Ownership is settled before anything else, including the idempotency
     * lookup: an idempotency key is scoped to an account, so answering one
     * before checking the account would hand a caller the outcome of an order
     * on an account they don't own.
     *
     * <p>The user row is locked before its first read, so different accounts
     * cannot spend a stale copy of their shared cash. Execution uses a fresh
     * server replay quote and the effective buffer saved on this order.
     *
     * @throws org.springframework.web.server.ResponseStatusException if the account is archived
     * @param request the validated submission
     * @param callerId the caller's user id, from the token's {@code sub} claim
     * @return the persisted order in its final status
     * @throws AccountNotFoundException    if {@code accountId} does not exist
     * @throws ForbiddenException          if {@code accountId} belongs to another user
     * @throws InstrumentNotFoundException if {@code instrumentId} does not exist
     * @throws org.springframework.dao.DataAccessException if persistence fails; the order and all
     *         execution ledger writes are rolled back together
     * @throws IllegalStateException       if the account has no owning user
     */
    @Transactional
    public Order submitOrder(OrderRequest request, UUID callerId) {
        Account account = accountRepository.findByIdForUpdate(request.accountId())
                .orElseThrow(() -> new AccountNotFoundException("No account " + request.accountId()));
        if (!account.getUserId().equals(callerId)) {
            throw new ForbiddenException("You do not have access to this account");
        }

        Optional<Order> existing = orderRepository
                .findByAccountIdAndClientReference(request.accountId(), request.clientReference());
        if (existing.isPresent()) {
            // Same idempotency key already processed (or in flight) for this account —
            // return its outcome rather than validating or executing a second time.
            // The account lock serializes submissions, and the database uniqueness
            // constraint remains the backstop for client references.
            return withFillPrice(existing.get());
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
            return order;
        }

        // The rules passed (BR-05); the order stays PENDING until execution
        // moves it to FILLED, or rejects it under the row lock.
        order.setAcceptedAt(OffsetDateTime.now());
        order = orderRepository.save(order);

        return orderExecutionService.execute(order, instrument);
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


