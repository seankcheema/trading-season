package app.account;

import app.holding.HoldingMovementRepository;
import app.market.MarketReplayService;
import app.market.MarketRequestException;
import app.market.MarketTimeframe;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

/** Captures current holdings on real dates, independently of the replay calendar. */
@Service
public class PortfolioValuationService {
    private final AccountService accounts;
    private final AccountRepository accountRepository;
    private final HoldingMovementRepository movements;
    private final PortfolioValuationRepository valuations;
    private final MarketReplayService market;
    private final Clock clock;

    /**
     * Creates the valuation service using the actual UTC clock.
     * @param accounts owned-account holdings and cost basis
     * @param accountRepository account locking
     * @param movements existing acquisition ledger
     * @param valuations persisted observations
     * @param market current replay prices
     */
    @Autowired
    public PortfolioValuationService(AccountService accounts, AccountRepository accountRepository,
            HoldingMovementRepository movements, PortfolioValuationRepository valuations,
            MarketReplayService market) {
        this(accounts, accountRepository, movements, valuations, market, Clock.systemUTC());
    }

    PortfolioValuationService(AccountService accounts, AccountRepository accountRepository,
            HoldingMovementRepository movements, PortfolioValuationRepository valuations,
            MarketReplayService market, Clock clock) {
        this.accounts = accounts;
        this.accountRepository = accountRepository;
        this.movements = movements;
        this.valuations = valuations;
        this.market = market;
        this.clock = clock;
    }

    /**
     * Captures a current observation after checking ownership. New accounts stay empty.
     * @param accountId owned account
     * @param userId verified caller
     * @throws org.springframework.web.server.ResponseStatusException if the account is archived
     * @param scheduled whether unchanged captures in the same minute should be coalesced
     * @return observation, or null when the account has never bought shares
     * @throws AccountNotFoundException for a missing account
     * @throws app.auth.ForbiddenException for another user's account
     */
    @Transactional
    public Point capture(Integer accountId, UUID userId, boolean scheduled) {
        Account account = accountRepository.findByIdForUpdate(accountId)
                .orElseThrow(() -> new AccountNotFoundException(accountId));
        if (!account.getUserId().equals(userId))
            throw new app.auth.ForbiddenException("You do not have access to this account");
        if (scheduled && account.getArchivedAt() != null) return null;
        AccountService.requireActive(account);
        if (!movements.hasAcquisitions(accountId)) return null;
        Instant now = clock.instant();
        Optional<PortfolioValuation> previous = valuations
                .findFirstByAccountIdOrderByObservedAtDescIdDesc(accountId);
        if (scheduled && previous.isPresent() && previous.get().getObservedAt()
                .truncatedTo(ChronoUnit.MINUTES).equals(now.truncatedTo(ChronoUnit.MINUTES))) {
            return point(previous.get());
        }
        var positions = accounts.getHoldingsForAccount(accountId, userId);
        Map<String, BigDecimal> prices = new HashMap<>();
        if (positions.stream().anyMatch(position -> position.holding().getQuantity().signum() > 0)) {
            try {
                market.snapshot(null).stocks().forEach(stock -> prices.put(stock.symbol(), stock.price()));
            } catch (MarketRequestException unavailable) {
                // An account can hold instruments not covered by the replay archive.
            }
        }
        BigDecimal value = BigDecimal.ZERO;
        for (var position : positions) {
            String symbol = position.instrument() == null ? "" : position.instrument().displaySymbol();
            BigDecimal price = prices.getOrDefault(symbol,
                    position.averageCost() == null ? BigDecimal.ZERO : position.averageCost());
            value = value.add(position.holding().getQuantity().multiply(price));
        }
        return point(valuations.save(new PortfolioValuation(accountId, now, value)));
    }

    /**
     * Returns observations with a zero baseline before the first investment and the latest value carried to now.
     * @param accountId owned account
     * @param userId verified caller
     * @param timeframe supported chart range
     * @return chronological chart points, including presentation endpoints that are not persisted
     * @throws IllegalArgumentException for an unsupported timeframe
     * @throws AccountNotFoundException for a missing account
     * @throws app.auth.ForbiddenException for another user's account
     */
    @Transactional(readOnly = true)
    public List<Point> history(Integer accountId, UUID userId, String timeframe) {
        accounts.getAccountForUser(accountId, userId);
        MarketTimeframe range;
        try { range = MarketTimeframe.parse(timeframe); }
        catch (MarketRequestException invalid) { throw new IllegalArgumentException(invalid.getMessage()); }
        Instant end = clock.instant();
        Map<Long, Point> buckets = new LinkedHashMap<>();
        for (var valuation : valuations.findByAccountIdAndObservedAtBetweenOrderByObservedAtAscIdAsc(
                accountId, end.minus(range.lookback()), end)) {
            buckets.put(valuation.getObservedAt().getEpochSecond() / range.bucket().toSeconds(), point(valuation));
        }
        List<Point> points = new ArrayList<>(buckets.values());
        if (points.isEmpty()) return points;
        Instant start = end.minus(range.lookback());
        Instant firstAcquisition = movements.firstAcquisitionAt(accountId);
        if (firstAcquisition != null && firstAcquisition.isAfter(start)
                && !firstAcquisition.isAfter(points.getFirst().timestamp())) {
            points.addFirst(new Point(firstAcquisition.minusMillis(1), BigDecimal.ZERO));
            points.addFirst(new Point(start, BigDecimal.ZERO));
        }
        Point latest = points.getLast();
        if (latest.timestamp().isBefore(end)) points.add(new Point(end, latest.value()));
        return List.copyOf(points);
    }

    private static Point point(PortfolioValuation valuation) {
        return new Point(valuation.getObservedAt(), valuation.getValue());
    }

    /**
     * An observed value returned to the dashboard.
     * @param timestamp real observation time
     * @param value holdings value, excluding cash
     */
    public record Point(Instant timestamp, BigDecimal value) { }
}
