package app.cash;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * Response DTO for one funding transaction.
 *
 * <p>The amount is reported positive whichever way the money moved, because
 * {@code reason} already carries the direction; the stored ledger amount is
 * signed.
 *
 * @param cashTransactionId the ledger row id
 * @param amount            how much moved, always positive
 * @param reason            {@code DEPOSIT} or {@code WITHDRAWAL}
 * @param createdAt         when the movement was recorded
 */
public record CashTransactionResponse(
        Integer cashTransactionId,
        BigDecimal amount,
        String reason,
        OffsetDateTime createdAt
) {

    /**
     * Maps a ledger row to its response.
     *
     * @param transaction the ledger row
     * @return the response, with the amount made positive
     */
    public static CashTransactionResponse from(CashTransaction transaction) {
        return new CashTransactionResponse(
                transaction.getCashTransactionId(),
                transaction.getAmount().abs(),
                transaction.getReason(),
                transaction.getCreatedAt()
        );
    }
}
