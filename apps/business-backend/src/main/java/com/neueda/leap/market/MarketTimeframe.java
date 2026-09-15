package com.neueda.leap.market;

import java.time.Duration;

/** Supported chart ranges and aggregation widths. */
public enum MarketTimeframe {
    /** Current trading session at one-minute resolution. */
    ONE_DAY("1D", Duration.ofDays(1), Duration.ofMinutes(1)),
    /** Latest five trading sessions at five-minute resolution. */
    FIVE_DAYS("5D", Duration.ofDays(7), Duration.ofMinutes(5)),
    /** Previous seven calendar days at thirty-minute resolution. */
    ONE_WEEK("1W", Duration.ofDays(7), Duration.ofMinutes(30)),
    /** Previous month at hourly resolution. */
    ONE_MONTH("1M", Duration.ofDays(31), Duration.ofHours(1)),
    /** Previous year at daily resolution. */
    ONE_YEAR("1Y", Duration.ofDays(366), Duration.ofDays(1));

    private final String wireValue;
    private final Duration lookback;
    private final Duration bucket;

    MarketTimeframe(String wireValue, Duration lookback, Duration bucket) {
        this.wireValue = wireValue;
        this.lookback = lookback;
        this.bucket = bucket;
    }

    /**
     * Returns the inclusive historical lookback used for the query.
     * @return the historical lookback
     */
    public Duration lookback() { return lookback; }

    /**
     * Returns the aggregation bucket width.
     * @return the bucket width
     */
    public Duration bucket() { return bucket; }

    /**
     * Parses the public API timeframe value.
     * @param value wire-format timeframe
     * @return the matching timeframe
     * @throws MarketRequestException when the value is unsupported
     */
    public static MarketTimeframe parse(String value) {
        for (MarketTimeframe timeframe : values()) {
            if (timeframe.wireValue.equals(value)) return timeframe;
        }
        throw new MarketRequestException("Unsupported timeframe: " + value);
    }
}
