import {
  applyLiveCandlePrice,
  applyLivePrice,
  bollingerBands,
  candlePricePoints,
  exponentialMovingAverage,
  MarketCandlePoint,
  marketCandlePoints,
  marketSymbolSlug,
  normalizeMarketSymbol,
  percentChangePoints,
  relativeStrengthIndex,
  simpleMovingAverage,
} from './market-chart.models';

describe('market chart models', () => {
  const candlesFromCloses = (closes: number[]): MarketCandlePoint[] =>
    closes.map((close, index) => ({
      time: new Date(Date.UTC(2026, 0, 1, 0, index)),
      open: close,
      high: close,
      low: close,
      close,
      volume: 1,
    }));

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

  it('calculates SMA only after a complete period and preserves timestamps', () => {
    const candles = candlesFromCloses([1, 2, 3, 4, 5]);
    const values = simpleMovingAverage(candles, 3);
    expect(values.map((point) => point.value)).toEqual([2, 3, 4]);
    expect(values.map((point) => point.time)).toEqual(candles.slice(2).map((point) => point.time));
  });

  it('seeds EMA with the first SMA and smooths subsequent closes', () => {
    const values = exponentialMovingAverage(candlesFromCloses([1, 2, 3, 6]), 3);
    expect(values.map((point) => point.value)).toEqual([2, 4]);
  });

  it('calculates Bollinger Bands with a 20-period mean and two standard deviations', () => {
    const candles = candlesFromCloses([1, 2, 3, 4]);
    const bands = bollingerBands(candles, 4, 2);
    expect(bands).toHaveLength(1);
    expect(bands[0].time).toBe(candles[3].time);
    expect(bands[0].middle).toBe(2.5);
    expect(bands[0].upper).toBeCloseTo(4.736, 3);
    expect(bands[0].lower).toBeCloseTo(0.264, 3);
  });

  it('calculates Wilder RSI for rising, falling, and flat prices', () => {
    expect(relativeStrengthIndex(candlesFromCloses([1, 2, 3, 4]), 3)[0].value).toBe(100);
    expect(relativeStrengthIndex(candlesFromCloses([4, 3, 2, 1]), 3)[0].value).toBe(0);
    expect(relativeStrengthIndex(candlesFromCloses([2, 2, 2, 2]), 3)[0].value).toBe(50);

    const smoothed = relativeStrengthIndex(candlesFromCloses([1, 2, 3, 4, 3]), 3);
    expect(smoothed.at(-1)?.value).toBeCloseTo(66.67, 2);
  });

  it('omits indicators until enough candles exist', () => {
    const candles = candlesFromCloses([1, 2]);
    expect(simpleMovingAverage(candles, 3)).toEqual([]);
    expect(exponentialMovingAverage(candles, 3)).toEqual([]);
    expect(bollingerBands(candles, 3)).toEqual([]);
    expect(relativeStrengthIndex(candles, 3)).toEqual([]);
  });

  it('rejects invalid periods and non-finite candle values', () => {
    const candles = candlesFromCloses([1, Number.NaN, 3]);
    expect(simpleMovingAverage(candles, 0)).toEqual([]);
    expect(exponentialMovingAverage(candles, 2.5)).toEqual([]);
    expect(bollingerBands(candles, 2, Number.NaN)).toEqual([]);
    expect(relativeStrengthIndex(candles, 2)).toEqual([]);
  });
});
