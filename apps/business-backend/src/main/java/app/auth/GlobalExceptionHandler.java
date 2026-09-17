package app.auth;

import app.market.MarketRequestException;
import app.market.MarketLimitException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;
import java.util.stream.Collectors;

/**
 * Translates auth-related exceptions and validation errors into HTTP error responses.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    /** Creates the exception handler. */
    public GlobalExceptionHandler() {
    }

    /**
     * Handles duplicate username/email registration attempts.
     *
     * @param ex conflict containing a safe client message
     * @return a conflict response
     */
    @ExceptionHandler(ConflictException.class)
    public ResponseEntity<Map<String, String>> handleConflict(ConflictException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", ex.getMessage()));
    }

    /**
     * Handles invalid login credentials or blocked accounts.
     *
     * @param ex authentication failure containing a safe client message
     * @return an unauthorized response
     */
    @ExceptionHandler(UnauthorizedException.class)
    public ResponseEntity<Map<String, String>> handleUnauthorized(UnauthorizedException ex) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", ex.getMessage()));
    }

    /**
     * Handles request validation failures, collecting all field errors into one message.
     *
     * @param ex request validation failure
     * @return a bad-request response containing the field errors
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, String>> handleValidation(MethodArgumentNotValidException ex) {
        String message = ex.getBindingResult().getFieldErrors().stream()
                .map(fieldError -> fieldError.getField() + ": " + fieldError.getDefaultMessage())
                .collect(Collectors.joining("; "));
        return ResponseEntity.badRequest().body(Map.of("error", message));
    }

    /**
     * Handles invalid or unavailable public market-data requests.
     * @param ex request failure carrying a safe message
     * @return a bad-request response
     */
    @ExceptionHandler(MarketRequestException.class)
    public ResponseEntity<Map<String, String>> handleMarketRequest(MarketRequestException ex) {
        return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
    }

    /**
     * Handles public market-data rate and connection limits.
     * @param ex limit failure carrying a safe message
     * @return a too-many-requests response
     */
    @ExceptionHandler(MarketLimitException.class)
    public ResponseEntity<Map<String, String>> handleMarketLimit(MarketLimitException ex) {
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(Map.of("error", ex.getMessage()));
    }
}
