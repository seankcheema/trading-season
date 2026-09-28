import { CandlePointDto } from '../market-data.service';
import { PricePoint } from '../mock-data';

export type ChartMode = 'line' | 'area' | 'candles' | 'ohlc' | 'volume' | 'percent';
export type TechnicalIndicator = 'sma' | 'ema' | 'bollinger' | 'rsi';

export const TECHNICAL_INDICATOR_PERIODS = {
  sma: 20,
  ema: 20,
  bollinger: 20,
  rsi: 14,
} as const satisfies Record<TechnicalIndicator, number>;

export interface BollingerBandPoint {
  time: Date;
  middle: number;
  upper: number;
  lower: number;
}

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

/** Calculates a simple moving average and omits points before a complete window exists. */
export function simpleMovingAverage(
  candles: readonly MarketCandlePoint[],
  period: number,
): PricePoint[] {
  if (!validIndicatorInput(candles, period)) return [];
  const points: PricePoint[] = [];
  let sum = 0;
  candles.forEach((candle, index) => {
    sum += candle.close;
    if (index >= period) sum -= candles[index - period].close;
    if (index >= period - 1) points.push({ time: candle.time, value: sum / period });
  });
  return points;
}

/** Calculates an EMA seeded by the first complete period's simple moving average. */
export function exponentialMovingAverage(
  candles: readonly MarketCandlePoint[],
  period: number,
): PricePoint[] {
  if (!validIndicatorInput(candles, period)) return [];
  const seed = candles.slice(0, period).reduce((sum, candle) => sum + candle.close, 0) / period;
  const multiplier = 2 / (period + 1);
  let value = seed;
  const points: PricePoint[] = [{ time: candles[period - 1].time, value }];
  for (let index = period; index < candles.length; index++) {
    value = (candles[index].close - value) * multiplier + value;
    points.push({ time: candles[index].time, value });
  }
  return points;
}

/** Calculates Bollinger Bands from a moving average and population standard deviation. */
export function bollingerBands(
  candles: readonly MarketCandlePoint[],
  period: number,
  deviations = 2,
): BollingerBandPoint[] {
  if (!validIndicatorInput(candles, period) || !Number.isFinite(deviations) || deviations < 0) {
    return [];
  }
  const points: BollingerBandPoint[] = [];
  for (let index = period - 1; index < candles.length; index++) {
    const window = candles.slice(index - period + 1, index + 1);
    const middle = window.reduce((sum, candle) => sum + candle.close, 0) / period;
    const variance = window.reduce((sum, candle) => sum + (candle.close - middle) ** 2, 0) / period;
    const offset = Math.sqrt(variance) * deviations;
    points.push({
      time: candles[index].time,
      middle,
      upper: middle + offset,
      lower: middle - offset,
    });
  }
  return points;
}

/** Calculates RSI using Wilder smoothing; a flat market is represented by a neutral 50. */
export function relativeStrengthIndex(
  candles: readonly MarketCandlePoint[],
  period: number,
): PricePoint[] {
  if (!validIndicatorInput(candles, period) || candles.length <= period) return [];
  let gains = 0;
  let losses = 0;
  for (let index = 1; index <= period; index++) {
    const change = candles[index].close - candles[index - 1].close;
    gains += Math.max(change, 0);
    losses += Math.max(-change, 0);
  }
  let averageGain = gains / period;
  let averageLoss = losses / period;
  const points: PricePoint[] = [
    { time: candles[period].time, value: rsiValue(averageGain, averageLoss) },
  ];
  for (let index = period + 1; index < candles.length; index++) {
    const change = candles[index].close - candles[index - 1].close;
    averageGain = (averageGain * (period - 1) + Math.max(change, 0)) / period;
    averageLoss = (averageLoss * (period - 1) + Math.max(-change, 0)) / period;
    points.push({ time: candles[index].time, value: rsiValue(averageGain, averageLoss) });
  }
  return points;
}

function validIndicatorInput(candles: readonly MarketCandlePoint[], period: number): boolean {
  return (
    Number.isInteger(period) &&
    period > 0 &&
    candles.length >= period &&
    candles.every((candle) => !Number.isNaN(candle.time.getTime()) && Number.isFinite(candle.close))
  );
}

function rsiValue(averageGain: number, averageLoss: number): number {
  if (averageGain === 0 && averageLoss === 0) return 50;
  if (averageLoss === 0) return 100;
  if (averageGain === 0) return 0;
  return 100 - 100 / (1 + averageGain / averageLoss);
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
