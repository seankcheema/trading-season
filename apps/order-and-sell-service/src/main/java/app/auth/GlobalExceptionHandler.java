package app.auth;

import app.instrument.InstrumentNotFoundException;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

/**
 * Translates controller exceptions into HTTP error responses with an
 * {@code {"error": "..."}} body: the shared failures from
 * {@link ApiExceptionHandler} and the ones only this service raises.
 */
@RestControllerAdvice
public class GlobalExceptionHandler extends ApiExceptionHandler {

    /** Creates an instance of this class. */
    public GlobalExceptionHandler() {
    }

    /**
     * Handles a write that passed the service checks but hit a unique constraint
     * on insert, such as two concurrent submissions of the same client reference.
     *
     * @param ex the constraint violation
     * @return 409 without database details
     */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, String>> handleDataIntegrity(DataIntegrityViolationException ex) {
        return error(HttpStatus.CONFLICT, "Request conflicts with existing data");
    }

    /**
     * Handles an order naming an instrument id that does not exist. This is a
     * malformed request rather than a trading-rule rejection, which is why it
     * is a 400 and not a 201 carrying a REJECTED order.
     *
     * @param ex the lookup failure
     * @return 400 with the failure message
     */
    @ExceptionHandler(InstrumentNotFoundException.class)
    public ResponseEntity<Map<String, String>> handleInstrumentNotFound(InstrumentNotFoundException ex) {
        return error(HttpStatus.BAD_REQUEST, ex.getMessage());
    }

    /**
     * Handles request validation failures, collecting all field errors into one message.
     *
     * @param ex the validation failure
     * @return 400 listing each invalid field
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, String>> handleValidation(MethodArgumentNotValidException ex) {
        String message = ex.getBindingResult().getFieldErrors().stream()
                .map(fieldError -> fieldError.getField() + ": " + fieldError.getDefaultMessage())
                .collect(Collectors.joining("; "));
        return error(HttpStatus.BAD_REQUEST, message);
    }

    /** Maps temporary market outages without recording an order.
     * @param ex unavailable quote
     * @return 503 and a safe reason */
    @ExceptionHandler(app.order.execution.ExecutionQuoteSource.QuoteUnavailableException.class)
    public ResponseEntity<Map<String, String>> handleQuoteUnavailable(app.order.execution.ExecutionQuoteSource.QuoteUnavailableException ex) {
        return error(HttpStatus.SERVICE_UNAVAILABLE, ex.getMessage());
    }

    /** Returns safe service validation and lifecycle conflict messages.
     * @param ex status and domain explanation
     * @return requested HTTP status with a consistent error body */
    @ExceptionHandler(org.springframework.web.server.ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> handleStatus(org.springframework.web.server.ResponseStatusException ex) {
        return ResponseEntity.status(ex.getStatusCode()).body(Map.of("error", ex.getReason() == null ? "Order operation failed" : ex.getReason()));
    }

    private static ResponseEntity<Map<String, String>> error(HttpStatus status, String message) {
        return ResponseEntity.status(status).body(Map.of("error", message));
    }
}


