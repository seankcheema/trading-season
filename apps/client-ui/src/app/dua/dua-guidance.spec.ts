import {
  activity,
  dailyPerformanceCard,
  moversCard,
  performance,
  periodDate,
  periodPerformanceCard,
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
  it('prices a fill without an execution price at its indicative price', () => {
    // Seeded demo fills carry their price on the fill row, not the order.
    const seeded = { ...fill('BUY', 110, 2), executionPrice: null };
    expect(
      performance(
        [{ symbol: 'JPM', quantity: 2, averageCost: 110 }],
        [seeded],
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
    // The only JPM bought by this account fills tomorrow, so there is nothing to report yet.
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
      ),
    ).toEqual([]);
  });
  it('counts an evening fill on its market day, not its UTC day', () => {
    // 8 pm in Chicago on the 21st, already the 22nd in UTC: yesterday's trade, not today's.
    const evening = fill('BUY', 100, 2, '2026-10-22T01:00:00Z');
    expect(
      performance(
        [{ symbol: 'JPM', quantity: 2, averageCost: 110 }],
        [evening],
        catalogue,
        1,
        at,
        '2026-10-22',
        candles,
        [],
        true,
      )[0].gain,
    ).toBe(20);
  });
  it('shows partial results explicitly', () => {
    const card = dailyPerformanceCard([{ symbol: 'JPM', gain: null }]);
    expect(card.takeaway).toContain('unavailable');
    expect(card.metrics).toEqual([]);
  });
  it('leads with the amount and names the position that drove it', () => {
    const card = dailyPerformanceCard([
      { symbol: 'JPM', gain: 30 },
      { symbol: 'MSFT', gain: -10 },
    ]);
    expect(card.metricsFirst).toBe(true);
    expect(card.metrics).toEqual([{ label: '', value: '+$20.00', tone: 'gain' }]);
    expect(card.takeaway).toBe('Your holdings gained value since the open, led by JPM (+$30.00).');
    expect(card.text).toBe('');
  });
  it('explains week and month results together', () => {
    const card = periodPerformanceCard(
      [{ symbol: 'JPM', gain: -5 }],
      [{ symbol: 'JPM', gain: 12 }],
    );
    expect(card.metrics?.map((m) => [m.label, m.value])).toEqual([
      ['This week', '-$5.00'],
      ['This month', '+$12.00'],
    ]);
    expect(card.takeaway).toBe('JPM moved your holdings the most this week and this month.');
    expect(card.text).toBe('');
    expect(
      periodPerformanceCard(
        [{ symbol: 'JPM', gain: 5 }],
        [
          { symbol: 'JPM', gain: 5 },
          { symbol: 'MSFT', gain: 20 },
        ],
      ).takeaway,
    ).toBe('JPM moved your holdings the most this week, and MSFT this month.');
  });
  it('ranks up to the requested number of gainers and losers', () => {
    const rows = [
      { symbol: 'A', gain: 5 },
      { symbol: 'B', gain: 40 },
      { symbol: 'C', gain: 12 },
      { symbol: 'D', gain: 1 },
      { symbol: 'E', gain: -8 },
      { symbol: 'F', gain: null },
    ];
    const daily = moversCard([{ rows }], 3);
    expect(daily.takeaway).toBe('');
    expect(daily.movers).toEqual([
      {
        heading: undefined,
        groups: [
          {
            label: 'Biggest gainers',
            tone: 'gain',
            rows: [
              { symbol: 'B', value: '+$40.00' },
              { symbol: 'C', value: '+$12.00' },
              { symbol: 'A', value: '+$5.00' },
            ],
            empty: 'No gains',
          },
          {
            label: 'Biggest losers',
            tone: 'loss',
            rows: [{ symbol: 'E', value: '-$8.00' }],
            empty: 'No losses',
          },
        ],
      },
    ]);
    const holdings = moversCard(
      [
        { rows: [{ symbol: 'JPM', gain: -3 }], heading: 'This week' },
        { rows: [], heading: 'This month' },
      ],
      1,
    );
    expect(holdings.movers?.map((s) => [s.heading, s.groups.map((g) => g.label)])).toEqual([
      ['This week', ['Biggest gainer', 'Biggest loser']],
    ]);
    expect(moversCard([{ rows: [] }], 3).takeaway).toBe('No gains or losses to rank.');
  });
  it('totals the positions that have data and names the ones left out', () => {
    const card = periodPerformanceCard(
      [
        { symbol: 'JPM', gain: 10 },
        { symbol: 'MSFT', gain: null },
      ],
      [],
    );
    expect(card.metrics).toEqual([{ label: 'This week', value: '+$10.00', tone: 'gain' }]);
    expect(card.takeaway).toBe('JPM moved your holdings the most this week.');
    expect(card.text).toBe('Excludes MSFT (no price history).');
    expect(
      dailyPerformanceCard([
        { symbol: 'JPM', gain: 10 },
        { symbol: 'MSFT', gain: null },
      ]).takeaway,
    ).toBe(
      'Your holdings gained value since the open, led by JPM (+$10.00). Excludes MSFT, which has no price history.',
    );
  });
  it('starts from the earliest price in the period when older history is missing', () => {
    expect(
      performance(
        [{ symbol: 'JPM', quantity: 2, averageCost: 80 }],
        [],
        catalogue,
        1,
        at,
        '2026-10-20',
        [{ ...candles[0], points: candles[0].points.slice(1) }],
        [{ symbol: 'JPM', price: 125 }],
      )[0].gain,
    ).toBe(30);
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
