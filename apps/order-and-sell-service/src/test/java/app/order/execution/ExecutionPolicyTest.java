package app.order.execution;

import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import static org.junit.jupiter.api.Assertions.*;

class ExecutionPolicyTest {
    @ParameterizedTest
    @CsvSource({"2026-01-05T15:00:00Z,2026-01-05T21:00:00Z", "2026-07-06T14:00:00Z,2026-07-06T20:00:00Z"})
    void dayExpiryUsesChicagoMarketCloseAcrossDaylightSaving(String submitted, String expected) {
        var order = new app.order.Order();
        order.setReferenceAt(java.time.OffsetDateTime.parse(submitted));
        assertEquals(java.time.OffsetDateTime.parse(expected).toInstant(), ExecutionPolicy.expiresAt(order).toInstant());
    }
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
    @ParameterizedTest
    @CsvSource({"2026-01-05T14:30:00Z,true", "2026-01-05T14:29:59Z,false", "2026-01-05T20:59:59Z,true",
        "2026-01-05T21:00:00Z,false", "2026-07-06T13:30:00Z,true", "2026-07-06T13:29:59Z,false",
        "2026-01-10T16:00:00Z,false", "2026-01-11T16:00:00Z,false"})
    void sessionRunsWeekdaysFromTheOpenUpToTheCloseInChicagoTime(String at, boolean open) {
        assertEquals(open, ExecutionPolicy.isDuringSession(java.time.OffsetDateTime.parse(at)));
    }
    @Test
    void aStopBuyReservesAgainstTheHigherOfItsStopAndTheSubmissionQuote() {
        var order = new app.order.Order();
        order.setReferencePrice(new BigDecimal("100"));
        order.setBufferPercent(new BigDecimal("1"));
        order.setStopPrice(new BigDecimal("110"));
        assertEquals(0, new BigDecimal("111.1").compareTo(ExecutionPolicy.reservationPrice(order)));
        order.setStopPrice(new BigDecimal("90"));
        assertEquals(0, new BigDecimal("101").compareTo(ExecutionPolicy.reservationPrice(order)));
        order.setLimitPrice(new BigDecimal("95"));
        assertEquals(0, new BigDecimal("95").compareTo(ExecutionPolicy.reservationPrice(order)));
    }
    @Test
    void roundingNeverRelaxesProtection() {
        assertEquals(new BigDecimal("1.000001"), ExecutionPolicy.boundary("BUY", new BigDecimal("1.000001"), new BigDecimal("0.00001")));
        assertEquals(new BigDecimal("1.000001"), ExecutionPolicy.boundary("SELL", new BigDecimal("1.000001"), new BigDecimal("0.00001")));
    }
}
