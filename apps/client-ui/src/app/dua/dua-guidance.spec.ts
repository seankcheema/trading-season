import {
  activity,
  performance,
  performanceCards,
  periodDate,
  insightVersion,
} from './dua-guidance';
import { CandleSeries } from '../dashboard/market-data.service';
import { InstrumentRef, OrderResult } from '../dashboard/orders/order.models';

const catalogue = [
  { instrumentId: 1, ticker: 'JPM', simulatedStockSymbol: 'JPM' },
] as InstrumentRef[];
const at = '2026-10-22T18:00:00Z';
const candles = [
  {
    symbol: 'JPM',
    points: [
      { timestamp: '2026-10-19T14:00:00Z', open: 100, close: 100, volume: 100 },
      { timestamp: '2026-10-22T14:00:00Z', open: 110, close: 120, volume: 150 },
    ],
  },
] as CandleSeries[];
function fill(
  side: 'BUY' | 'SELL',
  price: number,
  quantity: number,
  time = '2026-10-22T15:00:00Z',
): OrderResult {
  return {
    orderId: 1,
    instrumentId: 1,
    accountId: 1,
    status: 'FILLED',
    orderType: side,
    quantity,
    executionPrice: price,
    indicativePrice: price,
    simulatedAt: time,
  } as OrderResult;
}
describe('Dua performance', () => {
  it('subtracts purchases instead of calling them profit', () => {
    expect(
      performance(
        [{ symbol: 'JPM', quantity: 2, averageCost: 110 }],
        [fill('BUY', 110, 2)],
        catalogue,
        1,
        at,
        '2026-10-22',
        candles,
      )[0].gain,
    ).toBe(20);
  });
  it('includes fully sold positions and sale proceeds', () => {
    expect(
      performance([], [fill('SELL', 115, 2)], catalogue, 1, at, '2026-10-22', candles)[0].gain,
    ).toBe(30);
  });
  it('uses session open for daily review and current prices for ending value', () => {
    expect(
      performance(
        [{ symbol: 'JPM', quantity: 2, averageCost: 80 }],
        [],
        catalogue,
        1,
        at,
        '2026-10-22',
        candles,
        [{ symbol: 'JPM', price: 125 }],
        true,
      )[0].gain,
    ).toBe(30);
  });
  it('does not invent a baseline from average purchase cost', () => {
    expect(
      performance(
        [{ symbol: 'JPM', quantity: 2, averageCost: 80 }],
        [],
        catalogue,
        1,
        at,
        '2026-10-01',
        [],
      )[0].gain,
    ).toBeNull();
  });
  it('ignores future fills and another account', () => {
    const future = fill('BUY', 130, 2, '2026-10-23T15:00:00Z');
    const other = { ...fill('BUY', 110, 2), accountId: 2 };
    expect(
      performance(
        [{ symbol: 'JPM', quantity: 2, averageCost: 130 }],
        [future, other],
        catalogue,
        1,
        at,
        '2026-10-22',
        candles,
      )[0].gain,
    ).toBe(0);
  });
  it('shows partial results explicitly', () => {
    expect(performanceCards([{ symbol: 'JPM', gain: null }], 'Today')[0].takeaway).toContain(
      'unavailable',
    );
  });
  it('uses simulation-local calendar boundaries', () => {
    expect(periodDate(at, 'week')).toBe('2026-10-19');
    expect(periodDate(at, 'month')).toBe('2026-10-01');
    expect(periodDate('2026-10-22T01:00:00Z', 'daily')).toBe('2026-10-21');
  });
  it('uses completed volume sessions and requires 20 baseline sessions', () => {
    const points = Array.from({ length: 22 }, (_, i) => ({
      timestamp: `2026-10-${String(i + 1).padStart(2, '0')}T14:00:00Z`,
      volume: i === 20 ? 200 : 100,
    }));
    const series = { points } as CandleSeries;
    expect(activity(series, at).label).toBe('Elevated activity');
    expect(activity({ points: points.slice(-20) } as CandleSeries, at).ratio).toBeUndefined();
  });
  it('keeps versions deterministic and compact', () => {
    expect(insightVersion(['a', 1])).toBe(insightVersion(['a', 1]));
    expect(insightVersion(['a', 1])).not.toBe(insightVersion(['a', 2]));
  });
});
