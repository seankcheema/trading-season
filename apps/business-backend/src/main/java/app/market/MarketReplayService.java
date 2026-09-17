package app.market;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

import static app.market.MarketResponses.*;

/** Maintains shared simulation cursors and publishes bounded market-data responses. */
@Service
public class MarketReplayService {
    private static final ZoneId MARKET_ZONE = ZoneId.of("America/Chicago");
    private static final LocalTime MARKET_OPEN = LocalTime.of(8, 30);
    private static final LocalTime MARKET_CLOSE = LocalTime.of(14, 59, 59);
    private static final int EVENT_HISTORY = 30;
    private static final int MAX_POINTS = 500;

    private final MarketDataSource repository;
    private final Clock clock;
    private final Instant configuredStart;
    private final int maxStreamsPerClient;
    private final int maxStreamsGlobal;
    private final Map<Long, ReplayState> states = new ConcurrentHashMap<>();
    private final Map<String, Integer> clientStreams = new HashMap<>();

    @Autowired
    MarketReplayService(MarketDataSource repository,
            @Value("${market.replay.start-at:}") String startAt,
            @Value("${market.limits.streams-per-client:3}") int maxStreamsPerClient,
            @Value("${market.limits.streams-global:200}") int maxStreamsGlobal) {
        this(repository, Clock.systemUTC(), startAt, maxStreamsPerClient, maxStreamsGlobal);
    }

    MarketReplayService(MarketDataSource repository, Clock clock, String startAt,
                        int maxStreamsPerClient, int maxStreamsGlobal) {
        this.repository = repository;
        this.clock = clock;
        this.configuredStart = startAt == null || startAt.isBlank() ? null : Instant.parse(startAt);
        this.maxStreamsPerClient = maxStreamsPerClient;
        this.maxStreamsGlobal = maxStreamsGlobal;
    }

    /**
     * Returns the current prices and replay cursor for a completed simulation.
     * @param requestedSessionId optional completed simulation identifier
     * @return synchronized prices at the current cursor
     */
    public Snapshot snapshot(Long requestedSessionId) {
        ReplayState state = state(requestedSessionId);
        synchronized (state) {
            MarketModels.Frame frame = state.currentFrame();
            Map<String, BigDecimal> opening = state.openingPrices();
            Map<String, String> names = new HashMap<>();
            repository.stocks().forEach(stock -> names.put(stock.symbol(), stock.companyName()));
            List<StockSnapshot> stocks = frame.prices().stream().map(tick -> {
                BigDecimal open = opening.getOrDefault(tick.symbol(), tick.price());
                BigDecimal change = tick.price().subtract(open);
                BigDecimal percent = open.signum() == 0 ? BigDecimal.ZERO
                        : change.multiply(BigDecimal.valueOf(100)).divide(open, 4, RoundingMode.HALF_UP);
                return new StockSnapshot(tick.symbol(), names.getOrDefault(tick.symbol(), tick.symbol()),
                        tick.price(), change, percent, tick.timestamp());
            }).toList();
            return new Snapshot(state.session.id(), "OPEN", frame.timestamp(), clock.instant(),
                    availability(state), stocks);
        }
    }

    /**
     * Returns a bounded, aggregated candle series ending at the replay cursor.
     * @param requestedSessionId optional completed simulation identifier
     * @param symbol seeded stock symbol
     * @param timeframeValue supported public timeframe value
     * @return at most 500 aggregated points
     */
    public CandleSeries candles(Long requestedSessionId, String symbol, String timeframeValue) {
        ReplayState state = state(requestedSessionId);
        MarketTimeframe timeframe = MarketTimeframe.parse(timeframeValue);
        String normalizedSymbol = symbol == null ? "" : symbol.trim().toUpperCase();
        if (normalizedSymbol.isEmpty() || repository.stocks().stream().noneMatch(s -> s.symbol().equals(normalizedSymbol))) {
            throw new MarketRequestException("Unknown stock symbol");
        }
        Instant cursor;
        Instant from;
        synchronized (state) {
            cursor = state.currentFrame().timestamp();
            from = rangeStart(state, timeframe, cursor);
        }
        List<MarketModels.Candle> raw = repository.candles(state.session.id(), normalizedSymbol, from, cursor);
        List<CandlePoint> points = aggregate(raw, timeframe);
        if (points.size() > MAX_POINTS) points = points.subList(points.size() - MAX_POINTS, points.size());
        return new CandleSeries(state.session.id(), normalizedSymbol, timeframeValue, cursor, points);
    }

