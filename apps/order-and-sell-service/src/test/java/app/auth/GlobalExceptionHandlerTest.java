package app.auth;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

/** Verifies state refusals retain their status and always provide an error message. */
@Tag("unit")
class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void preservesTheStatusAndReasonOfAStateRefusal() {
        var response = handler.handleState(
                new ResponseStatusException(HttpStatus.CONFLICT, "This account is archived"));

        assertEquals(HttpStatus.CONFLICT, response.getStatusCode());
        assertEquals(Map.of("error", "This account is archived"), response.getBody());
    }

    @Test
    void suppliesAnErrorMessageWhenTheRefusalHasNoReason() {
        var response = handler.handleState(new ResponseStatusException(HttpStatus.FORBIDDEN));

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
        assertEquals(Map.of("error", "Request refused"), response.getBody());
    }
}
