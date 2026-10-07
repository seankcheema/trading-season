import { cashAt, holdingsAt, executionTime } from './simulation-account';
import { InstrumentRef, OrderResult } from '../orders/order.models';
const catalogue: InstrumentRef[] = [
  {
    instrumentId: 7,
    ticker: 'AAPL',
    simulatedStockSymbol: 'AAPL',
    name: 'Apple',
    assetClass: 'Equity',
    market: 'US',
    currency: 'USD',
    tradable: true,
  },
];
const buy = Date.parse('2026-01-10T16:00:00Z');
const sell = Date.parse('2026-01-20T16:00:00Z');
const orders: OrderResult[] = [
  {
    orderId: 1,
    accountId: 1,
    instrumentId: 7,
    status: 'FILLED',
    orderType: 'BUY',
    quantity: 2,
    indicativePrice: 100,
    simulatedAt: new Date(buy).toISOString(),
    resolvedAt: '2026-10-01T18:00:00Z',
    submittedAt: '2026-10-01T18:00:00Z',
    rejectionReason: null,
  },
  {
    orderId: 2,
    accountId: 1,
    instrumentId: 7,
    status: 'FILLED',
    orderType: 'SELL',
    quantity: 2,
    indicativePrice: 120,
    simulatedAt: new Date(sell).toISOString(),
    resolvedAt: '2026-10-01T18:01:00Z',
    submittedAt: '2026-10-01T18:01:00Z',
    rejectionReason: null,
  },
];
describe('simulation account projection', () => {
  it('projects cash and cost basis using the fill price and server replay time', () => {
    const executed = {
      ...orders[0],
      executionPrice: 101,
      executedSimulatedAt: new Date(buy + 1000).toISOString(),
    };
    expect(executionTime(executed)).toBe(buy + 1000);
    expect(cashAt(798, [executed], buy)).toBe(1000);
    expect(
      holdingsAt(
        [{ symbol: 'AAPL', quantity: 2, averageCost: 101 }],
        [executed],
        catalogue,
        1,
        buy + 1000,
      )[0].averageCost,
    ).toBe(101);
  });
  it('rewinds and restores shares and cash at inclusive execution boundaries without mutating facts', () => {
    for (const [at, quantity, cash] of [
      [buy - 1, 0, 1000],
      [buy, 2, 800],
      [sell, 0, 1040],
      [buy, 2, 800],
      [buy - 1, 0, 1000],
    ]) {
      const positions = holdingsAt([], orders, catalogue, 1, at);
      expect(positions.reduce((sum, holding) => sum + holding.quantity, 0)).toBe(quantity);
      expect(cashAt(1040, orders, at)).toBe(cash);
      if (quantity) expect(positions[0].averageCost).toBe(100);
    }
    expect(orders).toHaveLength(2);
  });
  it('restarts the average cost after a position is sold out and bought again', () => {
    const rebuy = {
      ...orders[0],
      orderId: 3,
      quantity: 2,
      indicativePrice: 130,
      simulatedAt: '2026-01-25T16:00:00Z',
    };
    const at = Date.parse(rebuy.simulatedAt);
    // What the holdings service reports now: the 100 and 120 round trip is forgotten.
    const current = [{ symbol: 'AAPL', quantity: 2, averageCost: 130 }];
    const [position] = holdingsAt(current, [...orders, rebuy], catalogue, 1, at);
    expect(position.quantity).toBe(2);
    expect(position.averageCost).toBe(130);
    // Before the rebuy the position is closed, so nothing is held.
    expect(holdingsAt(current, [...orders, rebuy], catalogue, 1, sell)).toEqual([]);
  });
  it('keeps the average of the remaining shares after a partial sell', () => {
    const partial = [orders[0], { ...orders[1], quantity: 1 }];
    const rebuy = {
      ...orders[0],
      orderId: 3,
      quantity: 1,
      indicativePrice: 140,
      simulatedAt: '2026-01-25T16:00:00Z',
    };
    const current = [{ symbol: 'AAPL', quantity: 2, averageCost: 120 }];
    const [position] = holdingsAt(
      current,
      [...partial, rebuy],
      catalogue,
      1,
      Date.parse(rebuy.simulatedAt),
    );
    expect(position.quantity).toBe(2);
    expect(position.averageCost).toBe(120);
    // Rewound to just after the partial sell, the remaining share still costs 100.
    const [rewound] = holdingsAt(current, [...partial, rebuy], catalogue, 1, sell);
    expect(rewound.quantity).toBe(1);
    expect(rewound.averageCost).toBe(100);
  });
  it('ignores other accounts and unsuccessful trades and retains undated starting positions', () => {
    const current = [{ symbol: 'AAPL', quantity: 3, averageCost: 90 }];
    const positions = holdingsAt(
      current,
      orders.map((order) => ({ ...order, accountId: 2 })),
      catalogue,
      1,
      buy - 1,
    );
    expect(positions).toEqual(current);
    expect(
      cashAt(
        1040,
        orders.map((order) => ({ ...order, status: 'REJECTED' })),
        buy - 1,
      ),
    ).toBe(1040);
  });
  it('uses real execution time for old orders without simulated time', () => {
    const old = { ...orders[0], simulatedAt: null };
    expect(cashAt(800, [old], buy)).toBe(1000);
    expect(cashAt(800, [old], Date.parse(old.resolvedAt!))).toBe(800);
  });
});
