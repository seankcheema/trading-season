package app.order.dto;

import java.math.BigDecimal;
import java.time.Instant;

/** Advisory result; no resources are reserved.
 * @param eligible whether the trade currently passes
 * @param rejectionCode machine-readable failure or null
 * @param rejectionReason explanation or null
 * @param bufferPercent effective protection
 * @param indicativePrice reference price
 * @param executionPrice current server price or null
 * @param estimatedTradeValue quantity times server price or null
 * @param priceBoundary inclusive maximum buy or minimum sell price
 * @param sessionId quote session or null
 * @param quoteTimestamp server replay time or null */
public record OrderCheckResponse(boolean eligible, String rejectionCode, String rejectionReason,
        BigDecimal bufferPercent, BigDecimal indicativePrice, BigDecimal executionPrice,
        BigDecimal estimatedTradeValue, BigDecimal priceBoundary, Long sessionId, Instant quoteTimestamp) { }
