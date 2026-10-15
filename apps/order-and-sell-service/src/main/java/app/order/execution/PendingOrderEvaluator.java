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
            try {
                var instrument = instruments.findById(order.getInstrumentId()).orElseThrow();
                var current = quotes.current(instrument, order.getSessionId());
                if (current.sessionId() != order.getSessionId()
                        || current.timestamp().isBefore(order.getReferenceAt())) continue;
                var expiry = ExecutionPolicy.expiresAt(order);
                boolean expired = !current.timestamp().plusSeconds(1).isBefore(expiry);
                if (!expired && order.getRetryAfter() != null && OffsetDateTime.now().isBefore(order.getRetryAfter())) continue;
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
                var through = expired ? expiry.minusNanos(1) : current.timestamp();
                var batch = ticks.between(order.getSessionId(), instrument.getSimulatedStockSymbol(), after, through);
                boolean terminal = false;
                for (var tick : batch) {
                    var evaluated = execution.evaluate(order.getOrderId(), instrument, tick);
                    if (!"ACCEPTED".equals(evaluated.getStatus())) { terminal = true; break; }
                    // A retry backoff must not skip an unprocessed historical tick.
                    if (evaluated.getEvaluatedAt() == null || evaluated.getEvaluatedAt().isBefore(tick.timestamp())) {
                        terminal = true; break;
                    }
                }
                // A full batch may have more pre-close ticks. Resume next poll before expiring.
                if (expired && !terminal && batch.size() < 1000) execution.evaluate(order.getOrderId(), instrument, current);
            } catch (ExecutionQuoteSource.QuoteUnavailableException ignored) {
                // No synthetic price or reservation release on a transient outage.
            } catch (RuntimeException failure) {
                submissions.recordExecutionFailure(order.getOrderId(), failure);
            }
        }
    }
}
