package app.auth;

import app.cash.InsufficientFundsException;

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
     * Handles duplicate account or email registration attempts.
     *
     * @param ex the conflict
     * @return 409 with the conflict message
     */
    @ExceptionHandler(ConflictException.class)
    public ResponseEntity<Map<String, String>> handleConflict(ConflictException ex) {
        return error(HttpStatus.CONFLICT, ex.getMessage());
    }

    /**
     * Handles a concurrent registration that passed the service checks but hit a
     * unique constraint on insert.
     *
     * @param ex the constraint violation
     * @return 409 without database details
     */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, String>> handleDataIntegrity(DataIntegrityViolationException ex) {
        return error(HttpStatus.CONFLICT, "Account or email is already registered");
    }

    /**
     * Handles a withdrawal larger than the caller's available funds. The request
     * is well formed, so this is 422 rather than 400: it is the account state
     * that refuses it.
     *
     * @param ex the refusal
     * @return 422 with the refusal message
     */
    @ExceptionHandler(InsufficientFundsException.class)
    public ResponseEntity<Map<String, String>> handleInsufficientFunds(InsufficientFundsException ex) {
        return error(HttpStatus.UNPROCESSABLE_CONTENT, ex.getMessage());
    }

    /**
     * Handles a request a controller rejected on its own, such as a cash movement
     * with an unusable amount or reason.
     *
     * @param ex the rejection
     * @return 400 with the rejection message
     */
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleIllegalArgument(IllegalArgumentException ex) {
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

    /**
     * Returns a lifecycle validation failure.
     * @param ex unmet account requirement
     * @return 409 with a specific explanation
     */
    @ExceptionHandler(app.account.AccountStateException.class)
    public ResponseEntity<Map<String, String>> handleAccountState(app.account.AccountStateException ex) {
        return error(HttpStatus.CONFLICT, ex.getMessage());
    }

    private static ResponseEntity<Map<String, String>> error(HttpStatus status, String message) {
        return ResponseEntity.status(status).body(Map.of("error", message));
    }
}


