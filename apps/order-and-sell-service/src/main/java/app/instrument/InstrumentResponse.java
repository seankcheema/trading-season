package app.instrument;

/**
 * One tradable asset as the order form needs it (DUA-63).
 *
 * <p>A client picks a symbol, but an order is placed against an
 * {@code instrumentId}, so this is the lookup that turns the one into the
 * other. Both symbols an instrument can be known by are included:
 * {@code ticker} is its own identifier, and {@code simulatedStockSymbol} is
 * the market-data symbol whose prices stand in for it, which is what
 * {@code GET /api/market/snapshot} reports. They usually match, but only the
 * latter joins an instrument to a live price, so a client mapping a quote to
 * an instrument should prefer it and fall back to the ticker.
 *
 * @param instrumentId          the id an order references
 * @param ticker                the instrument's own symbol
 * @param name                  display name
 * @param assetClass            Equity, FX, or Crypto
 * @param market                UK, US, or IN for equities; null otherwise
 * @param currency              the currency it trades in
 * @param tradable              BR-05: false means an order against it is rejected
 * @param simulatedStockSymbol  the market-data symbol quoting it, or null when unsimulated
 */
public record InstrumentResponse(
        Integer instrumentId,
        String ticker,
        String name,
        String assetClass,
        String market,
        String currency,
        boolean tradable,
        String simulatedStockSymbol
) {
    /**
     * Builds a response from a persisted instrument.
     *
     * @param instrument the instrument row
     * @return the client-facing view of it
     */
    public static InstrumentResponse from(Instrument instrument) {
        return new InstrumentResponse(
                instrument.getInstrumentId(),
                instrument.getTicker(),
                instrument.getName(),
                instrument.getAssetClass(),
                instrument.getMarket(),
                instrument.getCurrency(),
                Boolean.TRUE.equals(instrument.isTradable()),
                instrument.getSimulatedStockSymbol()
        );
    }
}
