package com.neueda.leap.instrument;

/**
 * No instrument exists for the given instrument id. This is a bad request,
 * not a trading-rule rejection — compare {@code TradabilityValidator}, which
 * rejects an instrument that exists but is closed to trading.
 */
public class InstrumentNotFoundException extends RuntimeException {
    public InstrumentNotFoundException(String message) {
        super(message);
    }
    public InstrumentNotFoundException(Integer instrumentId) {
        super("No instrument exists for the given instrument id: " + instrumentId);
    }
}
