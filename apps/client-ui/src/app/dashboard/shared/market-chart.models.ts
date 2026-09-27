import { CandlePointDto } from '../market-data.service';
import { PricePoint } from '../mock-data';

export type ChartMode = 'line' | 'area' | 'candles' | 'ohlc' | 'volume' | 'percent';

export interface MarketCandlePoint {
  time: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export function normalizeMarketSymbol(symbol: string | null | undefined): string {
  return (symbol ?? '').trim().toUpperCase();
}

export function marketSymbolSlug(symbol: string): string {
  return normalizeMarketSymbol(symbol).toLowerCase();
}

export function marketCandlePoints(candles: readonly CandlePointDto[]): MarketCandlePoint[] {
  return candles
    .map((candle) => ({
      time: new Date(candle.timestamp),
      open: Number(candle.open),
      high: Number(candle.high),
      low: Number(candle.low),
      close: Number(candle.close),
      volume: Number(candle.volume),
    }))
    .filter(
      (point) =>
        !Number.isNaN(point.time.getTime()) &&
        [point.open, point.high, point.low, point.close, point.volume].every(Number.isFinite),
    );
}

export function candlePricePoints(candles: readonly CandlePointDto[]): PricePoint[] {
  return closePricePoints(marketCandlePoints(candles));
}

export function closePricePoints(candles: readonly MarketCandlePoint[]): PricePoint[] {
  return candles.map(({ time, close, volume }) => ({ time, value: close, volume }));
}

export function percentChangePoints(candles: readonly MarketCandlePoint[]): PricePoint[] {
  const baseline = candles[0]?.close;
  if (!baseline || !Number.isFinite(baseline)) {
    return candles.map(({ time, volume }) => ({ time, value: 0, volume }));
  }
  return candles.map(({ time, close, volume }) => ({
    time,
    value: ((close - baseline) / baseline) * 100,
    volume,
  }));
}

/** Updates the live endpoint without fabricating volume for the incoming price tick. */
export function applyLivePrice(
  points: readonly PricePoint[],
  price: number,
  timestamp: string,
): PricePoint[] {
  if (!points.length || !Number.isFinite(price)) {
    return [...points];
  }
  const time = new Date(timestamp);
  const latest = points[points.length - 1];
  return [
    ...points.slice(0, -1),
    {
      ...latest,
      time: Number.isNaN(time.getTime()) ? latest.time : time,
      value: price,
    },
  ];
}

/** Updates the latest candle close while retaining its completed OHLCV context. */
export function applyLiveCandlePrice(
  candles: readonly MarketCandlePoint[],
  price: number,
  timestamp: string,
): MarketCandlePoint[] {
  if (!candles.length || !Number.isFinite(price)) {
    return [...candles];
  }
  const time = new Date(timestamp);
  const latest = candles[candles.length - 1];
  return [
    ...candles.slice(0, -1),
    {
      ...latest,
      time: Number.isNaN(time.getTime()) ? latest.time : time,
      high: Math.max(latest.high, price),
      low: Math.min(latest.low, price),
      close: price,
    },
  ];
}
