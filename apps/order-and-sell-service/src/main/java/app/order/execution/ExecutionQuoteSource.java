package app.order.execution;

import app.instrument.Instrument;
import app.market.MarketResponses;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import java.net.http.HttpClient;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.math.BigDecimal;

/** Reads the same authoritative replay clock the trading UI uses. */
@Component
public class ExecutionQuoteSource {
    private final RestClient client;
    /** Configures a bounded server-side market connection.
     * @param baseUrl Holdings and Trade service origin */
    public ExecutionQuoteSource(@Value("${app.execution.market-url:http://localhost:8082}") String baseUrl) {
        var factory = new JdkClientHttpRequestFactory(HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build());
        factory.setReadTimeout(Duration.ofSeconds(5));
        client = RestClient.builder().baseUrl(baseUrl).requestFactory(factory).build();
    }
    /** Reads an instrument quote at the current authoritative cursor.
     * @param instrument stock instrument
     * @param sessionId optional session
     * @return synchronized server quote
     * @throws QuoteUnavailableException when market data is missing or invalid */
    public Quote current(Instrument instrument, Long sessionId) {
        try {
            var snapshot = client.get().uri("/api/market/snapshot" + (sessionId == null ? "" : "?sessionId=" + sessionId))
                    .retrieve().body(MarketResponses.Snapshot.class);
            if (snapshot == null || snapshot.marketTimestamp() == null || snapshot.stocks() == null
                    || (sessionId != null && snapshot.sessionId() != sessionId)) throw new QuoteUnavailableException();
            String symbol = instrument.getSimulatedStockSymbol();
            if (symbol == null) throw new QuoteUnavailableException();
            var stock = snapshot.stocks().stream().filter(s -> symbol.equalsIgnoreCase(s.symbol())).findFirst()
                    .orElseThrow(QuoteUnavailableException::new);
            if (stock.price() == null || stock.price().signum() <= 0 || !snapshot.marketTimestamp().equals(stock.timestamp()))
                throw new QuoteUnavailableException();
            return new Quote(stock.price(), snapshot.sessionId(), stock.timestamp().atOffset(ZoneOffset.UTC));
        } catch (QuoteUnavailableException ex) { throw ex; }
        catch (RuntimeException ex) { throw new QuoteUnavailableException(); }
    }
    /** An immutable authoritative quote.
     * @param price market price
     * @param sessionId simulation identifier
     * @param timestamp simulated quote position */
    public record Quote(BigDecimal price, long sessionId, OffsetDateTime timestamp) { }
    /** Market data cannot currently authorize a trade. */
    public static class QuoteUnavailableException extends RuntimeException {
        private static final long serialVersionUID = 1L;
        /** Creates a safe message for clients. */
        public QuoteUnavailableException() { super("Market price unavailable. Please try again."); }
    }
}
