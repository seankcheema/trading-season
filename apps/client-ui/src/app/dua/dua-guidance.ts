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

type PerformanceRow = { symbol: string; gain: number | null };
type Metric = NonNullable<DuaCard['metrics']>[number];
const tone = (n: number): 'gain' | 'loss' => (n < 0 ? 'loss' : 'gain');

function summarize(rows: readonly PerformanceRow[]) {
  const ranked = rows
    .filter((r) => r.gain !== null)
    .sort((a, b) => b.gain! - a.gain! || a.symbol.localeCompare(b.symbol));
  return {
    complete: rows.every((r) => r.gain !== null),
    total: rows.reduce((sum, r) => sum + (r.gain ?? 0), 0),
    ranked,
    best: ranked.find((r) => r.gain! > 0),
    worst: [...ranked].reverse().find((r) => r.gain! < 0),
  };
}

/** The total for a period as a metric, or nothing when any position lacks history. */
function totalMetric(rows: readonly PerformanceRow[], label: string): Metric[] {
  const { complete, total } = summarize(rows);
  return complete && rows.length ? [{ label, value: signedDollars(total), tone: tone(total) }] : [];
}

/** Explains a period's result by naming the position that drove it; the amount is the metric. */
export function periodStatement(rows: readonly PerformanceRow[], when: string): string {
  const { complete, total, best, worst } = summarize(rows);
  if (!rows.length) return 'No holdings to review yet.';
  if (!complete) return `Some performance data ${when} is unavailable.`;
  if (total === 0) return `Your holdings were unchanged ${when}.`;
  const driver = total > 0 ? best : worst;
  return `Your holdings ${total > 0 ? 'gained' : 'lost'} value ${when}${driver ? `, led by ${driver.symbol} (${signedDollars(driver.gain!)})` : ''}.`;
}

const PERFORMANCE_DETAIL =
  'Ending holdings value minus starting value minus purchases plus sale proceeds. Shared cash and deposits are excluded.';

export function dailyPerformanceCard(rows: readonly PerformanceRow[]): DuaCard {
  return {
    title: 'Your performance',
    metricsFirst: true,
    metrics: totalMetric(rows, ''),
    takeaway: periodStatement(rows, 'since the open'),
    text: '',
    detail: PERFORMANCE_DETAIL,
  };
}

/** Week-to-date (from Monday) and month-to-date results side by side. */
export function periodPerformanceCard(
  week: readonly PerformanceRow[],
  month: readonly PerformanceRow[],
): DuaCard {
  const weekly = periodStatement(week, 'this week');
  const monthly = periodStatement(month, 'this month');
  return {
    title: 'Your performance',
    metricsFirst: true,
    emphasizeText: true,
    metrics: [...totalMetric(week, 'This week'), ...totalMetric(month, 'This month')],
    takeaway: weekly,
    text: monthly === weekly ? '' : monthly,
    detail: `${PERFORMANCE_DETAIL} The week starts on Monday and the month on the 1st.`,
  };
}

/**
 * Biggest gainer and loser for each period. A period with any ranked position shows both slots,
 * so periods stay aligned; an empty slot has a blank symbol and reads None.
 */
export function moversCard(
  periods: readonly { rows: readonly PerformanceRow[]; when?: string }[],
): DuaCard {
  const metrics = periods.flatMap(({ rows, when }): Metric[] => {
    const { ranked, best, worst } = summarize(rows);
    if (!ranked.length) return [];
    const slot = (label: string, row: PerformanceRow | undefined): Metric =>
      row
        ? { label, symbol: row.symbol, value: signedDollars(row.gain!), tone: tone(row.gain!) }
        : { label, symbol: '', value: 'None' };
    const suffix = when ? ` ${when}` : '';
    return [slot(`Biggest gainer${suffix}`, best), slot(`Biggest loser${suffix}`, worst)];
  });
  const complete = periods.every(({ rows }) => rows.every((r) => r.gain !== null));
  return {
    title: 'Your biggest movers',
    metricsFirst: true,
    takeaway: metrics.length ? '' : 'No gains or losses to rank.',
    text: complete ? '' : 'Only positions with complete history are compared.',
    metrics,
    detail:
      'Dollar contributions include positions sold during the period; they are not since-purchase returns.',
  };
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
