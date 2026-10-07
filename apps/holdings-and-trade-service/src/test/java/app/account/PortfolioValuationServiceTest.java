package app.account;

import app.auth.ForbiddenException;
import app.holding.*;
import app.instrument.Instrument;
import app.market.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class PortfolioValuationServiceTest {
    private final AccountService accounts = mock(AccountService.class);
    private final AccountRepository repository = mock(AccountRepository.class);
    private final HoldingMovementRepository movements = mock(HoldingMovementRepository.class);
    private final PortfolioValuationRepository valuations = mock(PortfolioValuationRepository.class);
    private final MarketReplayService market = mock(MarketReplayService.class);
    private final UUID user = UUID.randomUUID();
    private final Instant now = Instant.parse("2026-10-01T18:00:30Z");
    private final PortfolioValuationService service = new PortfolioValuationService(accounts, repository,
            movements, valuations, market, Clock.fixed(now, ZoneOffset.UTC));

    @BeforeEach
    void setup() {
        Account owned = new Account();
        owned.setUserId(user);
        when(repository.findByIdForUpdate(1)).thenReturn(Optional.of(owned));
        when(movements.hasAcquisitions(1)).thenReturn(true);
        when(valuations.findFirstByAccountIdOrderByObservedAtDescIdDesc(1)).thenReturn(Optional.empty());
        when(valuations.save(any())).thenAnswer(call -> call.getArgument(0));
        when(market.snapshot(null)).thenThrow(new MarketRequestException("No replay data"));
    }

    private HoldingWithCost holding(String symbol, String quantity, String cost) {
        Holding holding = new Holding();
        holding.setQuantity(new BigDecimal(quantity));
        Instrument instrument = new Instrument();
        instrument.setTicker(symbol);
        return new HoldingWithCost(holding, instrument, cost == null ? null : new BigDecimal(cost));
    }

    @Test
    void captureUsesRealTimeAndFractionalHoldingsWithCostFallback() {
        when(accounts.getHoldingsForAccount(1, user)).thenReturn(List.of(holding("ABC", "2.5", "40.20")));
        var result = service.capture(1, user, false);
        assertEquals(now, result.timestamp());
        assertEquals(0, new BigDecimal("100.50").compareTo(result.value()));
    }

    @Test
    void captureUsesMarketPricesAndDoesNotUseReplayTimestamp() {
        when(accounts.getHoldingsForAccount(1, user)).thenReturn(List.of(holding("ABC", "2", "40")));
        doReturn(new MarketResponses.Snapshot(1, "OPEN",
                Instant.parse("2026-01-05T16:00:00Z"), now, null,
                List.of(new MarketResponses.StockSnapshot("ABC", "ABC", new BigDecimal("55"),
                        BigDecimal.ZERO, BigDecimal.ZERO, now)))).when(market).snapshot(null);
        var result = service.capture(1, user, false);
        assertEquals(now, result.timestamp());
        assertEquals(0, new BigDecimal("110").compareTo(result.value()));
    }

    @Test
    void noAcquisitionsMeansNoObservationAndNoMarketRequest() {
        when(movements.hasAcquisitions(1)).thenReturn(false);
        assertNull(service.capture(1, user, false));
        verifyNoInteractions(market, valuations);
    }

    @Test
    void liquidationAndUnknownCostsRecordZero() {
        when(accounts.getHoldingsForAccount(1, user)).thenReturn(List.of(holding("ABC", "0", "40"),
                new HoldingWithCost(holding("ABC", "1", null).holding(), null, null)));
        assertEquals(0, service.capture(1, user, false).value().signum());
        when(accounts.getHoldingsForAccount(1, user)).thenReturn(List.of());
        assertEquals(0, service.capture(1, user, false).value().signum());
    }

    @Test
    void scheduledCaptureCoalescesSameMinuteButExplicitCaptureRemainsFresh() {
        when(valuations.findFirstByAccountIdOrderByObservedAtDescIdDesc(1))
                .thenReturn(Optional.of(new PortfolioValuation(1, now.minusSeconds(10), BigDecimal.TEN)));
        assertEquals(BigDecimal.TEN, service.capture(1, user, true).value());
        verify(valuations, never()).save(any());
        assertEquals(now, service.capture(1, user, false).timestamp());
        verify(valuations).save(any());
    }

    @Test
    void scheduledCaptureInNextMinuteRecordsAgain() {
        when(valuations.findFirstByAccountIdOrderByObservedAtDescIdDesc(1))
                .thenReturn(Optional.of(new PortfolioValuation(1, now.minusSeconds(60), BigDecimal.TEN)));
        assertEquals(now, service.capture(1, user, true).timestamp());
        verify(valuations).save(any());
    }

    @Test
    void historyKeepsLatestActualTimestampPerBucket() {
        Instant first = now.minusSeconds(120);
        Instant second = first.plusSeconds(10);
        when(valuations.findByAccountIdAndObservedAtBetweenOrderByObservedAtAscIdAsc(eq(1), any(), any()))
                .thenReturn(List.of(new PortfolioValuation(1, first, BigDecimal.TEN),
                        new PortfolioValuation(1, second, BigDecimal.ONE),
                        new PortfolioValuation(1, now, BigDecimal.ZERO)));
        var points = service.history(1, user, "1D");
        assertEquals(List.of(second, now), points.stream().map(PortfolioValuationService.Point::timestamp).toList());
        assertEquals(BigDecimal.ZERO, points.get(1).value());
        verify(valuations).findByAccountIdAndObservedAtBetweenOrderByObservedAtAscIdAsc(1, now.minus(Duration.ofDays(1)), now);
    }

    @Test
    void historyIsZeroBeforeFirstInvestmentAndCarriesLatestValueToNow() {
        Instant purchase = now.minusSeconds(300);
        when(movements.firstAcquisitionAt(1)).thenReturn(purchase);
        when(valuations.findByAccountIdAndObservedAtBetweenOrderByObservedAtAscIdAsc(eq(1), any(), any()))
                .thenReturn(List.of(new PortfolioValuation(1, purchase.plusSeconds(1), BigDecimal.TEN)));
        var points = service.history(1, user, "1D");
        assertEquals(4, points.size());
        assertEquals(now.minus(Duration.ofDays(1)), points.getFirst().timestamp());
        assertEquals(BigDecimal.ZERO, points.get(1).value());
        assertEquals(purchase.minusMillis(1), points.get(1).timestamp());
        assertEquals(BigDecimal.TEN, points.getLast().value());
        assertEquals(now, points.getLast().timestamp());
    }

    @Test
    void investmentsBeforeRangeOrAfterFirstObservationDoNotCreateFalseZeroHistory() {
        when(valuations.findByAccountIdAndObservedAtBetweenOrderByObservedAtAscIdAsc(eq(1), any(), any()))
                .thenReturn(List.of(new PortfolioValuation(1, now.minusSeconds(60), BigDecimal.TEN)));
        for (Instant purchase : List.of(now.minus(Duration.ofDays(2)), now)) {
            when(movements.firstAcquisitionAt(1)).thenReturn(purchase);
            var points = service.history(1, user, "1D");
            assertEquals(2, points.size());
            assertTrue(points.stream().allMatch(point -> point.value().equals(BigDecimal.TEN)));
        }
    }

    @Test
    void emptyHistoryAndInvalidTimeframe() {
        assertTrue(service.history(1, user, "1Y").isEmpty());
        assertThrows(IllegalArgumentException.class, () -> service.history(1, user, "invalid"));
    }

    @Test
    void ownershipIsCheckedBeforeReadingOrWriting() {
        Account other = new Account();
        other.setUserId(UUID.randomUUID());
        when(repository.findByIdForUpdate(1)).thenReturn(Optional.of(other));
        when(accounts.getAccountForUser(1, user)).thenThrow(new ForbiddenException("Forbidden"));
        assertThrows(ForbiddenException.class, () -> service.capture(1, user, false));
        assertThrows(ForbiddenException.class, () -> service.history(1, user, "1D"));
        verify(repository).findByIdForUpdate(1);
        verifyNoInteractions(valuations, market, movements);
    }

    @Test
    void archivedAccountSkipsScheduledCaptureAndRejectsManualCapture() {
        Account archived = new Account();
        archived.setUserId(user);
        archived.setArchivedAt(now);
        when(repository.findByIdForUpdate(1)).thenReturn(Optional.of(archived));
        assertNull(service.capture(1, user, true));
        var error = assertThrows(org.springframework.web.server.ResponseStatusException.class,
                () -> service.capture(1, user, false));
        assertEquals(409, error.getStatusCode().value());
        verify(valuations, never()).save(any());
    }

    @Test
    void disappearedAccountIsNotCaptured() {
        when(repository.findByIdForUpdate(1)).thenReturn(Optional.empty());
        assertThrows(AccountNotFoundException.class, () -> service.capture(1, user, false));
    }

    @Test
    void schedulerCapturesPurchasedAccountsWithoutADashboardAndContinuesAfterFailure() {
        var capture = mock(PortfolioValuationService.class);
        when(movements.acquiredAccountIds()).thenReturn(List.of(1, 2, 3));
        Account account = new Account();
        account.setUserId(user);
        when(repository.findById(1)).thenReturn(Optional.of(account));
        when(repository.findById(2)).thenReturn(Optional.of(account));
        when(repository.findById(3)).thenReturn(Optional.empty());
        when(capture.capture(1, user, true)).thenThrow(new IllegalStateException("Unavailable"));
        new PortfolioValuationScheduler(movements, repository, capture).captureAccounts();
        verify(capture).capture(2, user, true);
        verify(capture, never()).capture(eq(3), any(), anyBoolean());
    }
}
