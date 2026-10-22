import { AccountHolding } from '../dashboard/accounts/account.models';
import {
  effectiveOrders,
  executionTime,
  holdingsAt,
} from '../dashboard/accounts/simulation-account';
import { CandleSeries } from '../dashboard/market-data.service';
import { InstrumentRef, OrderResult } from '../dashboard/orders/order.models';
import { tradingDate } from '../market-page/risk-outlook/platform-signals';
import { DuaCard } from './dua-insights';

export type InsightChoice = 'stock' | 'daily' | 'holdings';
export const dollars = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
export const signedDollars = (n: number) => `${n > 0 ? '+' : ''}${dollars(n)}`;

export function periodDate(at: string, period: 'daily' | 'week' | 'month'): string {
  const day = tradingDate(at);
  if (period === 'daily') return day;
  if (period === 'month') return `${day.slice(0, 7)}-01`;
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

/** Removes trade cash flows from holdings-value changes, including fully sold positions. */
export function performance(
  current: readonly AccountHolding[],
  orders: readonly OrderResult[],
  catalogue: readonly InstrumentRef[],
  accountId: number,
  at: string,
  startDate: string,
  series: readonly CandleSeries[],
  quotes: readonly { symbol: string; price: number }[] = [],
  openingBaseline = false,
): { symbol: string; gain: number | null }[] {
  const end = Date.parse(at);
  const trades = effectiveOrders(orders).filter(
    (o) => o.accountId === accountId && executionTime(o) <= end,
  );
  const symbolFor = (o: OrderResult) => {
    const ref = catalogue.find((i) => i.instrumentId === o.instrumentId);
    return ref?.simulatedStockSymbol ?? ref?.ticker;
  };
  const periodTrades = trades.filter(
    (o) => tradingDate(new Date(executionTime(o)).toISOString()) >= startDate,
  );
  const ending = holdingsAt(current, orders, catalogue, accountId, end);
  const starting = new Map(ending.map((h) => [h.symbol, h.quantity]));
  for (const order of periodTrades) {
    const symbol = symbolFor(order);
    if (symbol)
      starting.set(
        symbol,
        (starting.get(symbol) ?? 0) + (order.orderType === 'BUY' ? -1 : 1) * order.quantity,
      );
  }
  const startPositions = [...starting].map(([symbol, quantity]) => ({ symbol, quantity }));
  const symbols = new Set([...startPositions, ...ending].map((h) => h.symbol));
  periodTrades.forEach((o) => {
    const s = symbolFor(o);
    if (s) symbols.add(s);
  });
  const result = [...symbols].sort().map((symbol) => {
    const candles =
      series
        .find((s) => s.symbol === symbol)
        ?.points.filter((p) => Date.parse(p.timestamp) <= end) ?? [];
    const previous = candles.filter((p) => tradingDate(p.timestamp) < startDate).at(-1);
    const first = candles.find((p) => tradingDate(p.timestamp) >= startDate);
    const startPrice =
      (openingBaseline ? undefined : previous?.close) ??
      (first && tradingDate(first.timestamp) === startDate ? first.open : undefined);
    const endPrice = quotes.find((q) => q.symbol === symbol)?.price ?? candles.at(-1)?.close;
    const quantity = startPositions.find((h) => h.symbol === symbol)?.quantity ?? 0;
    const endQuantity = ending.find((h) => h.symbol === symbol)?.quantity ?? 0;
    const fills = periodTrades.filter((o) => symbolFor(o) === symbol);
    const missing =
      (quantity !== 0 && !(startPrice! > 0)) ||
      (endQuantity !== 0 && !(endPrice! > 0)) ||
      fills.some((o) => !(o.executionPrice! > 0));
    const flow = fills.reduce(
      (sum, o) => sum + (o.orderType === 'BUY' ? -1 : 1) * o.quantity * o.executionPrice!,
      0,
    );
    return {
      symbol,
      gain: missing ? null : endQuantity * (endPrice ?? 0) - quantity * (startPrice ?? 0) + flow,
    };
  });
  if (periodTrades.some((o) => !symbolFor(o))) result.push({ symbol: 'Unknown stock', gain: null });
  return result;
}

/** Uses completed sessions only; an incomplete trading day cannot inflate activity. */
export function activity(
  series: CandleSeries | undefined,
  at: string,
): { label: string; ratio?: number } {
  const volumes = new Map<string, number>();
  const marketTime = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Chicago',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(at));
  for (const point of series?.points ?? []) {
    const date = tradingDate(point.timestamp);
    if (
      (date < tradingDate(at) || (date === tradingDate(at) && marketTime >= '15:00')) &&
      Date.parse(point.timestamp) <= Date.parse(at)
    ) {
      volumes.set(date, (volumes.get(date) ?? 0) + point.volume);
    }
  }
  const days = [...volumes.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  if (days.length < 21) return { label: 'Not enough volume history yet' };
  const baseline = days.slice(-21, -1).reduce((a, b) => a + b, 0) / 20;
  if (!(baseline > 0)) return { label: 'Volume unavailable' };
  const ratio = days.at(-1)! / baseline;
  return {
    label: ratio >= 1.5 ? 'Elevated activity' : ratio < 0.75 ? 'Quiet activity' : 'Usual activity',
    ratio,
  };
}

export function performanceCards(
  rows: { symbol: string; gain: number | null }[],
  period: string,
): DuaCard[] {
  const complete = rows.every((r) => r.gain !== null);
  const total = rows.reduce((sum, r) => sum + (r.gain ?? 0), 0);
  const ranked = rows
    .filter((r) => r.gain !== null)
    .sort((a, b) => b.gain! - a.gain! || a.symbol.localeCompare(b.symbol));
  const best = ranked.find((r) => r.gain! > 0);
  const worst = [...ranked].reverse().find((r) => r.gain! < 0);
  return [
    {
      title: 'Your performance',
      period,
      takeaway: !rows.length
        ? 'No holdings to review yet.'
        : !complete
          ? 'Some performance data is unavailable.'
          : `Your holdings ${total < 0 ? 'lost' : 'gained'} ${dollars(Math.abs(total))}.`,
      text: 'Your investment gains and losses for this period.',
      detail:
        'Ending holdings value minus starting value minus purchases plus sale proceeds. Shared cash and deposits are excluded.',
      metrics:
        complete && rows.length
          ? [{ label: period, value: signedDollars(total), tone: total < 0 ? 'loss' : 'gain' }]
          : [],
    },
    {
      title: 'Your biggest movers',
      period,
      takeaway: best
        ? `${best.symbol} contributed the most.`
        : worst
          ? `${worst.symbol} weighed on your holdings.`
          : 'No gains or losses to rank.',
      text: complete
        ? 'Your largest gains and losses this period.'
        : 'Only positions with complete history are compared.',
      metrics: [best, worst]
        .filter((r): r is NonNullable<typeof r> => !!r)
        .map((r) => ({
          symbol: r.symbol,
          label: r.symbol,
          value: signedDollars(r.gain!),
          tone: r.gain! > 0 ? 'gain' : 'loss',
        })),
      detail:
        'Dollar contributions include positions sold during this period; they are not since-purchase returns.',
    },
  ];
}

/** Compact, deterministic content version; raw trade histories never cross the state API. */
export function insightVersion(value: unknown): string {
  const text = JSON.stringify(value);
  let a = 2166136261;
  let b = 5381;
  for (let i = 0; i < text.length; i++) {
    a = Math.imul(a ^ text.charCodeAt(i), 16777619);
    b = Math.imul(b, 33) ^ text.charCodeAt(i);
  }
  return `v2-${(a >>> 0).toString(16)}-${(b >>> 0).toString(16)}`;
}
