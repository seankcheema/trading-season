package app.market;

import jakarta.servlet.ServletException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.handler.MappedInterceptor;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;

import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.nullable;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup;

/**
 * Drives the market controller over HTTP without an application context, against a real replay
 * service backed by a stub data source. Security and CORS are covered by
 * {@link MarketControllerCorsTest}; this covers the controller contract and the stream lifecycle.
 */
class MarketControllerTest {
    private static final Instant OPEN = Instant.parse("2026-01-05T14:30:00Z");
    private static final MarketModels.Session SESSION = new MarketModels.Session(7L, "postgres", "");

    private final MarketDataSource repository = mock(MarketDataSource.class);
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        when(repository.resolveSession(nullable(Long.class))).thenReturn(SESSION);
        when(repository.tradingDays(7L)).thenReturn(List.of(LocalDate.of(2026, 1, 5)));
        when(repository.stocks()).thenReturn(List.of(new MarketModels.Stock("AAPL", "Apple Inc.")));
        when(repository.ticksForDay(SESSION, LocalDate.of(2026, 1, 5))).thenReturn(List.of(
                new MarketModels.Frame(OPEN, List.of(new MarketModels.Tick("AAPL", OPEN, new BigDecimal("100"), 1))),
                new MarketModels.Frame(OPEN.plusSeconds(1), List.of(
                        new MarketModels.Tick("AAPL", OPEN.plusSeconds(1), new BigDecimal("101"), 2)))));
        MarketReplayService service = new MarketReplayService(repository, Clock.fixed(OPEN, ZoneOffset.UTC), "", 1, 10);
        mockMvc = standaloneSetup(new MarketController(service)).build();
    }

    @Test
    void snapshotIsBrieflyCacheable() throws Exception {
        mockMvc.perform(get("/api/market/snapshot").param("sessionId", "7"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "max-age=1, private"))
                .andExpect(jsonPath("$.sessionId").value(7))
                .andExpect(jsonPath("$.stocks[0].companyName").value("Apple Inc."));
    }

    @Test
    void candlesAreCacheableForFiveSeconds() throws Exception {
        mockMvc.perform(get("/api/market/candles").param("symbol", "AAPL").param("timeframe", "1D"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "max-age=5, private"))
                .andExpect(jsonPath("$.symbol").value("AAPL"))
                .andExpect(jsonPath("$.timeframe").value("1D"));
    }

    @Test
    void clockChangesAreNeverCached() throws Exception {
        mockMvc.perform(put("/api/market/clock")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"timestamp\":\"" + OPEN.plusSeconds(1) + "\"}"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
                .andExpect(jsonPath("$.marketTimestamp").value(OPEN.plusSeconds(1).toString()));
    }

    @Test
    void clockChangesRequireATimestamp() {
        var error = assertThrows(ServletException.class, () -> mockMvc.perform(put("/api/market/clock")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}")));

        assertInstanceOf(MarketRequestException.class, error.getCause());
        assertEquals("timestamp is required", error.getCause().getMessage());
    }

    @Test
    void streamOpensWithASnapshotAndFreesItsSlotWhenTheClientDisconnects() throws Exception {
        MvcResult first = mockMvc.perform(get("/api/market/stream").header("Last-Event-ID", "0"))
                .andExpect(request().asyncStarted())
                .andReturn();
        assertTrue(first.getResponse().getContentAsString().contains("event:snapshot"));

        var limited = assertThrows(ServletException.class, () -> mockMvc.perform(get("/api/market/stream")));
        assertInstanceOf(MarketLimitException.class, limited.getCause());

        first.getRequest().getAsyncContext().complete();

        mockMvc.perform(get("/api/market/stream"))
                .andExpect(request().asyncStarted())
                .andExpect(content().string(containsString("event:snapshot")));
    }

    @Test
    void rateLimiterRejectsAClientPastItsPerMinuteAllowance() throws Exception {
        HandlerInterceptor limiter = interceptorOf(new MarketWebConfig("http://localhost:4200", 2));

        assertTrue(limiter.preHandle(requestFrom("10.0.0.1"), new MockHttpServletResponse(), new Object()));
        assertTrue(limiter.preHandle(requestFrom("10.0.0.1"), new MockHttpServletResponse(), new Object()));
        assertTrue(limiter.preHandle(requestFrom("10.0.0.2"), new MockHttpServletResponse(), new Object()));

        MockHttpServletResponse rejected = new MockHttpServletResponse();
        assertFalse(limiter.preHandle(requestFrom("10.0.0.1"), rejected, new Object()));
        assertEquals(429, rejected.getStatus());
        assertEquals("Market data request limit reached", rejected.getErrorMessage());
    }

    @Test
    void corsAllowsEachConfiguredOriginForMarketRoutesOnly() {
        var registry = new ExposedCorsRegistry();
        new MarketWebConfig(" http://a.test , http://b.test", 120).addCorsMappings(registry);

        Map<String, CorsConfiguration> configurations = registry.configurations();

        assertEquals(List.of("/api/market/**"), List.copyOf(configurations.keySet()));
        CorsConfiguration market = configurations.get("/api/market/**");
        assertEquals(List.of("http://a.test", "http://b.test"), market.getAllowedOrigins());
        assertEquals(List.of("GET", "PUT", "OPTIONS"), market.getAllowedMethods());
        assertEquals(List.of("Content-Type", "Last-Event-ID"), market.getAllowedHeaders());
        assertEquals(3600L, market.getMaxAge());
    }

    private static MockHttpServletRequest requestFrom(String address) {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/market/snapshot");
        request.setRemoteAddr(address);
        return request;
    }

    private static HandlerInterceptor interceptorOf(MarketWebConfig config) {
        var registry = new ExposedInterceptorRegistry();
        config.addInterceptors(registry);
        return ((MappedInterceptor) registry.interceptors().getFirst()).getInterceptor();
    }

    private static final class ExposedInterceptorRegistry extends InterceptorRegistry {
        List<Object> interceptors() { return getInterceptors(); }
    }

    private static final class ExposedCorsRegistry extends CorsRegistry {
        Map<String, CorsConfiguration> configurations() { return getCorsConfigurations(); }
    }
}
