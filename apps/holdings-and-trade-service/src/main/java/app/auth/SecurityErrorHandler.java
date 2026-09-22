package app.auth;

import tools.jackson.databind.ObjectMapper;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.oauth2.server.resource.web.BearerTokenAuthenticationEntryPoint;
import org.springframework.security.oauth2.server.resource.web.access.BearerTokenAccessDeniedHandler;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.Map;

/**
 * Writes authentication (401) and authorization (403) failures from the security
 * filter chain in the same {@code {"error": "..."}} format as
 * {@link GlobalExceptionHandler}.
 *
 * <p>The standard bearer-token handlers run first so the {@code WWW-Authenticate}
 * header required by RFC 6750 is still set. The body deliberately gives no detail
 * about why a token was rejected.
 */
@Component
public class SecurityErrorHandler implements AuthenticationEntryPoint, AccessDeniedHandler {

    private final AuthenticationEntryPoint bearerEntryPoint = new BearerTokenAuthenticationEntryPoint();
    private final AccessDeniedHandler bearerAccessDenied = new BearerTokenAccessDeniedHandler();
    private final ObjectMapper objectMapper;

    /**
     * Creates the handler.
     *
     * @param objectMapper serializes the error body
     */
    public SecurityErrorHandler(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    /**
     * Responds 401 when the request has no bearer token or the token is invalid or expired.
     *
     * @param request       the rejected request
     * @param response      the response to write
     * @param authException why authentication failed
     * @throws IOException      if the body cannot be written
     * @throws ServletException if the bearer-token handler fails
     */
    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response,
                         AuthenticationException authException) throws IOException, ServletException {
        bearerEntryPoint.commence(request, response, authException);
        writeError(response, HttpStatus.UNAUTHORIZED, "A valid access token is required");
    }

    /**
     * Responds 403 when an authenticated caller lacks permission for the request.
     *
     * @param request               the rejected request
     * @param response              the response to write
     * @param accessDeniedException why access was denied
     * @throws IOException      if the body cannot be written
     * @throws ServletException if the bearer-token handler fails
     */
    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response,
                       AccessDeniedException accessDeniedException) throws IOException, ServletException {
        bearerAccessDenied.handle(request, response, accessDeniedException);
        writeError(response, HttpStatus.FORBIDDEN, "Access denied");
    }

    private void writeError(HttpServletResponse response, HttpStatus status, String message) throws IOException {
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        objectMapper.writeValue(response.getOutputStream(), Map.of("error", message));
    }
}
