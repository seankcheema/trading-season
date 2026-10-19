import { AccountHolding } from '../dashboard/accounts/account.models';
import { CandlePointDto } from '../dashboard/market-data.service';
import { Instrument } from '../dashboard/mock-data';

export type DuaChoice = 'daily' | 'holdings' | 'stock';
export interface DuaCard {
  symbol: string;
  text: string;
  detail?: string;
}

export function percentChange(price: number, baseline: number): number | null {
  return Number.isFinite(price) && price > 0 && Number.isFinite(baseline) && baseline > 0
    ? ((price - baseline) / baseline) * 100
    : null;
}

export function dailyCard(stock: Instrument): DuaCard | null {
  const change = percentChange(stock.price, stock.price - stock.change);
  if (change === null) return null;
  return {
    symbol: stock.symbol,
    text: `${stock.symbol} is ${change > 0 ? 'up' : change < 0 ? 'down' : 'unchanged at'} ${Math.abs(change).toFixed(1)}% since session open.`,
  };
}

export function holdingCards(
  holdings: readonly AccountHolding[],
  quotes: readonly Instrument[],
): DuaCard[] {
  return holdings
    .flatMap((holding) => {
      const quote = quotes.find((item) => item.symbol === holding.symbol);
      const change = quote ? percentChange(quote.price, holding.averageCost) : null;
      if (change === null || holding.quantity <= 0 || !Number.isFinite(holding.quantity)) return [];
      const amount = (quote!.price - holding.averageCost) * holding.quantity;
      return [
        {
          change,
          symbol: holding.symbol,
          text: `${holding.symbol}: ${Math.abs(change).toFixed(1)}% ${change < 0 ? 'below' : 'above'} average purchase cost.`,
          detail: `${change <= -10 ? 'Down over 10% versus average cost. ' : ''}Unrealized ${amount < 0 ? 'loss' : 'gain'}: ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.abs(amount))}.`,
        },
      ];
    })
    .sort((a, b) => a.change - b.change || a.symbol.localeCompare(b.symbol))
    .slice(0, 3);
}

export function dailyReview(
  holdings: readonly AccountHolding[],
  quotes: readonly Instrument[],
): DuaCard[] {
  const symbols = new Set(holdings.filter((h) => h.quantity > 0).map((h) => h.symbol));
  const valid = quotes
    .filter((q) => symbols.has(q.symbol) && dailyCard(q) !== null)
    .map((q) => ({ quote: q, change: percentChange(q.price, q.price - q.change)! }))
    .sort((a, b) => b.change - a.change || a.quote.symbol.localeCompare(b.quote.symbol));
  const highest = valid.find((item) => item.change > 0);
  const lowest = [...valid].reverse().find((item) => item.change < 0);
  return [highest, lowest].flatMap((item) => (item ? [dailyCard(item.quote)!] : []));
}

// 1D candles are one-minute buckets. A candle is complete only after its full minute.
export function directionCard(
  symbol: string,
  points: readonly CandlePointDto[],
  cursor: string,
  timezone: string,
): DuaCard {
  const at = Date.parse(cursor);
  const date = (time: number) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(time);
  const completed = points
    .filter(
      (p) =>
        Number.isFinite(Date.parse(p.timestamp)) &&
        Date.parse(p.timestamp) + 60_000 <= at &&
        date(Date.parse(p.timestamp)) === date(at) &&
        Number.isFinite(p.close) &&
        p.close > 0,
    )
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
    .slice(-5);
  if (completed.length < 5)
    return { symbol, text: 'Not enough completed candles to describe recent direction.' };
  const rising = completed.slice(1).every((p, i) => p.close > completed[i].close);
  const falling = completed.slice(1).every((p, i) => p.close < completed[i].close);
  const change = percentChange(completed[4].close, completed[0].close)!;
  const time = (value: string) =>
    new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    }).format(new Date(value));
  return {
    symbol,
    text: `${symbol} ${rising ? 'rose' : falling ? 'fell' : 'had mixed movement'} across the last 5 completed candles.`,
    detail: `${time(new Date(Date.parse(completed[0].timestamp) + 60_000).toISOString())} to ${time(new Date(Date.parse(completed[4].timestamp) + 60_000).toISOString())}: ${change >= 0 ? '+' : ''}${change.toFixed(1)}% from first close to last.`,
  };
}
