package app.holding;

import app.instrument.Instrument;

import java.math.BigDecimal;

/**
 * A position together with what it is in and what it cost.
 *
 * <p>Neither the instrument nor the cost is on the holding row, so this carries
 * the three pieces a client needs as one value and keeps the assembling query in
 * the service rather than the controller.
 *
 * @param holding     the cached position
 * @param instrument  the instrument held, or null when no instrument row matches
 * @param averageCost average price paid per share, or null when no fill history
 *                    explains the position
 */
public record HoldingWithCost(Holding holding, Instrument instrument, BigDecimal averageCost) {
}
