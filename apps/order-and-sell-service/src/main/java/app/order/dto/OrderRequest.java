package app.order.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.Digits;

import java.math.BigDecimal;
import java.util.UUID;
import java.time.OffsetDateTime;

/** A trade instruction scoped to an owned account.
 * @param accountId owned account
 * @param instrumentId asset to trade
 * @param orderType BUY or SELL
 * @param quantity positive shares
 * @param indicativePrice displayed reference price for protection
 * @param bufferPercent optional percentage override, otherwise the user setting
 * @param clientReference account-scoped idempotency key
 * @param simulatedAt displayed replay time; does not select the execution price
 * @param sessionId replay session, or null for the market default
 */
public record OrderRequest(
        @NotNull Integer accountId,
        @NotNull Integer instrumentId,
        @NotNull @Pattern(regexp = "BUY|SELL") String orderType,
        @NotNull @Positive BigDecimal quantity,
        @NotNull @Positive BigDecimal indicativePrice,
        @DecimalMin("0") @DecimalMax("10") @Digits(integer = 2, fraction = 2) BigDecimal bufferPercent,
        @NotNull UUID clientReference,
        OffsetDateTime simulatedAt,
        @Positive Long sessionId
) {
    /** Creates a submission without a simulation timestamp for existing callers.
     * @param accountId owned account
     * @param instrumentId traded instrument
     * @param orderType buy or sell
     * @param quantity units requested
     * @param indicativePrice submitted price
     * @param bufferPercent optional price tolerance
     * @param clientReference idempotency key
     */
    public OrderRequest(Integer accountId, Integer instrumentId, String orderType,
            BigDecimal quantity, BigDecimal indicativePrice, BigDecimal bufferPercent, UUID clientReference) {
        this(accountId, instrumentId, orderType, quantity, indicativePrice, bufferPercent, clientReference, null, null);
    }
    /** Creates a submission with legacy replay context and the default session.
     * @param accountId owned account
     * @param instrumentId asset
     * @param orderType BUY or SELL
     * @param quantity shares
     * @param indicativePrice displayed price
     * @param bufferPercent optional override
     * @param clientReference idempotency key
     * @param simulatedAt displayed time */
    public OrderRequest(Integer accountId, Integer instrumentId, String orderType,
            BigDecimal quantity, BigDecimal indicativePrice, BigDecimal bufferPercent,
            UUID clientReference, OffsetDateTime simulatedAt) {
        this(accountId, instrumentId, orderType, quantity, indicativePrice, bufferPercent,
                clientReference, simulatedAt, null);
    }
}


