package app.order.execution;

import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import static org.junit.jupiter.api.Assertions.*;

class ExecutionPolicyTest {
    @ParameterizedTest
    @CsvSource({"BUY,100,2,102", "SELL,100,2,98", "BUY,100,0,100", "SELL,100,0,100", "BUY,100,10,110", "SELL,100,10,90"})
    void computesProtectedBoundary(String side, String quote, String percent, String expected) {
        assertEquals(0, new BigDecimal(expected).compareTo(ExecutionPolicy.boundary(side, new BigDecimal(quote), new BigDecimal(percent))));
    }
    @ParameterizedTest
    @CsvSource({"BUY,101.99,102,true", "BUY,102,102,true", "BUY,102.000001,102,false", "BUY,90,102,true",
        "SELL,98.000001,98,true", "SELL,98,98,true", "SELL,97.999999,98,false", "SELL,110,98,true"})
    void boundaryIncludesExactPriceAndAllFavorablePrices(String side, String price, String bound, boolean allowed) {
        assertEquals(allowed, ExecutionPolicy.within(side, new BigDecimal(price), new BigDecimal(bound)));
    }
    @ParameterizedTest
    @CsvSource({"BUY,99,100,false", "BUY,100,100,true", "BUY,101,100,true", "SELL,101,100,false", "SELL,100,100,true", "SELL,99,100,true"})
    void stopActivatesInclusivelyInTheCorrectDirection(String side, String price, String stop, boolean triggered) {
        assertEquals(triggered, ExecutionPolicy.triggers(side, new BigDecimal(price), new BigDecimal(stop)));
    }
    @Test
    void roundingNeverRelaxesProtection() {
        assertEquals(new BigDecimal("1.000001"), ExecutionPolicy.boundary("BUY", new BigDecimal("1.000001"), new BigDecimal("0.00001")));
        assertEquals(new BigDecimal("1.000001"), ExecutionPolicy.boundary("SELL", new BigDecimal("1.000001"), new BigDecimal("0.00001")));
    }
}
