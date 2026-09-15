package com.neueda.leap.market;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/** Internal market-data values shared by persistence and replay services. */
final class MarketModels {
    private MarketModels() { }

    record Session(long id, String storageMode, String archiveLocation) { }
    record Stock(String symbol, String companyName) { }
    record Tick(String symbol, Instant timestamp, BigDecimal price, long sequenceNumber) { }
    record Frame(Instant timestamp, List<Tick> prices) { }
    record Candle(Instant timestamp, BigDecimal open, BigDecimal high, BigDecimal low,
                  BigDecimal close, long volume) { }
    record Day(LocalDate date) { }
}
