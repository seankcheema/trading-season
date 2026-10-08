package app.auth;


import app.account.AccountNotFoundException;
import app.instrument.InstrumentNotFoundException;
import app.user.UserNotFoundException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;
import java.util.stream.Collectors;

/**
 * Translates controller exceptions and validation errors into HTTP error responses
 * with an {@code {"error": "..."}} body. Missing or invalid tokens are rejected
 * earlier, by {@link SecurityErrorHandler}.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

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
     * Handles an authenticated caller acting outside their own account.
     *
     * @param ex the refusal
     * @return 403 with the refusal message
     */
    @ExceptionHandler(ForbiddenException.class)
    public ResponseEntity<Map<String, String>> handleForbidden(ForbiddenException ex) {
        return error(HttpStatus.FORBIDDEN, ex.getMessage());
    }

    /**
     * Handles an authenticated caller who has no business account yet.
     *
     * @param ex the lookup failure
     * @return 404 with the failure message
     */
    @ExceptionHandler(UserNotFoundException.class)
    public ResponseEntity<Map<String, String>> handleNotFound(UserNotFoundException ex) {
        return error(HttpStatus.NOT_FOUND, ex.getMessage());
    }

    /**
     * Handles an order naming an account id that does not exist.
     *
     * @param ex the lookup failure
     * @return 404 with the failure message
     */
    @ExceptionHandler(AccountNotFoundException.class)
    public ResponseEntity<Map<String, String>> handleAccountNotFound(AccountNotFoundException ex) {
        return error(HttpStatus.NOT_FOUND, ex.getMessage());
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

    private static ResponseEntity<Map<String, String>> error(HttpStatus status, String message) {
        return ResponseEntity.status(status).body(Map.of("error", message));
    }
}


