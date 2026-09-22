package app.market;

/** Indicates that a public market-data connection limit was reached. */
public class MarketLimitException extends RuntimeException {
    /**
     * Creates an exception with a client-safe limit message.
     * @param message safe response detail
     */
    public MarketLimitException(String message) { super(message); }
}
