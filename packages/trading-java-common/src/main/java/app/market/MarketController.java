package app.market;

import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.Operation;
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

/** Public simulated market reads and authenticated shared replay clock control. */
@RestController
@RequestMapping("/api/market")
@Tag(name = "Market Data", description = "Market data and trading simulation endpoints")
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
    @Operation(summary = "Get current market snapshot", description = "Returns current prices for all stocks at the current market time")
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
    @Operation(summary = "Get OHLCV candle data", description = "Retrieves Open-High-Low-Close-Volume (OHLCV) data for a stock in the specified timeframe")
    public ResponseEntity<MarketResponses.CandleSeries> candles(
            @RequestParam(required = false) Long sessionId,
            @RequestParam String symbol,
            @RequestParam String timeframe) {
        return ResponseEntity.ok().cacheControl(CacheControl.maxAge(5, TimeUnit.SECONDS).cachePrivate())
                .body(service.candles(sessionId, symbol, timeframe));
    }

    /**
     * Moves the shared simulated market clock to a seeded trading timestamp.
     * The security filter requires an authenticated caller for this mutation.
     * @param sessionId optional completed simulation identifier
     * @param request requested market timestamp
     * @return a synchronized snapshot at the selected timestamp
     */
    @PutMapping("/clock")
    @Operation(summary = "Set market clock", description = "Moves the simulated market clock to a specific trading timestamp (authenticated users only)")
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
    @Operation(summary = "Subscribe to market data stream", description = "Opens a server-sent event stream for real-time synchronized market data updates")
    public SseEmitter stream(@RequestParam(required = false) Long sessionId,
            @RequestHeader(value = "Last-Event-ID", required = false) Long lastEventId,
            HttpServletRequest request) {
        return service.subscribe(sessionId, request.getRemoteAddr(), lastEventId);
    }
}
