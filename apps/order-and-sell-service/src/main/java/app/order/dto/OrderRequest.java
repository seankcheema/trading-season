package app.order.dto;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Null;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

/** Authenticated stock instruction. Server quotes and saved preferences determine protection.
 * @param accountId owned account
 * @param instrumentId traded instrument
 * @param orderType BUY or SELL
 * @param quantity positive whole shares
 * @param indicativePrice client display price, never the execution source
 * @param bufferPercent obsolete override; must be absent
 * @param clientReference account-scoped idempotency key
 * @param simulatedAt client display time, never the authoritative cursor
 * @param executionType MARKET, LIMIT, STOP or STOP_LIMIT; defaults to MARKET
 * @param limitPrice required only for limit-bearing orders
 * @param stopPrice required only for stop-bearing orders
 * @param sessionId optional simulation session */
public record OrderRequest(
        @NotNull Integer accountId,
        @NotNull Integer instrumentId,
        @NotNull @Pattern(regexp = "BUY|SELL") String orderType,
        @NotNull @Positive @Digits(integer = 10, fraction = 0) BigDecimal quantity,
        @NotNull @Positive @Digits(integer = 12, fraction = 6) BigDecimal indicativePrice,
        @Null(message = "Configure the execution buffer in trading settings") BigDecimal bufferPercent,
        @NotNull UUID clientReference,
        OffsetDateTime simulatedAt,
        @io.swagger.v3.oas.annotations.media.Schema(allowableValues = {"MARKET", "LIMIT", "STOP", "STOP_LIMIT"}, defaultValue = "MARKET")
        @Pattern(regexp = "MARKET|LIMIT|STOP|STOP_LIMIT") String executionType,
        @io.swagger.v3.oas.annotations.media.Schema(description = "Required only for LIMIT and STOP_LIMIT")
        @Positive @Digits(integer = 12, fraction = 6) BigDecimal limitPrice,
        @io.swagger.v3.oas.annotations.media.Schema(description = "Required only for STOP and STOP_LIMIT")
        @Positive @Digits(integer = 12, fraction = 6) BigDecimal stopPrice,
        @Positive Long sessionId) {
    /** Defaults legacy submissions to market instructions.
     * @param accountId owned account
     * @param instrumentId traded instrument
     * @param orderType BUY or SELL
     * @param quantity positive whole shares
     * @param indicativePrice display price
     * @param bufferPercent obsolete override
     * @param clientReference idempotency key
     * @param simulatedAt display cursor
     * @param executionType execution condition
     * @param limitPrice conditional limit
     * @param stopPrice conditional stop
     * @param sessionId optional session */
    public OrderRequest {
        executionType = executionType == null ? "MARKET" : executionType;
    }
    /** Checks conditional price fields.
     * @return whether required and forbidden prices match the execution type */
    @com.fasterxml.jackson.annotation.JsonIgnore
    @AssertTrue(message = "Limit and stop prices must match the execution type")
    public boolean isPriceConfigurationValid() {
        return (limitPrice != null) == ("LIMIT".equals(executionType) || "STOP_LIMIT".equals(executionType))
            && (stopPrice != null) == ("STOP".equals(executionType) || "STOP_LIMIT".equals(executionType));
    }
    /** Legacy Java caller constructor.
     * @param accountId owned account
     * @param instrumentId instrument
     * @param orderType side
     * @param quantity shares
     * @param indicativePrice display price
     * @param bufferPercent obsolete override
     * @param clientReference key
     * @param simulatedAt display cursor */
    public OrderRequest(Integer accountId, Integer instrumentId, String orderType, BigDecimal quantity,
            BigDecimal indicativePrice, BigDecimal bufferPercent, UUID clientReference, OffsetDateTime simulatedAt) {
        this(accountId, instrumentId, orderType, quantity, indicativePrice, bufferPercent, clientReference, simulatedAt,
                "MARKET", null, null, null);
    }
    /** Legacy Java caller constructor without display cursor.
     * @param accountId owned account
     * @param instrumentId instrument
     * @param orderType side
     * @param quantity shares
     * @param indicativePrice display price
     * @param bufferPercent obsolete override
     * @param clientReference key */
    public OrderRequest(Integer accountId, Integer instrumentId, String orderType, BigDecimal quantity,
            BigDecimal indicativePrice, BigDecimal bufferPercent, UUID clientReference) {
        this(accountId, instrumentId, orderType, quantity, indicativePrice, bufferPercent, clientReference, null);
    }
}
