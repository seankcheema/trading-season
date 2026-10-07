package app.order.execution;

import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import static org.junit.jupiter.api.Assertions.*;

class ExecutionPolicyTest {
    private BigDecimal n(String value) { return new BigDecimal(value); }
    @Test void inclusiveBoundariesAndFavorablePrices() {
        var buy = ExecutionPolicy.boundary("BUY", n("100"), n("1"));
        var sell = ExecutionPolicy.boundary("SELL", n("100"), n("1"));
        assertEquals(0, buy.compareTo(n("101")));
        assertEquals(0, sell.compareTo(n("99")));
        for (String price : new String[]{"101", "100", "98"})
            assertNull(ExecutionPolicy.failure("BUY", n("10"), n(price), buy, n("2000"), n("0")));
        for (String price : new String[]{"99", "100", "103"})
            assertNull(ExecutionPolicy.failure("SELL", n("10"), n(price), sell, n("0"), n("10")));
        assertEquals("PRICE_OUTSIDE_BUFFER", ExecutionPolicy.failure("BUY", n("1"), n("101.000001"), buy, n("2000"), n("0")));
        assertEquals("PRICE_OUTSIDE_BUFFER", ExecutionPolicy.failure("SELL", n("1"), n("98.999999"), sell, n("0"), n("10")));
    }
    @Test void actualPricesDetermineAffordabilityAndHoldings() {
        assertNull(ExecutionPolicy.failure("BUY", n("10"), n("99"), n("101"), n("990"), n("0")));
        assertEquals("INSUFFICIENT_FUNDS", ExecutionPolicy.failure("BUY", n("10"), n("100.50"), n("101"), n("1000"), n("0")));
        assertEquals("INSUFFICIENT_HOLDINGS", ExecutionPolicy.failure("SELL", n("10"), n("100"), n("99"), n("0"), n("9")));
    }
    @Test void zeroTenAndPrecisionValidation() {
        for (String value : new String[]{"0", "10", "1.25", "1.000"}) assertTrue(ExecutionPolicy.validBuffer(n(value)));
        for (String value : new String[]{"-1", "10.01", "1.001"}) assertFalse(ExecutionPolicy.validBuffer(n(value)));
        assertFalse(ExecutionPolicy.validBuffer(null));
        assertEquals(0, ExecutionPolicy.boundary("SELL", n("100"), n("10")).compareTo(n("90")));
        assertEquals(0, ExecutionPolicy.boundary("BUY", n("100"), n("0")).compareTo(n("100")));
        for (String code : new String[]{"PRICE_OUTSIDE_BUFFER", "INSUFFICIENT_FUNDS", "INSUFFICIENT_HOLDINGS", "INVALID_BUFFER", "MARKET_PRICE_UNAVAILABLE"})
            assertFalse(ExecutionPolicy.reason(code).isBlank());
    }
}
