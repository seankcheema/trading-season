package app.auth;

import app.order.execution.ExecutionQuoteSource.QuoteUnavailableException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

class OrderOperationErrorTest {
    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void statusErrorsPreserveDomainReasonsAndUseASafeFallbackWhenAbsent() {
        var conflict = handler.handleStatus(new ResponseStatusException(HttpStatus.CONFLICT, "Order is already resolved"));
        assertEquals(HttpStatus.CONFLICT, conflict.getStatusCode());
        assertEquals(Map.of("error", "Order is already resolved"), conflict.getBody());
        var unspecified = handler.handleStatus(new ResponseStatusException(HttpStatus.BAD_REQUEST));
        assertEquals(HttpStatus.BAD_REQUEST, unspecified.getStatusCode());
        assertEquals(Map.of("error", "Order operation failed"), unspecified.getBody());
    }

    @Test
    void unavailableQuotesReturnRetryable503WithoutInternalDetails() {
        var response = handler.handleQuoteUnavailable(new QuoteUnavailableException());
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, response.getStatusCode());
        assertEquals(Map.of("error", "Market price unavailable. Please try again."), response.getBody());
    }

    @Test
    void constraintViolationsAnswer409WithoutDatabaseDetails() {
        var response = handler.handleDataIntegrity(
                new org.springframework.dao.DataIntegrityViolationException("duplicate key value violates unique constraint uq_orders"));
        assertEquals(HttpStatus.CONFLICT, response.getStatusCode());
        assertEquals(Map.of("error", "Request conflicts with existing data"), response.getBody());
    }
}
