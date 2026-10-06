package app.holding;

import java.math.BigDecimal;

/**
 * A {@link HoldingMovement} paired with the price of the {@link Fill} it came from.
 *
 * <p>The input to {@link CostBasis}: just enough of the ledger to replay what a
 * position cost, without loading either entity.
 *
 * @param instrumentId  the instrument the position is in
 * @param quantityDelta signed change in quantity, positive for a buy and negative for a sell
 * @param quotePrice    the price the order executed at
 */
public record PricedMovement(Integer instrumentId, BigDecimal quantityDelta, BigDecimal quotePrice) {
}
