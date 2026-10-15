package app.order.execution;

import app.order.OrderRepository;
import app.order.OrderService;
import app.instrument.InstrumentRepository;
import app.market.ExecutionTickSource;
import org.springframework.stereotype.Component;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import java.time.OffsetDateTime;

/** Evaluates persistent open orders independently of browsers, with restart-safe watermarks. */
@Component
@ConditionalOnProperty(name = "app.execution.enabled", havingValue = "true", matchIfMissing = true)
public class PendingOrderEvaluator {
    private final OrderRepository orders;
    private final InstrumentRepository instruments;
    private final ExecutionQuoteSource quotes;
    private final ExecutionTickSource ticks;
    private final OrderExecutionService execution;
    private final OrderService submissions;
    /** Wires the durable evaluator.
     * @param orders open orders
     * @param instruments stock catalogue
     * @param quotes authoritative cursor
     * @param ticks chronological storage adapter
     * @param execution atomic settlement
     * @param submissions failure audit recorder */
    public PendingOrderEvaluator(OrderRepository orders, InstrumentRepository instruments, ExecutionQuoteSource quotes,
            ExecutionTickSource ticks, OrderExecutionService execution, OrderService submissions) {
        this.orders = orders; this.instruments = instruments; this.quotes = quotes;
        this.ticks = ticks; this.execution = execution; this.submissions = submissions;
    }
    /** Processes bounded tick batches; quote outages leave reservations intact. */
    @Scheduled(fixedDelayString = "${app.execution.poll-millis:1000}")
    public void evaluate() {
        for (var order : orders.findExecutableOrders()) {
            if (order.getRetryAfter() != null && OffsetDateTime.now().isBefore(order.getRetryAfter())) continue;
            try {
                var instrument = instruments.findById(order.getInstrumentId()).orElseThrow();
                var current = quotes.current(instrument, order.getSessionId());
                if (current.timestamp().isBefore(order.getReferenceAt())) continue;
                if ("MARKET".equals(order.getExecutionType())) {
                    execution.evaluate(order.getOrderId(), instrument, current);
                    continue;
                }
                var after = order.getEvaluatedAt() == null ? order.getReferenceAt() : order.getEvaluatedAt();
                // Retry the submission position after a failed initial attempt, without using a later price.
                if (after.equals(order.getReferenceAt())) {
                    var initial = new ExecutionQuoteSource.Quote(order.getReferencePrice(), order.getSessionId(), order.getReferenceAt());
                    if (!"ACCEPTED".equals(execution.evaluate(order.getOrderId(), instrument, initial).getStatus())) continue;
                }
                for (var tick : ticks.between(order.getSessionId(), instrument.getSimulatedStockSymbol(), after, current.timestamp())) {
                    if (!"ACCEPTED".equals(execution.evaluate(order.getOrderId(), instrument, tick).getStatus())) break;
                }
            } catch (ExecutionQuoteSource.QuoteUnavailableException ignored) {
                // No synthetic price or reservation release on a transient outage.
            } catch (RuntimeException failure) {
                submissions.recordExecutionFailure(order.getOrderId(), failure);
            }
        }
    }
}
