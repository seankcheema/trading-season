import {
  applyLivePrice,
  candlePricePoints,
  marketSymbolSlug,
  normalizeMarketSymbol,
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

  it('updates only the latest price and timestamp while retaining its candle volume', () => {
    const points = [
      { time: new Date('2026-01-05T15:00:00Z'), value: 10, volume: 42 },
      { time: new Date('2026-01-05T15:01:00Z'), value: 11, volume: 50 },
    ];
    const updated = applyLivePrice(points, 12, '2026-01-05T15:01:30Z');
    expect(updated[1]).toEqual({ time: new Date('2026-01-05T15:01:30Z'), value: 12, volume: 50 });
    expect(points[1].value).toBe(11);
  });
});