    /**
     * Seeks the shared replay cursor to the closest seeded tick at or before an instant.
     * Requests for non-trading dates inside an imported month use the nearest seeded day
     * in that month, preferring the next seeded day.
     * @param requestedSessionId optional completed simulation identifier
     * @param timestamp desired simulated market timestamp
     * @return synchronized prices at the selected cursor
     * @throws MarketRequestException when the month has no seeded trading data
     */
    public Snapshot setClock(Long requestedSessionId, Instant timestamp) {
        ReplayState state = state(requestedSessionId);
        ZonedDateTime requestedMarketTime = timestamp.atZone(MARKET_ZONE);
        LocalDate requestedDay = requestedMarketTime.toLocalDate();
        synchronized (state) {
            LocalDate day = resolveReplayDay(state.days, requestedDay);
            int dayIndex = state.days.indexOf(day);
            if (dayIndex < 0) {
                throw new MarketRequestException("Selected date has no seeded trading data");
            }
            Instant replayTimestamp = day.atTime(requestedMarketTime.toLocalTime())
                    .atZone(MARKET_ZONE)
                    .toInstant();
            List<MarketModels.Frame> frames = requireFrames(state.session, day);
            int frameIndex = 0;
            for (int i = 0; i < frames.size(); i++) {
                if (!frames.get(i).timestamp().isAfter(replayTimestamp)) frameIndex = i;
                else break;
            }
            state.dayIndex = dayIndex;
            state.frames = frames;
            state.frameIndex = frameIndex;
            state.opening = null;
            state.history.clear();
        }
        return snapshot(state.session.id());
    }

    /**
     * Registers an SSE client and replays recoverable missed events when possible.
     * @param requestedSessionId optional completed simulation identifier
     * @param clientId stable client address used for connection limiting
     * @param lastEventId optional last received event identifier
     * @return the registered emitter
     */
    public SseEmitter subscribe(Long requestedSessionId, String clientId, Long lastEventId) {
        ReplayState state = state(requestedSessionId);
        SseEmitter emitter = new SseEmitter(0L);
        synchronized (clientStreams) {
            int global = clientStreams.values().stream().mapToInt(Integer::intValue).sum();
            int current = clientStreams.getOrDefault(clientId, 0);
            if (global >= maxStreamsGlobal || current >= maxStreamsPerClient) {
                throw new MarketLimitException("Market stream connection limit reached");
            }
            clientStreams.put(clientId, current + 1);
        }
        Subscriber subscriber = new Subscriber(clientId, emitter);
        Runnable cleanup = () -> remove(state, subscriber);
        emitter.onCompletion(cleanup);
        emitter.onTimeout(cleanup);
        emitter.onError(ignored -> cleanup.run());
        synchronized (state) {
            try {
                if (lastEventId != null) replayMissed(state, emitter, lastEventId);
                send(emitter, "snapshot", null, snapshot(state.session.id()));
                state.subscribers.add(subscriber);
            } catch (IOException ex) {
                releaseClient(clientId);
                emitter.completeWithError(ex);
            } catch (RuntimeException ex) {
                releaseClient(clientId);
                throw ex;
            }
        }
        return emitter;
    }

    /** Advances every active simulation cursor and publishes the next synchronized batch. */
    @Scheduled(fixedRateString = "${market.replay.tick-millis:1000}")
    public void advance() {
        states.values().forEach(this::advanceState);
    }

    private ReplayState state(Long requestedId) {
        MarketModels.Session session = repository.resolveSession(requestedId);
        return states.computeIfAbsent(session.id(), ignored -> initialize(session));
    }

