package app.auth;


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


