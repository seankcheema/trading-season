package app.order.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * A client's order submission (KAN-95 acceptance criterion: "acquire
 * trading rules from the client"). {@code indicativePrice} and
 * {@code bufferPercent} are the trading rule itself, not just order
 * details — they're what {@code PriceBufferValidator} checks execution
 * against (BR-13, KAN-100).
 *
 * <p>{@code accountId} is included directly here as a stopgap: business-backend
 * does not yet resolve the calling account from an authenticated session
 * (see {@link app.order.OrderController}). Once that's wired
 * up, this field should come from the session instead of the request body,
 * and {@code OrderService} must verify it belongs to the caller.
 *
 * @param accountId        the account the order is placed against (temporary — see above)
 * @param instrumentId     the instrument being bought or sold
 * @param orderType        {@code BUY} or {@code SELL}
 * @param quantity         units to trade, must be positive
 * @param indicativePrice  the price shown to the trader before submission (BR-13)
 * @param bufferPercent    execution price tolerance for this order (KAN-100); when
 *                         omitted, falls back to the user's {@code execution_buffer_percent}
 * @param clientReference  client-generated idempotency key; retried submissions
 *                         with the same key return the original order's outcome
 */
public record OrderRequest(
        @NotNull Integer accountId,
        @NotNull Integer instrumentId,
        @NotNull @Pattern(regexp = "BUY|SELL") String orderType,
        @NotNull @Positive BigDecimal quantity,
        @NotNull @Positive BigDecimal indicativePrice,
        @PositiveOrZero BigDecimal bufferPercent,
        @NotNull UUID clientReference
) {
}


