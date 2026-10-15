package app.auth;

import app.account.AccountNotFoundException;
import app.user.UserNotFoundException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;

import java.util.Map;
import java.util.stream.Collectors;

/**
 * The HTTP error responses both Java services give for the same failures, with
 * an {@code {"error": "..."}} body. Each service's {@code GlobalExceptionHandler}
 * extends this class and adds the failures only it can raise. Missing or invalid
 * tokens are rejected earlier, by {@link SecurityErrorHandler}.
 */
public abstract class ApiExceptionHandler {

    /** Creates an instance for a service's exception handler. */
    protected ApiExceptionHandler() {
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
     * Handles lookup of a non-existent account.
     *
     * @param ex the account lookup failure
     * @return 404 with the failure message
     */
    @ExceptionHandler(AccountNotFoundException.class)
    public ResponseEntity<Map<String, String>> handleAccountNotFound(AccountNotFoundException ex) {
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

    /**
     * Builds an error response.
     *
     * @param status  the HTTP status
     * @param message the text for the {@code error} field
     * @return the response
     */
    protected static ResponseEntity<Map<String, String>> error(HttpStatus status, String message) {
        return ResponseEntity.status(status).body(Map.of("error", message));
    }
}
