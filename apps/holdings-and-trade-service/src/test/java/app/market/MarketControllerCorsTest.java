package app.market;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.context.WebApplicationContext;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.webAppContextSetup;

@SpringBootTest(properties = "market.replay.tick-millis=600000")
@ActiveProfiles("test")
@Import({MarketControllerCorsTest.TestConfig.class})
class MarketControllerCorsTest {
    private static final String DASHBOARD_ORIGIN = "http://localhost:4200";
    private static final Instant MARKET_TIME = Instant.parse("2026-09-01T19:59:00Z");
    private static final Instant LATER_MARKET_TIME = MARKET_TIME.plusSeconds(1);

    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private WebApplicationContext webApplicationContext;

    @BeforeEach
    void configureMockMvc() {
        mockMvc = webAppContextSetup(webApplicationContext).apply(springSecurity()).build();
    }

    @Test
    void clockPreflightAllowsDashboardPutRequests() throws Exception {
        mockMvc.perform(options("/api/market/clock?sessionId=2026001")
                        .header(HttpHeaders.ORIGIN, DASHBOARD_ORIGIN)
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "PUT")
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS, "content-type"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, DASHBOARD_ORIGIN))
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_METHODS, containsString("PUT")));
    }

    @Test
    void clockPutAllowsDashboardOrigin() throws Exception {
        mockMvc.perform(put("/api/market/clock?sessionId=2026001")
                        .with(jwt())
                        .header(HttpHeaders.ORIGIN, DASHBOARD_ORIGIN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("timestamp", MARKET_TIME.toString()))))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, DASHBOARD_ORIGIN));
    }

    @Test
    void marketReadsArePublicButClockChangesRequireAuthentication() throws Exception {
        mockMvc.perform(get("/api/market/snapshot"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/market/candles")
                        .param("sessionId", "2026001")
                        .param("symbol", "AAPL")
                        .param("timeframe", "1D"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/market/stream").param("sessionId", "2026001"))
                .andExpect(status().isOk());

        mockMvc.perform(put("/api/market/clock?sessionId=2026001")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("timestamp", MARKET_TIME.toString()))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void authenticatedClockChangeIsVisibleToPublicMarketReaders() throws Exception {
        mockMvc.perform(put("/api/market/clock?sessionId=2026001")
                        .with(jwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "timestamp", LATER_MARKET_TIME.toString()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.marketTimestamp").value(LATER_MARKET_TIME.toString()));

        mockMvc.perform(get("/api/market/snapshot?sessionId=2026001"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.marketTimestamp").value(LATER_MARKET_TIME.toString()));
    }

    @TestConfiguration
    static class TestConfig {
        @Bean
        @Primary
        MarketReplayService fakeMarketReplayService() {
            return new MarketReplayService(new FakeMarketDataSource(),
                    Clock.fixed(MARKET_TIME, ZoneOffset.UTC), "", 3, 200);
        }

        @Bean
        ObjectMapper objectMapper() {
            return new ObjectMapper();
        }
    }

    private static final class FakeMarketDataSource implements MarketDataSource {
        private static final MarketModels.Session SESSION =
                new MarketModels.Session(2026001L, "test", "");

        @Override
        public MarketModels.Session resolveSession(Long requestedId) {
            return SESSION;
        }

        @Override
        public List<MarketModels.Stock> stocks() {
            return List.of(new MarketModels.Stock("AAPL", "Apple Inc."));
        }

        @Override
        public List<LocalDate> tradingDays(long sessionId) {
            return List.of(LocalDate.of(2026, 9, 1));
        }

        @Override
        public List<MarketModels.Frame> ticksForDay(MarketModels.Session session, LocalDate day) {
            return List.of(
                    new MarketModels.Frame(MARKET_TIME, List.of(
                            new MarketModels.Tick("AAPL", MARKET_TIME, new BigDecimal("201.000000"), 1))),
                    new MarketModels.Frame(LATER_MARKET_TIME, List.of(
                            new MarketModels.Tick("AAPL", LATER_MARKET_TIME, new BigDecimal("202.000000"), 2))));
        }

        @Override
        public List<MarketModels.Candle> candles(long sessionId, String symbol, Instant from, Instant to) {
            return List.of();
        }
    }
}

