package app.market;

/** Indicates invalid or unavailable market-data input. */
public class MarketRequestException extends RuntimeException {
    /**
     * Creates an exception with a client-safe error message.
     * @param message safe response detail
     */
    public MarketRequestException(String message) { super(message); }
}
