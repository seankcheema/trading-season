import {
  applyLiveCandlePrice,
  applyLivePrice,
  candlePricePoints,
  marketCandlePoints,
  marketSymbolSlug,
  normalizeMarketSymbol,
  percentChangePoints,
} from './market-chart.models';

describe('market chart models', () => {
  it('normalizes API symbols and canonical URL slugs', () => {
    expect(normalizeMarketSymbol(' aapl ')).toBe('AAPL');
    expect(marketSymbolSlug('NvDa')).toBe('nvda');
  });

  it('converts OHLCV candles into chart points with volume', () => {
    expect(
      candlePricePoints([
        { timestamp: '2026-01-05T15:00:00Z', open: 10, high: 12, low: 9, close: 11, volume: 42 },
      ])[0],
    ).toMatchObject({ value: 11, volume: 42 });
  });

  it('preserves complete OHLCV candles for detailed chart modes', () => {
    const candle = marketCandlePoints([
      { timestamp: '2026-01-05T15:00:00Z', open: 10, high: 12, low: 9, close: 11, volume: 42 },
    ])[0];
    expect(candle).toEqual({
      time: new Date('2026-01-05T15:00:00Z'),
      open: 10,
      high: 12,
      low: 9,
      close: 11,
      volume: 42,
    });
  });

  it('coerces decimal values serialized as strings by the API', () => {
    const candle = marketCandlePoints([
      {
        timestamp: '2026-01-05T15:00:00Z',
        open: '10.1',
        high: '12.2',
        low: '9.3',
        close: '11.4',
        volume: '42',
      } as unknown as Parameters<typeof marketCandlePoints>[0][number],
    ])[0];
    expect(candle).toMatchObject({ open: 10.1, high: 12.2, low: 9.3, close: 11.4, volume: 42 });
  });

  it('updates only the latest price and timestamp while retaining its candle volume', () => {
    const points = [
      { time: new Date('2026-01-05T15:00:00Z'), value: 10, volume: 42 },
      { time: new Date('2026-01-05T15:01:00Z'), value: 11, volume: 50 },
    ];
    const updated = applyLivePrice(points, 12, '2026-01-05T15:01:30Z');
    expect(updated[1]).toEqual({ time: new Date('2026-01-05T15:01:30Z'), value: 12, volume: 50 });
    expect(points[1].value).toBe(11);
  });

  it('updates the latest candle close and range for a live price', () => {
    const candles = marketCandlePoints([
      { timestamp: '2026-01-05T15:00:00Z', open: 10, high: 12, low: 9, close: 11, volume: 42 },
    ]);
    expect(applyLiveCandlePrice(candles, 13, '2026-01-05T15:01:00Z')[0]).toMatchObject({
      close: 13,
      high: 13,
      low: 9,
      volume: 42,
    });
    expect(candles[0].close).toBe(11);
  });

  it('normalizes percent change to the first close', () => {
    const candles = marketCandlePoints([
      { timestamp: '2026-01-05T15:00:00Z', open: 10, high: 10, low: 10, close: 10, volume: 1 },
      { timestamp: '2026-01-05T15:01:00Z', open: 10, high: 11, low: 9, close: 11, volume: 2 },
      { timestamp: '2026-01-05T15:02:00Z', open: 11, high: 11, low: 8, close: 9, volume: 3 },
    ]);
    expect(percentChangePoints(candles).map((point) => point.value)).toEqual([0, 10, -10]);
  });
});
