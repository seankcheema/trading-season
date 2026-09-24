package app.order.execution;

import app.account.Account;
import app.account.AccountRepository;
import app.holding.Holding;
import app.holding.HoldingRepository;
import app.instrument.Instrument;
import app.order.Order;
import app.order.OrderRepository;
import app.order.audit.AuditTrailService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * Turns an ACCEPTED order into a fill, atomically. Only reached after
 * {@code OrderValidationPipeline} has passed — this class does not itself
 * decide whether a trade is allowed, it carries out one that already was.
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
 * <p>Funds and holdings were already checked once by the pipeline, against
 * a snapshot that can go stale between validation and execution. This class
 * re-checks both under a row lock immediately before writing the fill, so
 * two concurrent orders can't both spend the same balance or the same
 * holding.
 */
@Service
public class OrderExecutionService {

    private final AccountRepository accountRepository;
    private final HoldingRepository holdingRepository;
    private final OrderRepository orderRepository;
    private final FillRepository fillRepository;
    private final CashTransactionRepository cashTransactionRepository;
    private final HoldingMovementRepository holdingMovementRepository;
    private final AuditTrailService auditTrailService;

    public OrderExecutionService(AccountRepository accountRepository,
                                  HoldingRepository holdingRepository,
                                  OrderRepository orderRepository,
                                  FillRepository fillRepository,
                                  CashTransactionRepository cashTransactionRepository,
                                  HoldingMovementRepository holdingMovementRepository,
                                  AuditTrailService auditTrailService) {
        this.accountRepository = accountRepository;
        this.holdingRepository = holdingRepository;
        this.orderRepository = orderRepository;
        this.fillRepository = fillRepository;
        this.cashTransactionRepository = cashTransactionRepository;
        this.holdingMovementRepository = holdingMovementRepository;
        this.auditTrailService = auditTrailService;
    }

    @Transactional
    public Order execute(Order order, Instrument instrument) {
        boolean isBuy = Order.TYPE_BUY.equals(order.getOrderType());
        BigDecimal fillPrice = order.getIndicativePrice();
        BigDecimal tradeValue = order.getQuantity().multiply(fillPrice);

        Account account = accountRepository.findByIdForUpdate(order.getAccountId())
                .orElseThrow(() -> new IllegalStateException(
                        "Account " + order.getAccountId() + " disappeared mid-execution"));

        if (isBuy && tradeValue.compareTo(account.getCashBalance()) > 0) {
            return failExecution(order, "BR-09: insufficient funds at execution time");
        }

        Holding holding = holdingRepository
                .findByAccountIdAndInstrumentIdForUpdate(order.getAccountId(), order.getInstrumentId())
                .orElse(null);
        BigDecimal currentQuantity = holding == null ? BigDecimal.ZERO : holding.getQuantity();
        if (!isBuy && order.getQuantity().compareTo(currentQuantity) > 0) {
            return failExecution(order, "Insufficient holdings at execution time");
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
        account.setCashBalance(account.getCashBalance().add(cashDelta));
        accountRepository.save(account);

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

    private Order failExecution(Order order, String reason) {
        order.setStatus(Order.STATUS_EXECUTION_FAILED);
        order.setRejectionReason(reason);
        order.setResolvedAt(OffsetDateTime.now());
        final Order savedOrder = orderRepository.save(order);
        auditTrailService.record(savedOrder.getOrderId(), Order.STATUS_EXECUTION_FAILED, reason);
        return savedOrder;
    }
}


