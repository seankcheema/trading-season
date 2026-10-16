package app.config;

import io.swagger.v3.oas.models.OpenAPI;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * OpenAPI and Swagger configuration for the Holdings and Trade Service.
 * Exposes interactive API documentation at /swagger-ui.html and machine-readable spec at /v3/api-docs.
 */
@Configuration
public class OpenApiConfig {

    /** Creates an instance of this class. */
    public OpenApiConfig() {
    }

    /**
     * Configures the OpenAPI documentation with service metadata and security schemes.
     * @return OpenAPI configuration
     */
    @Bean
    public OpenAPI customOpenAPI() {
        return OpenApiSupport.describe("Holdings and Trade Service API",
                "Manages user holdings, trading history, and market data retrieval for the DuaLEAPa platform. "
                        + "Consumes the Kafka topic trade-events (group portfolio-valuation-capture) to record a "
                        + "portfolio valuation the moment an order fills.");
    }
}
