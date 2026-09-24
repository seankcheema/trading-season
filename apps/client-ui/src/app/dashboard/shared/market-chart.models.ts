import { CandlePointDto } from '../market-data.service';
import { PricePoint } from '../mock-data';

export function normalizeMarketSymbol(symbol: string | null | undefined): string {
  return (symbol ?? '').trim().toUpperCase();
}

export function marketSymbolSlug(symbol: string): string {
  return normalizeMarketSymbol(symbol).toLowerCase();
}

export function candlePricePoints(candles: readonly CandlePointDto[]): PricePoint[] {
  return candles
    .map((candle) => ({
      time: new Date(candle.timestamp),
      value: candle.close,
      volume: candle.volume,
    }))
    .filter((point) => !Number.isNaN(point.time.getTime()) && Number.isFinite(point.value));
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
