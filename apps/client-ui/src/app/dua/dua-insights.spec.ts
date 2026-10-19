import { CandlePointDto } from '../dashboard/market-data.service';
import { Instrument } from '../dashboard/mock-data';
import { dailyCard, dailyReview, directionCard, holdingCards, percentChange } from './dua-insights';

describe('Dua insights', () => {
  const quote = (symbol: string, price: number, change: number): Instrument => ({
    symbol,
    name: symbol,
    price,
    change,
    changePercent: 0,
  });
  const holdings = [
    { symbol: 'AAPL', quantity: 2, averageCost: 100 },
    { symbol: 'TSLA', quantity: 3, averageCost: 100 },
  ];
  const candles = (closes: number[]): CandlePointDto[] =>
    closes.map((close, minute) => ({
      timestamp: `2026-01-05T15:0${minute}:00Z`,
      open: close,
      close,
      high: close,
      low: close,
      volume: 1,
    }));

  it('uses opening price rather than purchase cost or a supplied percentage', () => {
    expect(percentChange(110, 100)).toBeCloseTo(10);
    expect(dailyCard(quote('AAPL', 110, 10))?.text).toContain('up 10.0%');
    expect(dailyCard(quote('AAPL', 100, 0))?.text).toContain('unchanged');
    for (const baseline of [0, -1, NaN, Infinity]) expect(percentChange(10, baseline)).toBeNull();
    expect(percentChange(NaN, 100)).toBeNull();
    expect(dailyCard(quote('AAPL', 0, 1))).toBeNull();
  });

  it('selects held gainers and decliners, omitting missing categories', () => {
    expect(
      dailyReview(holdings, [
        quote('OTHER', 200, 100),
        quote('AAPL', 110, 10),
        quote('TSLA', 90, -10),
      ]).map((c) => c.symbol),
    ).toEqual(['AAPL', 'TSLA']);
    expect(dailyReview(holdings, [quote('AAPL', 110, 10)])).toHaveLength(1);
    expect(dailyReview([], [quote('AAPL', 110, 10)])).toEqual([]);
    expect(dailyReview(holdings, [quote('AAPL', 100, 0)])).toEqual([]);
  });

  it('sorts position losses and calculates monetary loss without substituting cost for price', () => {
    const cards = holdingCards(holdings, [quote('AAPL', 120, 10), quote('TSLA', 90, 5)]);
    expect(cards[0].symbol).toBe('TSLA');
    expect(cards[0].text).toContain('10.0% below');
    expect(cards[0].detail).toContain('Down over 10%');
    expect(cards[0].detail).toContain('$30.00');
    expect(holdingCards(holdings, [])).toEqual([]);
    expect(
      holdingCards([{ symbol: 'AAPL', averageCost: 0, quantity: 2 }], [quote('AAPL', 20, 1)]),
    ).toEqual([]);
  });

  it('describes rising, falling and mixed closes', () => {
    const result = (closes: number[]) =>
      directionCard('AAPL', candles(closes), '2026-01-05T15:05:00Z', 'America/Chicago');
    expect(result([100, 101, 102, 103, 104]).text).toContain('rose');
    expect(result([104, 103, 102, 101, 100]).text).toContain('fell');
    expect(result([100, 101, 101, 102, 103]).text).toContain('mixed');
    expect(result([100, 101, 102, 103, 104]).detail).toContain('+4.0%');
  });

  it('excludes unfinished and future candles and candles from another trading date', () => {
    expect(
      directionCard('AAPL', candles([1, 2, 3, 4, 5, 6]), '2026-01-05T15:04:30Z', 'America/Chicago')
        .text,
    ).toContain('Not enough');
    expect(
      directionCard('AAPL', candles([1, 2, 3, 4, 5]), '2026-01-06T15:05:00Z', 'America/Chicago')
        .text,
    ).toContain('Not enough');
    expect(
      directionCard(
        'AAPL',
        candles([1, 2, 3, 4, 5, 100]),
        '2026-01-05T15:05:00Z',
        'America/Chicago',
      ).detail,
    ).toContain('+400.0%');
  });
});
