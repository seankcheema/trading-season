package app.order.execution;

import app.order.Order;
import app.order.OrderRepository;
import app.order.OrderService;
import app.market.ExecutionTickSource;
import app.instrument.Instrument;
import app.instrument.InstrumentRepository;
import java.time.OffsetDateTime;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class PendingOrderEvaluatorTest {
    final OrderRepository orders = mock(OrderRepository.class);
    final InstrumentRepository instruments = mock(InstrumentRepository.class);
    final ExecutionQuoteSource quotes = mock(ExecutionQuoteSource.class);
    final ExecutionTickSource ticks = mock(ExecutionTickSource.class);
    final OrderExecutionService execution = mock(OrderExecutionService.class);
    final OrderService submissions = mock(OrderService.class);
    final PendingOrderEvaluator evaluator = new PendingOrderEvaluator(orders, instruments, quotes, ticks, execution, submissions);
    Order order; Instrument instrument;
    final OffsetDateTime at = OffsetDateTime.parse("2026-01-05T15:00:00Z");
    @BeforeEach void setup() {
        order = new Order(); order.setOrderId(1); order.setInstrumentId(2); order.setStatus("ACCEPTED");
        order.setExecutionType("LIMIT"); order.setSessionId(1L); order.setReferenceAt(at); order.setEvaluatedAt(at); order.setReferencePrice(BigDecimal.TEN);
        instrument = new Instrument(); instrument.setSimulatedStockSymbol("AAPL");
        when(orders.findExecutableOrders()).thenReturn(List.of(order));
        when(instruments.findById(2)).thenReturn(Optional.of(instrument));
        when(quotes.current(instrument, 1L)).thenReturn(new ExecutionQuoteSource.Quote(BigDecimal.TEN, 1L, at.plusSeconds(2)));
        when(execution.evaluate(eq(1), eq(instrument), any())).thenReturn(order);
        when(ticks.between(anyLong(), anyString(), any(), any())).thenReturn(List.of());
    }
    @Test void resumesEveryCrossedTickAfterRestartWithoutNeedingABrowser() {
        order.setEvaluatedAt(at.plusSeconds(1));
        var tick = new ExecutionQuoteSource.Quote(BigDecimal.TEN, 1L, at.plusSeconds(2));
        when(ticks.between(1L, "AAPL", at.plusSeconds(1), at.plusSeconds(2))).thenReturn(List.of(tick));
        evaluator.evaluate(); verify(execution).evaluate(1, instrument, tick);
    }
    @Test void replaysInitialEvaluationOnlyForOrdersStillAtSubmission() {
        evaluator.evaluate(); verify(execution).evaluate(1, instrument, new ExecutionQuoteSource.Quote(BigDecimal.TEN, 1L, at));
    }
    @Test void respectsBackoffAndDoesNotExecuteBeforeSubmission() {
        order.setRetryAfter(OffsetDateTime.now().plusMinutes(1)); evaluator.evaluate(); verifyNoInteractions(execution);
        order.setRetryAfter(null);
        when(quotes.current(instrument, 1L)).thenReturn(new ExecutionQuoteSource.Quote(BigDecimal.TEN, 1L, at.minusSeconds(1)));
        evaluator.evaluate(); verifyNoInteractions(execution);
    }
    @Test void quoteOutagesKeepReservationsAndUnexpectedFailuresAreAudited() {
        when(quotes.current(instrument, 1L)).thenThrow(new ExecutionQuoteSource.QuoteUnavailableException());
        evaluator.evaluate(); verifyNoInteractions(execution, submissions);
        var failure = new IllegalStateException("storage unavailable");
        doThrow(failure).when(quotes).current(instrument, 1L);
        evaluator.evaluate(); verify(submissions).recordExecutionFailure(1, failure);
    }
    @Test void stopsEvaluatingOnceAnOrderReachesATerminalState() {
        Order filled = new Order(); filled.setStatus("FILLED");
        when(execution.evaluate(eq(1), eq(instrument), any())).thenReturn(filled);
        evaluator.evaluate(); verifyNoInteractions(ticks);
    }
    @Test void marketRetriesUseTheCurrentQuoteRatherThanTheSubmissionQuote() {
        order.setExecutionType("MARKET");
        evaluator.evaluate();
        verify(execution).evaluate(1, instrument, new ExecutionQuoteSource.Quote(BigDecimal.TEN, 1L, at.plusSeconds(2)));
        verifyNoInteractions(ticks);
    }
    @Test void rewindNeverReplaysTicksBehindTheWatermark() {
        order.setEvaluatedAt(at.plusHours(1));
        evaluator.evaluate();
        verify(ticks).between(1L, "AAPL", at.plusHours(1), at.plusSeconds(2));
        verifyNoInteractions(execution);
    }
    @Test void sessionMismatchNeverEvaluatesOrExpiresAnOrder() {
        when(quotes.current(instrument, 1L)).thenReturn(new ExecutionQuoteSource.Quote(BigDecimal.TEN, 2L, at.plusDays(1)));
        evaluator.evaluate(); verifyNoInteractions(execution, ticks);
    }
    @Test void forwardSeekProcessesPreCloseTicksBeforeExpiry() {
        order.setEvaluatedAt(at.plusSeconds(1));
        var current = new ExecutionQuoteSource.Quote(BigDecimal.TEN, 1L, at.plusDays(1));
        var crossed = new ExecutionQuoteSource.Quote(BigDecimal.TEN, 1L, at.plusSeconds(2));
        when(quotes.current(instrument, 1L)).thenReturn(current);
        when(ticks.between(eq(1L), eq("AAPL"), any(), any())).thenReturn(List.of(crossed));
        when(execution.evaluate(1, instrument, crossed)).thenAnswer(call -> { order.setEvaluatedAt(crossed.timestamp()); return order; });
        evaluator.evaluate();
        var sequence = inOrder(execution);
        sequence.verify(execution).evaluate(1, instrument, crossed);
        sequence.verify(execution).evaluate(1, instrument, current);
        verify(ticks).between(1L, "AAPL", at.plusSeconds(1), ExecutionPolicy.expiresAt(order).minusNanos(1));
    }
    @Test void fullCatchUpBatchDoesNotExpireBeforeRemainingTicks() {
        order.setEvaluatedAt(at.plusSeconds(1));
        var current = new ExecutionQuoteSource.Quote(BigDecimal.TEN, 1L, at.plusDays(1));
        var crossed = new ExecutionQuoteSource.Quote(BigDecimal.TEN, 1L, at.plusSeconds(2));
        when(quotes.current(instrument, 1L)).thenReturn(current);
        when(ticks.between(anyLong(), anyString(), any(), any())).thenReturn(java.util.Collections.nCopies(1000, crossed));
        when(execution.evaluate(1, instrument, crossed)).thenAnswer(call -> { order.setEvaluatedAt(crossed.timestamp()); return order; });
        evaluator.evaluate();
        verify(execution, never()).evaluate(1, instrument, current);
    }

}
