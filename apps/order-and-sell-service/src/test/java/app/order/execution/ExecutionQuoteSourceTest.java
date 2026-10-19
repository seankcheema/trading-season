package app.order.execution;

import app.instrument.Instrument;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class ExecutionQuoteSourceTest {
    private ExecutionQuoteSource.Quote read(String response, String symbol, Long session) throws Exception {
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/api/market/snapshot", exchange -> {
            byte[] bytes = response.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, bytes.length);
            exchange.getResponseBody().write(bytes); exchange.close();
        });
        server.start();
        try {
            var source = new ExecutionQuoteSource("http://127.0.0.1:" + server.getAddress().getPort());
            var instrument = new Instrument(); instrument.setSimulatedStockSymbol(symbol);
            return source.current(instrument, session);
        } finally { server.stop(0); }
    }
    private String snapshot(String price, String time) {
        return "{\"sessionId\":1,\"marketTimestamp\":\"2026-01-05T15:00:00Z\",\"stocks\":[{\"symbol\":\"AAPL\",\"price\":" + price + ",\"timestamp\":\"" + time + "\"}]}";
    }
    @Test void readsTheAuthoritativeQuoteWithOrWithoutExplicitSession() throws Exception {
        assertEquals(0, new BigDecimal("100.123456").compareTo(read(snapshot("100.123456", "2026-01-05T15:00:00Z"), "AAPL", 1L).price()));
        assertEquals(1L, read(snapshot("100", "2026-01-05T15:00:00Z"), "AAPL", null).sessionId());
    }
    @Test void refusesMissingInvalidOrUnsynchronizedPrices() {
        assertThrows(ExecutionQuoteSource.QuoteUnavailableException.class, () -> read("null", "AAPL", 1L));
        assertThrows(ExecutionQuoteSource.QuoteUnavailableException.class, () -> read("{}", "AAPL", 1L));
        assertThrows(ExecutionQuoteSource.QuoteUnavailableException.class, () -> read("not JSON", "AAPL", 1L));
        assertThrows(ExecutionQuoteSource.QuoteUnavailableException.class, () -> read(snapshot("100", "2026-01-05T15:00:00Z"), "AAPL", 2L));
        assertThrows(ExecutionQuoteSource.QuoteUnavailableException.class, () -> read(snapshot("0", "2026-01-05T15:00:00Z"), "AAPL", 1L));
        assertThrows(ExecutionQuoteSource.QuoteUnavailableException.class, () -> read(snapshot("null", "2026-01-05T15:00:00Z"), "AAPL", 1L));
        assertThrows(ExecutionQuoteSource.QuoteUnavailableException.class, () -> read(snapshot("100", "2026-01-05T14:59:59Z"), "AAPL", 1L));
        assertThrows(ExecutionQuoteSource.QuoteUnavailableException.class, () -> read(snapshot("100", "2026-01-05T15:00:00Z"), "OTHER", 1L));
        assertThrows(ExecutionQuoteSource.QuoteUnavailableException.class, () -> read(snapshot("100", "2026-01-05T15:00:00Z"), null, 1L));
    }
}
