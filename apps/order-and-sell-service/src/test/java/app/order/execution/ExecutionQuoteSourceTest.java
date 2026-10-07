package app.order.execution;

import app.instrument.Instrument;
import org.junit.jupiter.api.*;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import java.io.IOException;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class ExecutionQuoteSourceTest {
    private MockRestServiceServer server;
    private ExecutionQuoteSource source;
    private Instrument instrument;
    private final String response = """
            {"sessionId":7,"status":"OPEN","marketTimestamp":"2026-01-05T16:00:00Z",
             "stocks":[{"symbol":"AAPL","price":100.123456,"timestamp":"2026-01-05T16:00:00Z"}]}
            """;
    @BeforeEach public void start() {
        var builder = RestClient.builder().baseUrl("http://market");
        server = MockRestServiceServer.bindTo(builder).build();
        source = new ExecutionQuoteSource(builder);
        instrument = new Instrument(); instrument.setSimulatedStockSymbol("aapl");
    }
    @Test void usesRequestedSessionAndDefaultWithoutClientPrice() {
        server.expect(requestTo("http://market/api/market/snapshot?sessionId=7"))
                .andRespond(withSuccess(response, MediaType.APPLICATION_JSON));
        server.expect(requestTo("http://market/api/market/snapshot"))
                .andRespond(withSuccess(response, MediaType.APPLICATION_JSON));
        var quote = source.current(instrument, 7L);
        assertEquals("100.123456", quote.price().toPlainString());
        assertEquals(7, quote.sessionId()); assertNotNull(quote.timestamp());
        source.current(instrument, null); server.verify();
        assertNotNull(new ExecutionQuoteSource("http://localhost:8082"));
    }
    @Test void rejectsUnmappedMissingAndInvalidQuotes() {
        instrument.setSimulatedStockSymbol(null); unavailable();
        instrument.setSimulatedStockSymbol(" "); unavailable();
        String original = response;
        for (String invalid : new String[]{"null", "{}", "{\"stocks\":null}",
                original.replace("AAPL", "MSFT"), original.replace("100.123456", "0"), original.replace("100.123456", "null"),
                original.replace("OPEN", "CLOSED"), original.replace("\"sessionId\":7", "\"sessionId\":8"),
                original.replace("\"marketTimestamp\":\"2026-01-05T16:00:00Z\"", "\"marketTimestamp\":null"),
                original.replace("\"timestamp\":\"2026-01-05T16:00:00Z\"", "\"timestamp\":null"),
                original.replace("\"timestamp\":\"2026-01-05T16:00:00Z\"", "\"timestamp\":\"2026-01-05T15:59:00Z\""), "bad json"}) {
            start();
            server.expect(requestTo("http://market/api/market/snapshot?sessionId=7"))
                    .andRespond(withSuccess(invalid, MediaType.APPLICATION_JSON));
            unavailable(); server.verify();
        }
    }
    @Test void serviceFailureAndTimeoutRejectSafelyWithoutRetry() {
        server.expect(requestTo("http://market/api/market/snapshot?sessionId=7"))
                .andRespond(withServerError()); unavailable(); server.verify();
        start();
        server.expect(requestTo("http://market/api/market/snapshot?sessionId=7"))
                .andRespond(withException(new IOException("Read timed out"))); unavailable(); server.verify();
    }
    private void unavailable() {
        assertNotNull(assertThrows(ExecutionQuoteSource.QuoteUnavailableException.class, () -> source.current(instrument, 7L)));
    }
}
