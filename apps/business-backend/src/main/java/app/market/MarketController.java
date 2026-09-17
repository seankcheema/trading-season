package app.market;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.concurrent.TimeUnit;

/** Public, read-only endpoints for simulated stock snapshots, charts, and live ticks. */
@RestController
@RequestMapping("/api/market")
public class MarketController {
    private final MarketReplayService service;

    /**
     * Creates the controller backed by the shared replay service.
     * @param service market replay service
     */
    public MarketController(MarketReplayService service) { this.service = service; }

    /**
     * Returns current prices for every stock at the shared replay cursor.
     * @param sessionId optional completed simulation identifier
     * @return the current synchronized stock snapshot
     */
    @GetMapping("/snapshot")
    public ResponseEntity<MarketResponses.Snapshot> snapshot(
            @RequestParam(required = false) Long sessionId) {
        return ResponseEntity.ok().cacheControl(CacheControl.maxAge(1, TimeUnit.SECONDS).cachePrivate())
                .body(service.snapshot(sessionId));
    }

    /**
     * Returns a bounded OHLCV series for one stock and supported timeframe.
     * @param sessionId optional completed simulation identifier
     * @param symbol seeded stock symbol
     * @param timeframe supported public timeframe value
     * @return the aggregated candle series
     */
    @GetMapping("/candles")
    public ResponseEntity<MarketResponses.CandleSeries> candles(
            @RequestParam(required = false) Long sessionId,
            @RequestParam String symbol,
            @RequestParam String timeframe) {
        return ResponseEntity.ok().cacheControl(CacheControl.maxAge(5, TimeUnit.SECONDS).cachePrivate())
                .body(service.candles(sessionId, symbol, timeframe));
    }

    /**
     * Moves the shared simulated market clock to a seeded trading timestamp.
     * @param sessionId optional completed simulation identifier
     * @param request requested market timestamp
     * @return a synchronized snapshot at the selected timestamp
     */
    @PutMapping("/clock")
    public ResponseEntity<MarketResponses.Snapshot> setClock(
            @RequestParam(required = false) Long sessionId,
            @RequestBody MarketResponses.ClockRequest request) {
        if (request == null || request.timestamp() == null) {
            throw new MarketRequestException("timestamp is required");
        }
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(service.setClock(sessionId, request.timestamp()));
    }

    /**
     * Opens a server-sent event stream of synchronized one-second stock batches.
     * @param sessionId optional completed simulation identifier
     * @param lastEventId optional event cursor supplied during reconnection
     * @param request servlet request used to enforce per-client connection limits
     * @return the open event emitter
     */
    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream(@RequestParam(required = false) Long sessionId,
            @RequestHeader(value = "Last-Event-ID", required = false) Long lastEventId,
            HttpServletRequest request) {
        return service.subscribe(sessionId, request.getRemoteAddr(), lastEventId);
    }
}
