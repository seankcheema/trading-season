package app.order;

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
                         AuditTrailService auditTrailService) {
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
            return existing.get();
        }

        if (account.getArchivedAt() != null)
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.CONFLICT, "This account is archived");
        User user = userRepository.findById(account.getUserId())
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
}


