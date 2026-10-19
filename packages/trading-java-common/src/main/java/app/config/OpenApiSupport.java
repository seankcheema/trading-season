package app.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;

/**
 * Builds the OpenAPI description both Java services publish: their own title
 * and summary, version 1.0, and the bearer-token scheme for the access tokens
 * the auth service issues.
 */
public final class OpenApiSupport {

    private OpenApiSupport() {
    }

    /**
     * Describes one service's API.
     *
     * @param title       the service's API title
     * @param description what the service does, shown under the title
     * @return the OpenAPI document with the {@code bearerAuth} scheme required on every operation
     */
    public static OpenAPI describe(String title, String description) {
        return new OpenAPI()
                .info(new Info()
                        .title(title)
                        .description(description)
                        .version("1.0"))
                .addSecurityItem(new SecurityRequirement().addList("bearerAuth"))
                .components(new Components()
                        .addSecuritySchemes("bearerAuth",
                                new SecurityScheme()
                                        .type(SecurityScheme.Type.HTTP)
                                        .scheme("bearer")
                                        .bearerFormat("JWT")
                                        .description("JWT access token issued by Auth Service")));
    }
}
