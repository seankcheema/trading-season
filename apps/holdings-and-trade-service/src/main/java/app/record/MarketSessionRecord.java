package app.record;

/**
 * The simulation session prices are replayed from, published as
 * {@value #TYPE}. There is one current session, so every message shares one
 * key and the newest replaces the others.
 *
 * @param sessionId the newest completed simulation session
 */
public record MarketSessionRecord(long sessionId) implements PlatformRecord {

    /** The record type the current session is published under. */
    public static final String TYPE = "MARKET_SESSION";

    @Override
    public String recordType() {
        return TYPE;
    }

    @Override
    public String recordId() {
        return "current";
    }
}
