package app.order;

import app.account.Account;
import app.account.AccountNotFoundException;
import app.account.AccountRepository;
import app.auth.ForbiddenException;
import app.instrument.Instrument;
import app.instrument.InstrumentNotFoundException;
import app.instrument.InstrumentRepository;
import app.order.audit.AuditTrailService;
import app.order.audit.AuditTrail;
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
 * existing order raises nothing. New submissions lock the account and require ACTIVE
 * status, serializing order acceptance with account archiving and deletion.
 */
@Service
public class OrderService {

    /** Audit event type written when execution throws and the order stays {@code ACCEPTED}. */
    public static final String AUDIT_EXECUTION_FAILED = "EXECUTION_FAILED";

    /**
     * Longest failure description written to the audit trail. PostgreSQL's
     * {@code detail} column is unbounded text, but a driver exception can run
     * to kilobytes of SQL, and the audit row must never itself fail to write.
     */
    static final int MAX_FAILURE_DETAIL_LENGTH = 255;

    private static final Logger log = LoggerFactory.getLogger(OrderService.class);

    @org.springframework.beans.factory.annotation.Autowired
    private app.order.execution.ExecutionQuoteSource quotes;
    @org.springframework.beans.factory.annotation.Autowired
    private app.holding.HoldingRepository holdings;
    @jakarta.persistence.PersistenceContext
    private jakarta.persistence.EntityManager entityManager;
    private final OrderRepository orderRepository;
    private final AccountRepository accountRepository;
    private final InstrumentRepository instrumentRepository;
    private final UserRepository userRepository;
    private final TermsAcceptanceRepository termsAcceptanceRepository;
    private final OrderValidationPipeline validationPipeline;
    private final OrderExecutionService orderExecutionService;
    private final AuditTrailService auditTrailService;
    private final app.order.audit.AuditTrailRepository auditTrailRepository;
    private final ApplicationEventPublisher events;
    private final TransactionTemplate transactions;

    /**
     * Creates the service.
     *
     * @param orderRepository order persistence
     * @param accountRepository account lookup and ownership checks
     * @param instrumentRepository instrument lookup
     * @param userRepository user lookup
     * @param termsAcceptanceRepository read-only lookup of accepted platform terms
     * @param validationPipeline trading-rule pipeline
     * @param orderExecutionService settlement of orders that pass validation
     * @param auditTrailService lifecycle event recorder
     * @param auditTrailRepository read access to an order's recorded lifecycle entries, oldest first
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
                         app.order.audit.AuditTrailRepository auditTrailRepository,
                         ApplicationEventPublisher events,
                         PlatformTransactionManager transactionManager) {
        this.orderRepository = orderRepository;
        this.accountRepository = accountRepository;
        this.instrumentRepository = instrumentRepository;
        this.userRepository = userRepository;
        this.termsAcceptanceRepository = termsAcceptanceRepository;
        this.validationPipeline = validationPipeline;
        this.orderExecutionService = orderExecutionService;
        this.auditTrailService = auditTrailService;
        this.auditTrailRepository = auditTrailRepository;
        this.events = events;
        this.transactions = new TransactionTemplate(transactionManager);
    }

    /**
     * Submits an order on an account the caller owns. The order is created
     * {@code PENDING}; it returns as {@code REJECTED} when a trading rule
     * fails, {@code FILLED} once the fill is written and the owning user's
     * available funds and the account's holdings have moved, or
     * {@code ACCEPTED} while conditional execution is pending or settlement is
     * retryable. Acceptance snapshots the authoritative quote and saved profile
     * buffer, and reserves cash or shares without posting a ledger movement.
     * Failures remain in the audit trail and retain reservations for retry. Never throws for a trade that fails a trading
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
     * @throws app.order.execution.ExecutionQuoteSource.QuoteUnavailableException if no authoritative submission quote exists
     * @throws org.springframework.web.server.ResponseStatusException if stock parameters are invalid
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

    /** Atomically replaces an owned open order, then settles the replacement separately.
     * A validation failure rolls back cancellation and preserves the original reservation.
     * @param orderId original open instruction
     * @param request replacement quantity, execution type, and prices
     * @param callerId authenticated owner
     * @return replacement outcome, or the prior outcome on an idempotent retry
     * @throws app.account.AccountNotFoundException if the original is absent or foreign
     * @throws org.springframework.web.server.ResponseStatusException if the order is terminal,
     *         outside its simulation day, or replacement validation fails */
    public Order replace(Integer orderId, OrderRequest request, UUID callerId) {
        Acceptance replacement = transactions.execute(tx -> replaceInTransaction(orderId, request, callerId));
        if (!replacement.executable()) return replacement.order();
        try {
            return orderExecutionService.execute(replacement.order(), replacement.instrument());
        } catch (RuntimeException failure) {
            recordExecutionFailure(replacement.order().getOrderId(), failure);
            return orderRepository.findById(replacement.order().getOrderId()).orElse(replacement.order());
        }
    }

