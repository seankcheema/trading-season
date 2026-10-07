package app.order.execution;

import app.instrument.Instrument;
import app.market.MarketResponses;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.net.http.HttpClient;
import java.time.Duration;
import java.time.Instant;

/** Reads execution prices from the same replay clock the client displays. */
@Component
public class ExecutionQuoteSource {
    private final String baseUrl;
    private RestClient client;

    /** Creates a bounded HTTP client without automatic application retries.
     * @param baseUrl Holdings and Trade service URL */
    @org.springframework.beans.factory.annotation.Autowired
    public ExecutionQuoteSource(@Value("${execution.market-base-url:http://localhost:8082}") String baseUrl) {
        this.baseUrl = baseUrl;
    }

    ExecutionQuoteSource(RestClient.Builder builder) { baseUrl = null; client = builder.build(); }

    private synchronized RestClient client() {
        if (client == null) {
            var factory = new JdkClientHttpRequestFactory(HttpClient.newBuilder()
                    .connectTimeout(Duration.ofSeconds(2)).build());
            factory.setReadTimeout(Duration.ofSeconds(2));
            client = RestClient.builder().baseUrl(baseUrl).requestFactory(factory).build();
        }
        return client;
    }

    /** Fetches one authoritative replay quote, never using a client price as fallback.
     * @param instrument asset with a simulation symbol
     * @param sessionId selected session, or null for the default
     * @return current quote
     * @throws QuoteUnavailableException when no usable quote can be obtained */
    public Quote current(Instrument instrument, Long sessionId) {
        String symbol = instrument.getSimulatedStockSymbol();
        if (symbol == null || symbol.isBlank()) throw new QuoteUnavailableException();
        try {
            var snapshot = client().get().uri(builder -> {
                builder.path("/api/market/snapshot");
                if (sessionId != null) builder.queryParam("sessionId", sessionId);
                return builder.build();
            }).retrieve().body(MarketResponses.Snapshot.class);
            if (snapshot == null || snapshot.stocks() == null || !"OPEN".equals(snapshot.status())
                    || snapshot.marketTimestamp() == null || (sessionId != null && snapshot.sessionId() != sessionId))
                throw new QuoteUnavailableException();
            var stock = snapshot.stocks().stream().filter(s -> symbol.equalsIgnoreCase(s.symbol()))
                    .findFirst().orElseThrow(QuoteUnavailableException::new);
            if (stock.price() == null || stock.price().signum() <= 0 || stock.timestamp() == null
                    || !stock.timestamp().equals(snapshot.marketTimestamp())) throw new QuoteUnavailableException();
            return new Quote(stock.price(), snapshot.sessionId(), stock.timestamp());
        } catch (QuoteUnavailableException ex) {
            throw ex;
        } catch (RuntimeException ex) {
            throw new QuoteUnavailableException();
        }
    }

    /** A price and its server replay context.
     * @param price execution price
     * @param sessionId simulation session
     * @param timestamp simulated execution instant */
    public record Quote(BigDecimal price, long sessionId, Instant timestamp) { }

    /** Indicates that execution must fail without any ledger changes. */
    public static class QuoteUnavailableException extends RuntimeException {
        private static final long serialVersionUID = 1L;
        /** Creates a safe user-facing failure. */
        public QuoteUnavailableException() { super("Market price unavailable. Please try again."); }
    }
}
