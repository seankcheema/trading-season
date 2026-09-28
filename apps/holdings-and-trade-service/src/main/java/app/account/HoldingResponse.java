package app.account;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * Response DTO for a holding in an account.
 *
 * @param holdingId    the holding ID
 * @param accountId    the account ID
 * @param instrumentId the instrument ID
 * @param quantity     the quantity held
 * @param updatedAt    when the holding was last updated
 */
public record HoldingResponse(
        Integer holdingId,
        Integer accountId,
        Integer instrumentId,
        BigDecimal quantity,
        OffsetDateTime updatedAt
) {

    /**
     * Maps a holding entity to its response.
     *
     * @param holding the holding entity
     * @return the holding response
     */
    public static HoldingResponse from(app.holding.Holding holding) {
        return new HoldingResponse(
                holding.getHoldingId(),
                holding.getAccountId(),
                holding.getInstrumentId(),
                holding.getQuantity(),
                holding.getUpdatedAt()
        );
    }
}
