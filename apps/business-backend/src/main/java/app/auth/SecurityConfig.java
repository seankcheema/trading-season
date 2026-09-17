package app.auth;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimNames;
import org.springframework.security.oauth2.jwt.JwtClaimValidator;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.client.RestOperations;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

/**
 * Configures the backend as an OAuth2 resource server that trusts access tokens
 * issued by the NestJS auth service.
 *
 * <p>Tokens are RS256 JWTs. The auth service's public key is fetched from its
 * JWKS endpoint on first use and cached, so verification never calls the auth
 * service per request and this service never handles a password. The token's
 * {@code sub} claim is the user's UUID and is the only identifier shared between
 * the auth and business databases.
 *
 * <p>Every endpoint requires a valid bearer token except the account existence
 * check, which runs before the user has signed up.
 */
@Configuration
public class SecurityConfig {

    /**
     * Builds the security filter chain: stateless bearer-token authentication,
     * no CSRF protection (no cookies are used), CORS for the configured origins,
     * and JSON error bodies for authentication and authorization failures.
     *
     * @param http              the security builder
     * @param errorHandler      writes 401 and 403 responses in the API error format
     * @return the configured filter chain
     * @throws Exception if the chain cannot be built
     */
    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http, SecurityErrorHandler errorHandler)
            throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(Customizer.withDefaults())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.POST, "/api/auth/account-exists").permitAll()
                        .requestMatchers("/error").permitAll()
                        .anyRequest().authenticated())
                .oauth2ResourceServer(oauth2 -> oauth2
                        .jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthenticationConverter()))
                        .authenticationEntryPoint(errorHandler)
                        .accessDeniedHandler(errorHandler))
                .exceptionHandling(exceptions -> exceptions
                        .authenticationEntryPoint(errorHandler)
                        .accessDeniedHandler(errorHandler));
        return http.build();
    }

    /**
     * Creates the decoder that verifies access tokens against the auth service's JWKS.
     *
     * @param jwkSetUri the auth service's {@code /.well-known/jwks.json} URL
     * @param issuer    the expected {@code iss} claim
     * @return a decoder accepting only RS256 tokens that pass {@link #tokenValidator(String)}
     */
    @Bean
    public JwtDecoder jwtDecoder(@Value("${app.auth.jwk-set-uri}") String jwkSetUri,
                                 @Value("${app.auth.issuer}") String issuer) {
        return buildJwtDecoder(jwkSetUri, issuer, new RestTemplate());
    }

    /**
     * Builds a JWKS-backed decoder using the given HTTP client. Separated from the
     * bean method so tests can serve the key set without a running auth service.
     *
     * @param jwkSetUri     the JWKS URL
     * @param issuer        the expected {@code iss} claim
     * @param restOperations the client used to fetch the key set
     * @return the configured decoder
     */
    static NimbusJwtDecoder buildJwtDecoder(String jwkSetUri, String issuer, RestOperations restOperations) {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withJwkSetUri(jwkSetUri)
                .jwsAlgorithm(SignatureAlgorithm.RS256)
                .restOperations(restOperations)
                .build();
        decoder.setJwtValidator(tokenValidator(issuer));
        return decoder;
    }

    /**
     * Claim checks applied after the signature is verified: {@code exp} and
     * {@code nbf} with the default clock skew, {@code iss} equal to the configured
     * issuer, and {@code sub} holding a UUID so it can be used as a user id.
     *
     * @param issuer the expected issuer
     * @return the combined validator
     */
    static OAuth2TokenValidator<Jwt> tokenValidator(String issuer) {
        return new DelegatingOAuth2TokenValidator<>(
                JwtValidators.createDefaultWithIssuer(issuer),
                new JwtClaimValidator<String>(JwtClaimNames.SUB, AuthenticatedUser::isUuid));
    }

    /**
     * Maps the token's {@code roles} claim (ADMIN or TRADER) to {@code ROLE_}
     * authorities so endpoints can use role-based rules.
     *
     * @return the authentication converter
     */
    static JwtAuthenticationConverter jwtAuthenticationConverter() {
        JwtGrantedAuthoritiesConverter authorities = new JwtGrantedAuthoritiesConverter();
        authorities.setAuthoritiesClaimName("roles");
        authorities.setAuthorityPrefix("ROLE_");
        JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
        converter.setJwtGrantedAuthoritiesConverter(authorities);
        return converter;
    }

    /**
     * Allows the configured browser origins to send bearer tokens to the API.
     *
     * @param allowedOrigins exact origins, never a wildcard
     * @return the CORS configuration for all paths
     */
    @Bean
    public CorsConfigurationSource corsConfigurationSource(
            @Value("${app.cors.allowed-origins}") List<String> allowedOrigins) {
        CorsConfiguration cors = new CorsConfiguration();
        cors.setAllowedOrigins(allowedOrigins);
        cors.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        cors.setAllowedHeaders(List.of("Authorization", "Content-Type"));
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", cors);
        return source;
    }
}


