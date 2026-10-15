import { InstrumentRef, OrderResult } from '../orders/order.models';
import {
  HistoryRow,
  cashActivity,
  cashHistoryRow,
  orderActivity,
  orderDate,
  orderHistoryRow,
  sortHistoryRows,
} from './activity';

const CATALOGUE: InstrumentRef[] = [
  {
    instrumentId: 7,
    ticker: 'AAPL.O',
    name: 'Apple',
    assetClass: 'Equity',
    market: 'US',
    currency: 'USD',
    tradable: true,
    simulatedStockSymbol: 'AAPL',
  },
];

function order(overrides: Partial<OrderResult> = {}): OrderResult {
  return {
    orderId: 1,
    instrumentId: 7,
    accountId: 1,
    status: 'FILLED',
    orderType: 'BUY',
    quantity: 3,
    indicativePrice: 10,
    rejectionReason: null,
    submittedAt: '2026-01-05T16:00:00Z',
    resolvedAt: '2026-01-05T16:00:05Z',
    ...overrides,
  };
}

describe('activity helpers', () => {
  it('shows expired orders as cancelled without expiry explanations and retains rejection reasons', () => {
    const expired = orderActivity(order({
      status: 'CANCELLED',
      rejectionCode: 'ORDER_EXPIRED',
      rejectionReason: 'Day order expired at market close',
    }), CATALOGUE);
    expect(expired.status).toBe('CANCELLED');
    expect(expired.detail).toBe('3 @ $10.00');
    expect(expired.rejectionReason).toBeNull();
    expect(orderActivity(order({
      status: 'REJECTED', rejectionReason: 'Insufficient holdings',
    }), CATALOGUE).rejectionReason).toBe('Insufficient holdings');
  });

  it('dates an order by replay time, then resolution, then submission', () => {
    expect(orderDate(order({ simulatedAt: '2026-01-02T15:00:00Z' }))).toBe('2026-01-02T15:00:00Z');
    expect(orderDate(order({ simulatedAt: 'nonsense' }))).toBe('2026-01-05T16:00:05Z');
    expect(orderDate(order({ status: 'PENDING', resolvedAt: null }))).toBe('2026-01-05T16:00:00Z');
  });

  it('types orders by side and reports their status', () => {
    const buy = orderActivity(order(), CATALOGUE);
    expect(buy).toMatchObject({
      label: 'AAPL',
      type: 'BUY',
      status: 'FILLED',
      value: 30,
      positive: false,
      detail: '3 @ $10.00',
    });
    expect(orderActivity(order({ orderType: 'SELL' }), CATALOGUE)).toMatchObject({
      type: 'SELL',
      positive: true,
    });
    expect(orderActivity(order({ status: 'PENDING' }), CATALOGUE).status).toBe('PENDING');
    expect(orderActivity(order({ status: 'REJECTED' }), CATALOGUE).status).toBe('REJECTED');
    expect(orderActivity(order({ instrumentId: 99 }), []).label).toBe('Order #1');
  });

  it.each([
    { executionType: 'LIMIT' as const, limitPrice: 95, expected: 95 },
    { executionType: 'STOP' as const, stopPrice: 105, expected: 105 },
    { executionType: 'STOP_LIMIT' as const, stopPrice: 105, limitPrice: 106, expected: 106 },
  ])('shows entered prices for open $executionType orders in both views', ({ expected, ...prices }) => {
    const pending = order({ ...prices, status: 'ACCEPTED', indicativePrice: 100 });
    expect(orderActivity(pending, CATALOGUE).value).toBe(3 * expected);
    const history = orderHistoryRow(pending, CATALOGUE, 'Primary');
    expect(history.price).toBe(expected);
    if (prices.stopPrice != null) expect(history.priceDetail).toContain('Stop $105.00');
    if (prices.limitPrice != null) expect(history.priceDetail).toContain('Limit');
  });

  it('retains the actual fill and the original conditional price', () => {
    const filled = order({ executionType: 'LIMIT', limitPrice: 95, executionPrice: 94 });
    expect(orderHistoryRow(filled, CATALOGUE, 'Primary').price).toBe(94);
    expect(orderActivity(filled, CATALOGUE).detail).toContain('Limit $95.00');
  });

  it('types cash transfers by direction and marks them completed', () => {
    const base = { cashTransactionId: 4, amount: 25, createdAt: '2026-01-05T16:00:00Z' };
    expect(cashActivity({ ...base, reason: 'DEPOSIT' })).toMatchObject({
      type: 'DEPOSIT',
      status: 'COMPLETED',
      positive: true,
    });
    expect(cashActivity({ ...base, reason: 'WITHDRAWAL' })).toMatchObject({
      type: 'WITHDRAWAL',
      status: 'COMPLETED',
      positive: false,
    });
  });

  describe('sortHistoryRows', () => {
    const rows: HistoryRow[] = [
      orderHistoryRow(
        order({ orderId: 1, quantity: 5, resolvedAt: '2026-01-05T10:00:00Z' }),
        CATALOGUE,
        'A',
      ),
      orderHistoryRow(
        order({ orderId: 2, quantity: 1, status: 'REJECTED', resolvedAt: '2026-01-05T12:00:00Z' }),
        CATALOGUE,
        'B',
      ),
      cashHistoryRow({
        cashTransactionId: 3,
        amount: 100,
        reason: 'DEPOSIT',
        createdAt: '2026-01-05T11:00:00Z',
      }),
    ];

    it('sorts by date in either direction', () => {
      expect(sortHistoryRows(rows, 'date', 'desc').map((row) => row.key)).toEqual([
        'order-2',
        'cash-3',
        'order-1',
      ]);
      expect(sortHistoryRows(rows, 'date', 'asc').map((row) => row.key)).toEqual([
        'order-1',
        'cash-3',
        'order-2',
      ]);
    });

    it('keeps rows without the column last whichever way it sorts', () => {
      expect(sortHistoryRows(rows, 'shares', 'desc').map((row) => row.key)).toEqual([
        'order-1',
        'order-2',
        'cash-3',
      ]);
      expect(sortHistoryRows(rows, 'shares', 'asc').map((row) => row.key)).toEqual([
        'order-2',
        'order-1',
        'cash-3',
      ]);
    });

    it('sorts text columns and does not mutate its input', () => {
      const before = rows.map((row) => row.key);
      expect(sortHistoryRows(rows, 'status', 'asc').map((row) => row.status)).toEqual([
        'COMPLETED',
        'FILLED',
        'REJECTED',
      ]);
      expect(rows.map((row) => row.key)).toEqual(before);
    });
  });
});
