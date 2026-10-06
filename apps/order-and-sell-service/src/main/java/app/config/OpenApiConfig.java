package app.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * OpenAPI and Swagger configuration for the Order and Sell Service.
 * Exposes interactive API documentation at /swagger-ui.html and machine-readable spec at /v3/api-docs.
 */
@Configuration
public class OpenApiConfig {

    /**
     * Configures the OpenAPI documentation with service metadata and security schemes.
     * @return OpenAPI configuration
     */
    @Bean
    public OpenAPI customOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("Order and Sell Service API")
                        .description("Manages order placement, validation, and execution for the DuaLEAPa platform")
                        .version("1.0"))
                .addSecurityItem(new SecurityRequirement().addList("bearerAuth"))
                .components(new io.swagger.v3.oas.models.Components()
                        .addSecuritySchemes("bearerAuth",
                                new SecurityScheme()
                                        .type(SecurityScheme.Type.HTTP)
                                        .scheme("bearer")
                                        .bearerFormat("JWT")
                                        .description("JWT access token issued by Auth Service")));
    }
}