    private Acceptance replaceInTransaction(Integer orderId, OrderRequest request, UUID callerId) {
        Order visible = getOwnOrder(orderId, callerId);
        userRepository.findByIdForUpdate(callerId).orElseThrow();
        accountRepository.findByIdForUpdate(visible.getAccountId()).orElseThrow();
        Order original = orderRepository.findByIdForUpdate(orderId).orElseThrow();
        entityManager.refresh(original);
        requireSameOrderIdentity(original, request);
        var prior = orderRepository.findByAccountIdAndClientReference(request.accountId(), request.clientReference());
        if (prior.isPresent() && isReplacedBy(original, prior.get())) {
            return new Acceptance(prior.get(), null, false);
        }
        if (!Order.STATUS_ACCEPTED.equals(original.getStatus()) || prior.isPresent()) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.CONFLICT, "Only open orders can be edited");
        }
        Instrument stock = instrumentRepository.findById(original.getInstrumentId()).orElseThrow();
        requireEditableAt(original, quotes.current(stock, original.getSessionId()).timestamp());
        cancelForReplacement(original);
        Acceptance accepted = accept(request, callerId);
        if (!Order.STATUS_ACCEPTED.equals(accepted.order().getStatus())) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.BAD_REQUEST, accepted.order().getRejectionReason());
        }
        requireSimulationUnchanged(original, accepted.order());
        original.setRejectionCode("ORDER_REPLACED");
        original.setRejectionReason("Replaced by order #" + accepted.order().getOrderId());
        orderRepository.save(original);
        auditTrailService.record(orderId, Order.STATUS_CANCELLED, original.getRejectionReason());
        auditTrailService.record(accepted.order().getOrderId(), Order.STATUS_ACCEPTED,
                "Replaces order #" + orderId);
        events.publishEvent(OrderStatusEvent.from(original, stock));
        return accepted;
    }

    private static void requireSameOrderIdentity(Order original, OrderRequest request) {
        boolean sameStock = original.getAccountId().equals(request.accountId())
                && original.getInstrumentId().equals(request.instrumentId())
                && original.getOrderType().equals(request.orderType());
        if (!sameStock || !java.util.Objects.equals(original.getSessionId(), request.sessionId())) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.BAD_REQUEST, "Account, stock, side and session cannot be changed");
        }
    }

    /** True when the original was already cancelled in favor of the order sharing the retried reference. */
    private static boolean isReplacedBy(Order original, Order prior) {
        return "ORDER_REPLACED".equals(original.getRejectionCode())
                && ("Replaced by order #" + prior.getOrderId()).equals(original.getRejectionReason());
    }

    private static void requireEditableAt(Order original, OffsetDateTime at) {
        boolean beforeOrder = original.getReferenceAt() == null || at.isBefore(original.getReferenceAt());
        boolean beforeEvaluation = original.getEvaluatedAt() != null && at.isBefore(original.getEvaluatedAt());
        if (beforeOrder || beforeEvaluation
                || !at.isBefore(app.order.execution.ExecutionPolicy.expiresAt(original).minusSeconds(1))) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.CONFLICT, "The order cannot be edited at this simulation time");
        }
    }

    private void cancelForReplacement(Order original) {
        original.setStatus(Order.STATUS_CANCELLED);
        original.setReservedCash(BigDecimal.ZERO);
        original.setReservedShares(BigDecimal.ZERO);
        original.setRetryAfter(null);
        original.setResolvedAt(OffsetDateTime.now());
        orderRepository.saveAndFlush(original);
    }

    private static void requireSimulationUnchanged(Order original, Order replacement) {
        OffsetDateTime floor = original.getEvaluatedAt() == null ? original.getReferenceAt() : original.getEvaluatedAt();
        OffsetDateTime at = replacement.getReferenceAt();
        if (at.isBefore(floor) || !at.isBefore(app.order.execution.ExecutionPolicy.expiresAt(original).minusSeconds(1))) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.CONFLICT, "Simulation time changed while editing; original order was retained");
        }
    }

    /** What the acceptance transaction committed, and whether execution should follow. */
    private record Acceptance(Order order, Instrument instrument, boolean executable) {
    }

    private Acceptance accept(OrderRequest request, UUID callerId) {
        Account account = lockOwnedAccount(request.accountId(), callerId);

        Optional<Order> existing = orderRepository
                .findByAccountIdAndClientReference(request.accountId(), request.clientReference());
        if (existing.isPresent()) {
            // Same idempotency key already processed (or in flight) for this account —
            // return its outcome rather than validating or executing a second time.
            // The owner/account locks serialize duplicate submissions; the unique
            // (account_id, client_reference) constraint remains the database backstop.
            return new Acceptance(existing.get(), null, false);
        }

        requireTradingAllowed(account, callerId);

        User user = userRepository.findById(account.getUserId())
                .orElseThrow(() -> new IllegalStateException(
                        "Account " + account.getAccountId() + " has no owning user"));
        Instrument instrument = instrumentRepository.findById(request.instrumentId())
                .orElseThrow(() -> new InstrumentNotFoundException("No instrument " + request.instrumentId()));

        if (request.bufferPercent() != null || !request.isPriceConfigurationValid()
                || request.quantity().stripTrailingZeros().scale() > 0) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.BAD_REQUEST, "Invalid stock order parameters");
        }
        var quote = quotes.current(instrument, request.sessionId());

        Order order = orderRepository.save(pendingOrder(request, account, instrument, user.getExecutionBufferPercent(), quote));
        auditTrailService.record(order.getOrderId(), Order.STATUS_PENDING, null);

        // Existing rules see authoritative cost rather than an untrusted client estimate.
        var checkedRequest = new OrderRequest(request.accountId(), request.instrumentId(), request.orderType(),
                request.quantity(), app.order.execution.ExecutionPolicy.reservationPrice(order), null,
                request.clientReference(), order.getSimulatedAt());
        ValidationResult result = validationPipeline.run(checkedRequest, user, account, instrument);
        var reservations = orderRepository.findReservations(callerId);
        if (result.passed()) {
            result = reserve(result, order, user, account, instrument, reservations);
        }
        if (!result.passed()) {
            return rejectedAcceptance(order, instrument, result);
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

    /** Locks the caller's profile and the account, proving the caller owns it. */
    private Account lockOwnedAccount(Integer accountId, UUID callerId) {
        Account visibleAccount = accountRepository.findById(accountId)
                .orElseThrow(() -> new AccountNotFoundException("No account " + accountId));
        if (!visibleAccount.getUserId().equals(callerId)) throw new ForbiddenException("You do not have access to this account");
        userRepository.findByIdForUpdate(callerId)
                .orElseThrow(() -> new IllegalStateException("Profile is not registered"));
        Account account = accountRepository.findByIdForUpdate(accountId)
                .orElseThrow(() -> new AccountNotFoundException("No account " + accountId));
        entityManager.refresh(account);
        if (!account.getUserId().equals(callerId)) {
            throw new ForbiddenException("You do not have access to this account");
        }
        return account;
    }

    private void requireTradingAllowed(Account account, UUID callerId) {
        if (!"ACTIVE".equals(account.getStatus())) {
            throw new ForbiddenException("Archived accounts cannot trade");
        }

        if (!termsAcceptanceRepository.existsById(
                new TermsAcceptanceId(callerId, TermsAcceptance.CURRENT_VERSION))) {
            throw new ForbiddenException("Accept the platform terms before placing an order");
        }
    }

    private static Order pendingOrder(OrderRequest request, Account account, Instrument instrument,
            BigDecimal bufferPercent, app.order.execution.ExecutionQuoteSource.Quote quote) {
        Order order = new Order();
        order.setAccountId(account.getAccountId());
        order.setInstrumentId(instrument.getInstrumentId());
        order.setClientReference(request.clientReference());
        order.setOrderType(request.orderType());
        order.setQuantity(request.quantity());
        order.setIndicativePrice(request.indicativePrice());
        order.setBufferPercent(bufferPercent);
        order.setExecutionType(request.executionType());
        order.setLimitPrice(request.limitPrice());
        order.setStopPrice(request.stopPrice());
        order.setReferencePrice(quote.price());
        order.setReferenceAt(quote.timestamp());
        order.setEvaluatedAt(quote.timestamp());
        order.setSessionId(quote.sessionId());
        order.setSimulatedAt(quote.timestamp());
        order.setStatus(Order.STATUS_PENDING);
        order.setSubmittedAt(OffsetDateTime.now());
        return order;
    }

    /** Reserves buying power or shares for a validated order, or rejects it when they are short. */
    private ValidationResult reserve(ValidationResult validated, Order order, User user, Account account,
            Instrument instrument, List<Order> reservations) {
        if (Order.TYPE_BUY.equals(order.getOrderType())) {
            BigDecimal reservedCash = reservations.stream().map(Order::getReservedCash).reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal required = order.getQuantity().multiply(app.order.execution.ExecutionPolicy.reservationPrice(order));
            if (required.compareTo(user.getAvailableFunds().subtract(reservedCash)) > 0) {
                return ValidationResult.reject("Insufficient available buying power");
            }
            order.setReservedCash(required);
            return validated;
        }
        BigDecimal reservedShares = reservations.stream()
                .filter(o -> o.getAccountId().equals(account.getAccountId()) && o.getInstrumentId().equals(instrument.getInstrumentId()))
                .map(Order::getReservedShares).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal held = holdings.findByAccountIdAndInstrumentId(account.getAccountId(), instrument.getInstrumentId())
                .map(app.holding.Holding::getQuantity).orElse(BigDecimal.ZERO);
        if (order.getQuantity().compareTo(held.subtract(reservedShares)) > 0) {
            return ValidationResult.reject("Insufficient available shares");
        }
        order.setReservedShares(order.getQuantity());
        return validated;
    }

    private Acceptance rejectedAcceptance(Order pending, Instrument instrument, ValidationResult result) {
        pending.setStatus(Order.STATUS_REJECTED);
        pending.setRejectionReason(result.reason());
        pending.setRejectionCode("TRADING_RULE_FAILED");
        pending.setReservedCash(BigDecimal.ZERO);
        pending.setReservedShares(BigDecimal.ZERO);
        pending.setResolvedAt(OffsetDateTime.now());
        Order rejected = orderRepository.save(pending);
        auditTrailService.record(rejected.getOrderId(), Order.STATUS_REJECTED, result.reason());
        events.publishEvent(OrderStatusEvent.from(rejected, instrument));
        return new Acceptance(rejected, instrument, false);
    }

    /** Records a rolled-back execution and schedules bounded-backoff retry.
     * @param orderId failed order
     * @param failure settlement failure */
    public void recordExecutionFailure(Integer orderId, RuntimeException failure) {
        String detail = describe(failure);
        try {
            transactions.executeWithoutResult(status -> {
                Order visible = orderRepository.findById(orderId).orElseThrow();
                Account account = accountRepository.findById(visible.getAccountId()).orElseThrow();
                userRepository.findByIdForUpdate(account.getUserId()).orElseThrow();
                accountRepository.findByIdForUpdate(account.getAccountId()).orElseThrow();
                Order order = orderRepository.findByIdForUpdate(orderId).orElseThrow();
                entityManager.refresh(order);
                if (!Order.STATUS_ACCEPTED.equals(order.getStatus())) return;
                int attempts = order.getExecutionAttempts() + 1;
                order.setExecutionAttempts(attempts);
                order.setRetryAfter(OffsetDateTime.now().plusSeconds(Math.min(60, 1L << Math.min(attempts, 6))));
                orderRepository.save(order);
                auditTrailService.record(orderId, AUDIT_EXECUTION_FAILED, detail);
            });
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
        return orderRepository.findAllByOwningUserId(userId);
    }

    /**
     * Returns one order only when it belongs to the caller. An unowned and an
     * unknown order are intentionally indistinguishable to the client.
     *
     * @param orderId the requested order id
     * @param userId the caller's user id from the token's {@code sub} claim
     * @return the caller's owned order
     * @throws AccountNotFoundException if the order is absent or not owned by the caller
     */
    @Transactional(readOnly = true)
    public Order getOwnOrder(Integer orderId, UUID userId) {
        return orderRepository.findByOrderIdAndOwningUserId(orderId, userId)
                .orElseThrow(() -> new AccountNotFoundException("No order " + orderId));
    }

    /**
     * Returns the lifecycle audit entries for one order owned by the caller.
     * An unowned or unknown order is deliberately indistinguishable to avoid
     * revealing another trader's order ids.
     *
     * @param orderId the requested order id
     * @param userId the caller's user id from the token's {@code sub} claim
     * @return immutable lifecycle entries, oldest first
     * @throws app.account.AccountNotFoundException if the order is absent or not owned by the caller
     */
    @Transactional(readOnly = true)
    public List<AuditTrail> getOwnOrderAudit(Integer orderId, UUID userId) {
        Order order = getOwnOrder(orderId, userId);
        return auditTrailRepository.findAllByOrderIdOrderByRecordedAtAscAuditIdAsc(order.getOrderId());
    }
    /** Cancels an owned open instruction and releases its reservations atomically.
     * @param orderId order identifier
     * @param userId verified owner
     * @return cancelled order
     * @throws app.account.AccountNotFoundException if absent or foreign
     * @throws org.springframework.web.server.ResponseStatusException if already filled or rejected */
    @Transactional
    public Order cancel(Integer orderId, UUID userId) {
        Order visible = getOwnOrder(orderId, userId);
        userRepository.findByIdForUpdate(userId).orElseThrow();
        accountRepository.findByIdForUpdate(visible.getAccountId()).orElseThrow();
        Order order = orderRepository.findByIdForUpdate(orderId).orElseThrow();
        entityManager.refresh(order);
        if (Order.STATUS_CANCELLED.equals(order.getStatus())) return order;
        if (!Order.STATUS_ACCEPTED.equals(order.getStatus())) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.CONFLICT, "Only open orders can be cancelled");
        }
        order.setStatus(Order.STATUS_CANCELLED);
        order.setRetryAfter(null);
        order.setResolvedAt(OffsetDateTime.now());
        order.setReservedCash(BigDecimal.ZERO);
        order.setReservedShares(BigDecimal.ZERO);
        orderRepository.save(order);
        auditTrailService.record(orderId, Order.STATUS_CANCELLED, "Cancelled by owner");
        events.publishEvent(OrderStatusEvent.from(order, instrumentRepository.findById(order.getInstrumentId()).orElseThrow()));
        return order;
    }
}
