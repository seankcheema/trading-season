package app.record;

import app.account.PortfolioValuation;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * The market value of an account's holdings at a moment, published as
 * {@value #TYPE}. Keyed by account, not by valuation: only the newest value
 * of an account matters to a consumer, so a later one replaces an earlier one
 * when the topic is compacted.
 *
 * @param valuationId    the valuation row
 * @param accountId      the account valued
 * @param observedAt     when the value was observed
 * @param portfolioValue the value of the account's holdings, excluding cash
 */
public record PortfolioValuationRecord(
        Long valuationId,
        Integer accountId,
        Instant observedAt,
        BigDecimal portfolioValue) implements PlatformRecord {

    /** The record type valuations are published under. */
    public static final String TYPE = "PORTFOLIO_VALUATION";

    /**
     * Captures a saved valuation.
     *
     * @param valuation the valuation after it was saved, so that it has its id
     * @return the record describing it
     */
    public static PortfolioValuationRecord from(PortfolioValuation valuation) {
        return new PortfolioValuationRecord(valuation.getId(), valuation.getAccountId(),
                valuation.getObservedAt(), valuation.getValue());
    }

    @Override
    public String recordType() {
        return TYPE;
    }

    @Override
    public String recordId() {
        return String.valueOf(accountId);
    }
}
