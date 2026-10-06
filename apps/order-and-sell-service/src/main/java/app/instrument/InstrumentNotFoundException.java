package app.instrument;

/**
 * No instrument exists for the given instrument id. This is a bad request,
 * not a trading-rule rejection — compare {@code TradabilityValidator}, which
 * rejects an instrument that exists but is closed to trading.
 */
public class InstrumentNotFoundException extends RuntimeException {
    /**
     * Creates the exception with a custom message.
     *
     * @param message the detail message
     */
    public InstrumentNotFoundException(String message) {
        super(message);
    }

    /**
     * Creates the exception for an instrument id that does not exist.
     *
     * @param instrumentId the missing instrument id
     */
    public InstrumentNotFoundException(Integer instrumentId) {
        super("No instrument exists for the given instrument id: " + instrumentId);
    }
}


