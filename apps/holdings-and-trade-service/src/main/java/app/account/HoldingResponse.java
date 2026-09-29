package app.account;

import app.holding.Holding;
import app.instrument.Instrument;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * Response DTO for a holding in an account.
 *
 * <p>Carries the instrument's symbol and what the position cost, neither of
 * which is stored on the holding row: the symbol comes from the instrument and
 * the average cost is derived from the fills that built the position. A client
 * needs both to show a position and its gain or loss.
 *
 * @param holdingId    the holding ID
 * @param accountId    the account ID
 * @param instrumentId the instrument ID
 * @param symbol       the symbol to display and match live prices by
 * @param name         the instrument's name
 * @param quantity     the quantity held
 * @param averageCost  average price paid per share, or zero when unknown
 * @param updatedAt    when the holding was last updated
 */
public record HoldingResponse(
        Integer holdingId,
        Integer accountId,
        Integer instrumentId,
        String symbol,
        String name,
        BigDecimal quantity,
        BigDecimal averageCost,
        OffsetDateTime updatedAt
) {

    /**
     * Maps a holding to its response.
     *
     * @param holding     the holding entity
     * @param instrument  the instrument held, or null if it cannot be resolved
     * @param averageCost average price paid per share, or null when no fill
     *                    history explains the position
     * @return the holding response, with the instrument id standing in for an
     *         unresolved symbol and zero for an unknown average cost
     */
    public static HoldingResponse from(Holding holding, Instrument instrument, BigDecimal averageCost) {
        return new HoldingResponse(
                holding.getHoldingId(),
                holding.getAccountId(),
                holding.getInstrumentId(),
                instrument != null ? instrument.displaySymbol() : String.valueOf(holding.getInstrumentId()),
                instrument != null ? instrument.getName() : null,
                holding.getQuantity(),
                averageCost != null ? averageCost : BigDecimal.ZERO,
                holding.getUpdatedAt()
        );
    }
}
