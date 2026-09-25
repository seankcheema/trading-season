package app.order;

import app.account.Account;
import app.account.AccountNotFoundException;
import app.account.AccountRepository;
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
import java.util.Optional;

/**
 * Orchestrates one order submission: idempotency check, loading the
 * entities the rule pipeline needs, persisting the order as
 * {@code PENDING}, running the pipeline, and — only if it passes — handing
 * off to {@link OrderExecutionService}. A failed rule leaves the order
 * {@code REJECTED}; a successful execution leaves it {@code APPROVED}
 * (KAN-93). This is the "Order controller" + "Trading rule pipeline"
 * handoff from the KAN-95 walkthrough, minus the HTTP concerns, which stay
 * in {@link OrderController}.
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
     * Submits an order. The order is created {@code PENDING}; it returns as
     * {@code REJECTED} when a trading rule fails, or {@code APPROVED} once the
     * fill is written and the owning user's available funds and the account's
     * holdings have moved. Never throws for a trade that fails a trading
     * rule — that's a normal outcome, reflected in the returned order's
     * status, not an HTTP-level error. It throws only when the request
     * refers to something that doesn't exist.
     *
     * @param request the validated submission
     * @return the persisted order in its final status
     * @throws AccountNotFoundException    if {@code accountId} does not exist
     * @throws InstrumentNotFoundException if {@code instrumentId} does not exist
     * @throws IllegalStateException       if the account has no owning user
     */
    @Transactional
    public Order submitOrder(OrderRequest request) {
        Optional<Order> existing = orderRepository
                .findByAccountIdAndClientReference(request.accountId(), request.clientReference());
        if (existing.isPresent()) {
            // Same idempotency key already processed (or in flight) for this account —
            // return its outcome rather than validating or executing a second time.
            // Note: a genuinely concurrent duplicate can still race past this check;
            // the DB's UNIQUE (account_id, client_reference) constraint is the backstop.
            return existing.get();
        }

        Account account = accountRepository.findById(request.accountId())
                .orElseThrow(() -> new AccountNotFoundException("No account " + request.accountId()));
        User user = userRepository.findById(account.getUserId())
                .orElseThrow(() -> new IllegalStateException(
                        "Account " + account.getAccountId() + " has no owning user"));
        Instrument instrument = instrumentRepository.findById(request.instrumentId())
                .orElseThrow(() -> new InstrumentNotFoundException("No instrument " + request.instrumentId()));

        // KAN-95 follow-up: once identity resolution is wired up (see
        // OrderController), verify account.getUserId() equals the authenticated
        // caller's id here — today anyone can submit against any accountId.

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
        // moves it to FILLED and then APPROVED, or rejects it under the row lock.
        order.setAcceptedAt(OffsetDateTime.now());
        order = orderRepository.save(order);

        return orderExecutionService.execute(order, instrument);
    }
}


