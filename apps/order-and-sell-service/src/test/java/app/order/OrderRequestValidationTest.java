package app.order;

import app.order.dto.OrderRequest;
import jakarta.validation.Validation;
import java.math.BigDecimal;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class OrderRequestValidationTest {
    private boolean valid(String type, BigDecimal limit, BigDecimal stop, BigDecimal quantity, BigDecimal override) {
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            return factory.getValidator().validate(new OrderRequest(1, 2, "BUY", quantity,
                    new BigDecimal("100"), override, UUID.randomUUID(), null, type, limit, stop, 1L)).isEmpty();
        }
    }
    @Test void validatesConditionalPricesWholeSharesAndOverrideRemoval() {
        var price = new BigDecimal("100");
        assertTrue(valid(null, null, null, BigDecimal.ONE, null));
        assertTrue(valid("LIMIT", price, null, BigDecimal.ONE, null));
        assertTrue(valid("STOP", null, price, BigDecimal.ONE, null));
        assertTrue(valid("STOP_LIMIT", price, price, BigDecimal.ONE, null));
        assertFalse(valid("LIMIT", null, null, BigDecimal.ONE, null));
        assertFalse(valid("MARKET", price, null, BigDecimal.ONE, null));
        assertFalse(valid("STOP", price, price, BigDecimal.ONE, null));
        assertFalse(valid("STOP_LIMIT", price, null, BigDecimal.ONE, null));
        assertFalse(valid("UNKNOWN", null, null, BigDecimal.ONE, null));
        assertFalse(valid("MARKET", null, null, new BigDecimal("1.5"), null));
        assertFalse(valid("MARKET", null, null, BigDecimal.ZERO, null));
        assertFalse(valid("MARKET", null, null, BigDecimal.ONE, BigDecimal.ONE));
        assertFalse(valid("LIMIT", new BigDecimal("1.0000001"), null, BigDecimal.ONE, null));
    }
}
