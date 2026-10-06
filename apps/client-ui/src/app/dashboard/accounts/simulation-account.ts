import { AccountHolding } from './account.models';
import { InstrumentRef, OrderResult } from '../orders/order.models';

export function executionTime(order: OrderResult): number {
  const simulated = Date.parse(order.simulatedAt ?? '');
  return Number.isFinite(simulated) ? simulated : Date.parse(order.resolvedAt ?? '');
}

export function effectiveOrders(orders: readonly OrderResult[]): OrderResult[] {
  return orders.filter(
    (order) => order.status === 'FILLED' && Number.isFinite(executionTime(order)),
  );
}

// Reverse future trade effects from the persisted position; never mutate the ledger.
// Positions without dated orders are retained as starting positions.
export function holdingsAt(
  current: readonly AccountHolding[],
  orders: readonly OrderResult[],
  catalogue: readonly InstrumentRef[],
  accountId: number,
  at: number,
): AccountHolding[] {
  const trades = effectiveOrders(orders).filter((order) => order.accountId === accountId);
  const symbolFor = (order: OrderResult) => {
    const instrument = catalogue.find((item) => item.instrumentId === order.instrumentId);
    return instrument?.simulatedStockSymbol ?? instrument?.ticker;
  };
  const symbols = new Set([
    ...current.map((holding) => holding.symbol),
    ...trades.map(symbolFor).filter((symbol): symbol is string => !!symbol),
  ]);
  return [...symbols]
    .map((symbol) => {
      const position = current.find((holding) => holding.symbol === symbol);
      const history = trades.filter((order) => symbolFor(order) === symbol);
      const signedQuantity = (order: OrderResult) =>
        (order.orderType === 'BUY' ? 1 : -1) * order.quantity;
      const future = history.filter((order) => executionTime(order) > at);
      const quantity =
        (position?.quantity ?? 0) - future.reduce((sum, order) => sum + signedQuantity(order), 0);
      const startingQuantity =
        (position?.quantity ?? 0) - history.reduce((sum, order) => sum + signedQuantity(order), 0);
      // Same moving weighted average the holdings service reports: a buy blends its price in,
      // a sell leaves the average alone, and selling out forgets the position. Orders replay in
      // the order they were placed, as the ledger does, even if the clock was rewound between them.
      let held = Math.max(0, startingQuantity);
      let average = held > 0 ? (position?.averageCost ?? 0) : 0;
      const visible = history
        .filter((order) => executionTime(order) <= at)
        .sort((a, b) => a.orderId - b.orderId);
      for (const order of visible) {
        if (order.orderType === 'BUY') {
          average = (held * average + order.quantity * order.indicativePrice) / (held + order.quantity);
          held += order.quantity;
        } else {
          held -= order.quantity;
          if (held < 1e-9) {
            held = 0;
            average = 0;
          }
        }
      }
      return {
        symbol,
        quantity: Math.abs(quantity) < 1e-9 ? 0 : quantity,
        averageCost: quantity > 1e-9 ? average : 0,
      };
    })
    .filter((holding) => holding.quantity !== 0);
}

export function cashAt(current: number, orders: readonly OrderResult[], at: number): number {
  return (
    current +
    effectiveOrders(orders)
      .filter((order) => executionTime(order) > at)
      .reduce(
        (sum, order) =>
          sum + (order.orderType === 'BUY' ? 1 : -1) * order.quantity * order.indicativePrice,
        0,
      )
  );
}
