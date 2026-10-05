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
  it('dates an order by replay time, then resolution, then submission', () => {
    expect(orderDate(order({ simulatedAt: '2026-01-02T15:00:00Z' }))).toBe('2026-01-02T15:00:00Z');
    expect(orderDate(order({ simulatedAt: 'nonsense' }))).toBe('2026-01-05T16:00:05Z');
    expect(orderDate(order({ status: 'PENDING', resolvedAt: null }))).toBe('2026-01-05T16:00:00Z');
  });

  it('tags orders by status and colors the amount by cash direction', () => {
    const buy = orderActivity(order(), CATALOGUE);
    expect(buy).toMatchObject({
      label: 'AAPL',
      tag: 'FILLED',
      value: 30,
      positive: false,
      detail: '3 @ $10.00 · Buy',
    });
    expect(orderActivity(order({ orderType: 'SELL' }), CATALOGUE).positive).toBe(true);
    expect(orderActivity(order({ status: 'PENDING' }), CATALOGUE).tag).toBe('PENDING');
    expect(orderActivity(order({ status: 'REJECTED' }), CATALOGUE).tag).toBe('REJECTED');
    expect(orderActivity(order({ instrumentId: 99 }), []).label).toBe('Order #1');
  });

  it('tags cash transfers by direction', () => {
    const base = { cashTransactionId: 4, amount: 25, createdAt: '2026-01-05T16:00:00Z' };
    expect(cashActivity({ ...base, reason: 'DEPOSIT' })).toMatchObject({
      tag: 'DEPOSIT',
      positive: true,
    });
    expect(cashActivity({ ...base, reason: 'WITHDRAWAL' })).toMatchObject({
      tag: 'WITHDRAWAL',
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
      expect(sortHistoryRows(rows, 'tag', 'asc').map((row) => row.tag)).toEqual([
        'DEPOSIT',
        'FILLED',
        'REJECTED',
      ]);
      expect(rows.map((row) => row.key)).toEqual(before);
    });
  });
});
