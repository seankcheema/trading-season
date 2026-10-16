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

/** Calculates a simple moving average using available candles during warm-up. */
export function simpleMovingAverage(
  candles: readonly MarketCandlePoint[],
  period: number,
): PricePoint[] {
  if (!validIndicatorInput(candles, period)) {
    return [];
  }
  const points: PricePoint[] = [];
  let sum = 0;
  candles.forEach((candle, index) => {
    sum += candle.close;
    if (index >= period) {
      sum -= candles[index - period].close;
    }
    points.push({ time: candle.time, value: sum / Math.min(index + 1, period) });
  });
  return points;
}

/** Calculates an EMA from the first close with a growing period during warm-up. */
export function exponentialMovingAverage(
  candles: readonly MarketCandlePoint[],
  period: number,
): PricePoint[] {
  if (!validIndicatorInput(candles, period)) {
    return [];
  }
  let value = candles[0].close;
  const points: PricePoint[] = [{ time: candles[0].time, value }];
  for (let index = 1; index < candles.length; index++) {
    const multiplier = 2 / (Math.min(index + 1, period) + 1);
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
  for (let index = 0; index < candles.length; index++) {
    const window = candles.slice(Math.max(0, index - period + 1), index + 1);
    const middle = window.reduce((sum, candle) => sum + candle.close, 0) / window.length;
    const variance =
      window.reduce((sum, candle) => sum + (candle.close - middle) ** 2, 0) / window.length;
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
  if (!validIndicatorInput(candles, period)) {
    return [];
  }
  let averageGain = 0;
  let averageLoss = 0;
  const points: PricePoint[] = [{ time: candles[0].time, value: 50 }];
  for (let index = 1; index < candles.length; index++) {
    const change = candles[index].close - candles[index - 1].close;
    const count = Math.min(index, period);
    averageGain = (averageGain * (count - 1) + Math.max(change, 0)) / count;
    averageLoss = (averageLoss * (count - 1) + Math.max(-change, 0)) / count;
    points.push({ time: candles[index].time, value: rsiValue(averageGain, averageLoss) });
  }
  return points;
}

function validIndicatorInput(candles: readonly MarketCandlePoint[], period: number): boolean {
  return (
    Number.isInteger(period) &&
    period > 0 &&
    candles.length > 0 &&
    candles.every((candle) => !Number.isNaN(candle.time.getTime()) && Number.isFinite(candle.close))
  );
}

function rsiValue(averageGain: number, averageLoss: number): number {
  if (averageGain === 0 && averageLoss === 0) {
    return 50;
  }
  if (averageLoss === 0) {
    return 100;
  }
  if (averageGain === 0) {
    return 0;
  }
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