    private ReplayState initialize(MarketModels.Session session) {
        List<LocalDate> days = repository.tradingDays(session.id());
        if (days.isEmpty()) throw new MarketRequestException("Simulation has no candle data");
        Instant desired = configuredStart == null ? clock.instant() : configuredStart;
        LocalDate desiredDay = desired.atZone(MARKET_ZONE).toLocalDate();
        LocalDate day = days.stream().filter(value -> !value.isAfter(desiredDay)).max(Comparator.naturalOrder())
                .orElse(days.getLast());
        List<MarketModels.Frame> frames = requireFrames(session, day);
        int index = 0;
        if (day.equals(desiredDay)) {
            for (int i = 0; i < frames.size(); i++) {
                if (!frames.get(i).timestamp().isAfter(desired)) index = i;
                else break;
            }
        }
        return new ReplayState(session, days, days.indexOf(day), frames, index);
    }

    private void advanceState(ReplayState state) {
        TickEvent event;
        synchronized (state) {
            if (++state.frameIndex >= state.frames.size()) {
                state.dayIndex = (state.dayIndex + 1) % state.days.size();
                state.frames = requireFrames(state.session, state.days.get(state.dayIndex));
                state.frameIndex = 0;
                state.opening = null;
            }
            MarketModels.Frame frame = state.currentFrame();
            long id = ++state.nextEventId;
            event = new TickEvent(id, frame.timestamp(), clock.instant(), frame.prices().stream()
                    .map(t -> new TickPrice(t.symbol(), t.price(), t.sequenceNumber())).toList());
            state.history.addLast(event);
            while (state.history.size() > EVENT_HISTORY) state.history.removeFirst();
        }
        for (Subscriber subscriber : List.copyOf(state.subscribers)) {
            try {
                send(subscriber.emitter, "market-tick", event.eventId(), event);
            } catch (IOException ex) {
                remove(state, subscriber);
                subscriber.emitter.completeWithError(ex);
            }
        }
        if (event.eventId() % 15 == 0) {
            for (Subscriber subscriber : List.copyOf(state.subscribers)) {
                try {
                    send(subscriber.emitter, "heartbeat", null, Map.of("serverTimestamp", clock.instant()));
                } catch (IOException ex) {
                    remove(state, subscriber);
                }
            }
        }
    }

    private List<MarketModels.Frame> requireFrames(MarketModels.Session session, LocalDate day) {
        List<MarketModels.Frame> frames;
        try {
            frames = repository.ticksForDay(session, day);
        } catch (RuntimeException | LinkageError ex) {
            throw new MarketRequestException("Selected date has no replay prices available");
        }
        if (frames.isEmpty()) throw new MarketRequestException("Selected date has no replay prices available");
        return frames;
    }

    private LocalDate resolveReplayDay(List<LocalDate> days, LocalDate requestedDay) {
        if (days.contains(requestedDay)) return requestedDay;
        YearMonth requestedMonth = YearMonth.from(requestedDay);
        return days.stream()
                .filter(day -> YearMonth.from(day).equals(requestedMonth))
                .filter(day -> !day.isBefore(requestedDay))
                .findFirst()
                .or(() -> days.stream()
                        .filter(day -> YearMonth.from(day).equals(requestedMonth))
                        .filter(day -> !day.isAfter(requestedDay))
                        .reduce((first, second) -> second))
                .orElse(requestedDay);
    }

    private Instant rangeStart(ReplayState state, MarketTimeframe timeframe, Instant cursor) {
        if (timeframe == MarketTimeframe.ONE_DAY) {
            return cursor.atZone(MARKET_ZONE).toLocalDate().atTime(MARKET_OPEN).atZone(MARKET_ZONE).toInstant();
        }
        if (timeframe == MarketTimeframe.FIVE_DAYS) {
            LocalDate current = cursor.atZone(MARKET_ZONE).toLocalDate();
            List<LocalDate> eligible = state.days.stream().filter(day -> !day.isAfter(current)).toList();
            LocalDate first = eligible.get(Math.max(0, eligible.size() - 5));
            return first.atTime(MARKET_OPEN).atZone(MARKET_ZONE).toInstant();
        }
        return cursor.minus(timeframe.lookback());
    }

