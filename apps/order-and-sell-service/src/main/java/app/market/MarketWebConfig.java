package app.market;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.time.Clock;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/** Applies origin and request-rate safeguards to the public market API. */
@Configuration
public class MarketWebConfig implements WebMvcConfigurer {
    private final String[] allowedOrigins;
    private final MarketRateInterceptor rateInterceptor;

    /**
     * Creates web safeguards from the configured origins and request limit.
     * @param origins comma-separated allowed browser origins
     * @param requestsPerMinute maximum REST requests per client and minute
     */
    public MarketWebConfig(@Value("${market.cors.allowed-origins:http://localhost:4200}") String origins,
            @Value("${market.limits.rest-requests-per-minute:120}") int requestsPerMinute) {
        this.allowedOrigins = java.util.Arrays.stream(origins.split(",")).map(String::trim).toArray(String[]::new);
        this.rateInterceptor = new MarketRateInterceptor(requestsPerMinute, Clock.systemUTC());
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/market/**").allowedOrigins(allowedOrigins).allowedMethods("GET", "PUT", "OPTIONS")
                .allowedHeaders("Content-Type", "Last-Event-ID").maxAge(3600);
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(rateInterceptor).addPathPatterns(
                "/api/market/snapshot", "/api/market/candles", "/api/market/clock");
    }

    private static final class MarketRateInterceptor implements HandlerInterceptor {
        private final int limit;
        private final Clock clock;
        private final Map<String, Window> windows = new ConcurrentHashMap<>();

        MarketRateInterceptor(int limit, Clock clock) { this.limit = limit; this.clock = clock; }

        @Override
        public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler)
                throws Exception {
            long minute = clock.instant().getEpochSecond() / 60;
            Window window = windows.compute(request.getRemoteAddr(), (key, old) ->
                    old == null || old.minute != minute ? new Window(minute, 1) : new Window(minute, old.count + 1));
            if (window.count <= limit) return true;
            response.sendError(HttpStatus.TOO_MANY_REQUESTS.value(), "Market data request limit reached");
            return false;
        }

        private record Window(long minute, int count) { }
    }
}
