package app.market;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertEquals;

class MarketModelsTest {

    @Test
    void aDayIsKeyedByItsDate() {
        LocalDate date = LocalDate.of(2026, 1, 5);

        assertEquals(date, new MarketModels.Day(date).date());
    }
}