    private CalendarAvailability availability(ReplayState state) {
        LocalDate first = state.days.getFirst();
        LocalDate last = state.days.getLast();
        return new CalendarAvailability(MARKET_ZONE.getId(),
                first.atTime(MARKET_OPEN).atZone(MARKET_ZONE).toInstant(),
                last.atTime(MARKET_CLOSE).atZone(MARKET_ZONE).toInstant(),
                state.days);
    }

    private List<CandlePoint> aggregate(List<MarketModels.Candle> raw, MarketTimeframe timeframe) {
        Map<Instant, MutableCandle> buckets = new java.util.LinkedHashMap<>();
        for (MarketModels.Candle candle : raw) {
            Instant key = bucketStart(candle.timestamp(), timeframe);
            buckets.computeIfAbsent(key, ignored -> new MutableCandle(candle)).add(candle);
        }
        return buckets.entrySet().stream().map(entry -> entry.getValue().toPoint(entry.getKey())).toList();
    }

    private Instant bucketStart(Instant instant, MarketTimeframe timeframe) {
        if (timeframe == MarketTimeframe.ONE_YEAR) {
            return instant.atZone(MARKET_ZONE).toLocalDate().atStartOfDay(MARKET_ZONE).toInstant();
        }
        long seconds = timeframe.bucket().toSeconds();
        return Instant.ofEpochSecond(Math.floorDiv(instant.getEpochSecond(), seconds) * seconds);
    }

    private void replayMissed(ReplayState state, SseEmitter emitter, long lastId) throws IOException {
        if (!state.history.isEmpty() && lastId < state.history.getFirst().eventId()) {
            send(emitter, "resync", null, Map.of("reason", "event-history-expired"));
            return;
        }
        for (TickEvent event : state.history) {
            if (event.eventId() > lastId) send(emitter, "market-tick", event.eventId(), event);
        }
    }

    private void send(SseEmitter emitter, String name, Long id, Object data) throws IOException {
        SseEmitter.SseEventBuilder event = SseEmitter.event().name(name).data(data);
        if (id != null) event.id(Long.toString(id));
        emitter.send(event);
    }

    private void remove(ReplayState state, Subscriber subscriber) {
        if (!state.subscribers.remove(subscriber)) return;
        releaseClient(subscriber.clientId);
    }

    private void releaseClient(String clientId) {
        synchronized (clientStreams) {
            int next = clientStreams.getOrDefault(clientId, 1) - 1;
            if (next <= 0) clientStreams.remove(clientId); else clientStreams.put(clientId, next);
        }
    }

    private static final class ReplayState {
        final MarketModels.Session session;
        final List<LocalDate> days;
        final List<Subscriber> subscribers = new CopyOnWriteArrayList<>();
        final ArrayDeque<TickEvent> history = new ArrayDeque<>();
        int dayIndex;
        List<MarketModels.Frame> frames;
        int frameIndex;
        Map<String, BigDecimal> opening;
        long nextEventId;

        ReplayState(MarketModels.Session session, List<LocalDate> days, int dayIndex,
                    List<MarketModels.Frame> frames, int frameIndex) {
            this.session = session; this.days = days; this.dayIndex = dayIndex;
            this.frames = frames; this.frameIndex = frameIndex;
        }

        MarketModels.Frame currentFrame() { return frames.get(frameIndex); }

        Map<String, BigDecimal> openingPrices() {
            if (opening == null) {
                opening = new HashMap<>();
                frames.getFirst().prices().forEach(tick -> opening.put(tick.symbol(), tick.price()));
            }
            return opening;
        }
    }

    private record Subscriber(String clientId, SseEmitter emitter) { }

    private static final class MutableCandle {
        final BigDecimal open;
        BigDecimal high;
        BigDecimal low;
        BigDecimal close;
        long volume;
        boolean first = true;

        MutableCandle(MarketModels.Candle candle) {
            open = candle.open(); high = candle.high(); low = candle.low(); close = candle.close();
        }

        void add(MarketModels.Candle candle) {
            if (!first) {
                high = high.max(candle.high()); low = low.min(candle.low()); close = candle.close();
            }
            volume += candle.volume(); first = false;
        }

        CandlePoint toPoint(Instant timestamp) { return new CandlePoint(timestamp, open, high, low, close, volume); }
    }
}
