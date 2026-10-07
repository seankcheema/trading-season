package app.order.dto;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

/** Advisory trade request without an idempotency key.
 * @param accountId owned account
 * @param instrumentId asset
 * @param orderType BUY or SELL
 * @param quantity positive shares
 * @param indicativePrice displayed reference price
 * @param bufferPercent optional override
 * @param sessionId selected replay session
 * @param simulatedAt displayed replay time, never a quote selector */
public record OrderCheckRequest(@NotNull Integer accountId, @NotNull Integer instrumentId,
        @NotNull @Pattern(regexp = "BUY|SELL") String orderType,
        @NotNull @Positive BigDecimal quantity, @NotNull @Positive BigDecimal indicativePrice,
        @DecimalMin("0") @DecimalMax("10") @Digits(integer = 2, fraction = 2) BigDecimal bufferPercent,
        @Positive Long sessionId, OffsetDateTime simulatedAt) {
    /** Adapts to the common validation pipeline without persisting anything.
     * @return validation request */
    public OrderRequest asOrderRequest() {
        return new OrderRequest(accountId, instrumentId, orderType, quantity, indicativePrice,
                bufferPercent, UUID.randomUUID(), simulatedAt, sessionId);
    }
}
