package app.auth;

import org.springframework.http.HttpMethod;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authorization.AuthenticatedAuthorizationManager;
import org.springframework.security.authorization.AuthorityAuthorizationManager;
import org.springframework.security.authorization.AuthorizationManager;
import org.springframework.security.authorization.AuthorizationManagers;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AuthorizeHttpRequestsConfigurer;
import org.springframework.security.web.access.intercept.RequestAuthorizationContext;

import java.util.List;

/**
 * Configures the Holdings and Trade Service as an OAuth2 resource server that trusts access
 * tokens issued by the NestJS auth service; the token handling is in
 * {@link ResourceServerSecurity}.
 *
 * <p>Beyond the shared rules, every request that changes state ({@code POST}, {@code PUT},
 * {@code PATCH} or {@code DELETE} under {@code /api}) is refused to ADMIN and ANALYST
 * tokens: those roles read reporting and never trade or move cash (BR-02). Every endpoint,
 * including the account existence check, requires a token.
 */
@Configuration
public class SecurityConfig extends ResourceServerSecurity {

    /** Signed in, and not an operations role. */
    private static final AuthorizationManager<RequestAuthorizationContext> TRADING = AuthorizationManagers.allOf(
            AuthenticatedAuthorizationManager.authenticated(),
            AuthorizationManagers.not(AuthorityAuthorizationManager.hasAnyRole("ADMIN", "ANALYST")));

    /** Creates an instance of this class. */
    public SecurityConfig() {
        // Nothing to initialise: the rules are applied in permitServiceEndpoints.
    }

    @Override
    protected void permitServiceEndpoints(
            AuthorizeHttpRequestsConfigurer<HttpSecurity>.AuthorizationManagerRequestMatcherRegistry registry) {
        for (HttpMethod method : List.of(HttpMethod.POST, HttpMethod.PUT, HttpMethod.PATCH, HttpMethod.DELETE)) {
            registry.requestMatchers(method, "/api/**").access(TRADING);
        }
    }
}
