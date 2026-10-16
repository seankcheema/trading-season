package app.auth;

import org.springframework.http.HttpMethod;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AuthorizeHttpRequestsConfigurer;

/**
 * Configures the Holdings and Trade Service as an OAuth2 resource server that trusts access
 * tokens issued by the NestJS auth service; the token handling is in
 * {@link ResourceServerSecurity}.
 *
 * <p>Beyond the shared rules, the account existence check is public.
 */
@Configuration
public class SecurityConfig extends ResourceServerSecurity {

    /** Creates an instance of this class. */
    public SecurityConfig() {
    }

    @Override
    protected void permitServiceEndpoints(
            AuthorizeHttpRequestsConfigurer<HttpSecurity>.AuthorizationManagerRequestMatcherRegistry registry) {
        registry.requestMatchers(HttpMethod.POST, "/api/registration/account-exists").permitAll();
    }
}
