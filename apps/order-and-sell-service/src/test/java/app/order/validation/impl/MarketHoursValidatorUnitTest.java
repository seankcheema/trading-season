package app.order.validation.impl;

import app.account.Account;
import app.instrument.Instrument;
import app.order.Order;
import app.order.dto.OrderRequest;
import app.order.validation.ValidationResult;
import app.user.User;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * BR-05: the market is open Monday to Friday, 08:30 to 15:00 America/Chicago, so
 * 2026-01-05 (a Monday) is open from 14:30Z and closed from 21:00Z in January.
 */
@Tag("unit")
class MarketHoursValidatorUnitTest {

    private final MarketHoursValidator validator = new MarketHoursValidator();

    private static OrderRequest request(String simulatedAt) {
        return new OrderRequest(1, 1, Order.TYPE_BUY, BigDecimal.TEN, BigDecimal.valueOf(100), null,
                UUID.randomUUID(), simulatedAt == null ? null : OffsetDateTime.parse(simulatedAt));
    }

    @ParameterizedTest
    @CsvSource({
            "2026-01-05T14:30:00Z", // Monday, the opening second
            "2026-01-05T20:59:59Z", // Monday, the last second before the close
            "2026-07-06T13:30:00Z", // Monday in daylight saving time, 08:30 Chicago
            "2026-01-09T18:00:00Z", // Friday midday
    })
    void passesDuringTheSession(String at) {
        assertTrue(validator.validate(request(at), new User(), new Account(), new Instrument()).passed());
    }

    @ParameterizedTest
    @CsvSource({
            "2026-01-05T14:29:59Z, Monday 08:29",   // before the open
            "2026-01-05T21:00:00Z, Monday 15:00",   // the close itself
            "2026-01-05T23:00:00Z, Monday 17:00",   // after hours
            "2026-01-10T16:00:00Z, Saturday 10:00", // weekend
            "2026-01-11T16:00:00Z, Sunday 10:00",
    })
    void rejectsOutsideTheSession(String at, String localTime) {
        ValidationResult result = validator.validate(request(at), new User(), new Account(), new Instrument());

        assertFalse(result.passed());
        assertEquals("BR-05: the market is closed at " + localTime
                + " America/Chicago; orders are accepted Monday to Friday 08:30 to 15:00", result.reason());
    }

    @Test
    void passesARequestWithoutASubmissionPosition() {
        assertTrue(validator.validate(request(null), new User(), new Account(), new Instrument()).passed());
    }
}
