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

// The simulated market's calendar, so an evening fill or clock lands on that day's session.
const MARKET_TIMEZONE = 'America/Chicago';
const marketDay = (at: string | number) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: MARKET_TIMEZONE }).format(new Date(at));

export function periodDate(at: string, period: 'daily' | 'week' | 'month'): string {
  const day = marketDay(at);
  if (period === 'daily') return day;
  if (period === 'month') return `${day.slice(0, 7)}-01`;
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

/**
 * Removes trade cash flows from holdings-value changes, including fully sold positions. The
 * baseline is the last close before the period, else the earliest open within it, so a period
 * that starts before the available history uses the most recent data there is.
 */
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
  const periodTrades = trades.filter((o) => marketDay(executionTime(o)) >= startDate);
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
    const startPrice = (openingBaseline ? undefined : previous?.close) ?? first?.open;
    const endPrice = quotes.find((q) => q.symbol === symbol)?.price ?? candles.at(-1)?.close;
    const quantity = startPositions.find((h) => h.symbol === symbol)?.quantity ?? 0;
    const endQuantity = ending.find((h) => h.symbol === symbol)?.quantity ?? 0;
    const fills = periodTrades.filter((o) => symbolFor(o) === symbol);
    // As elsewhere in the app, a fill without a recorded execution price uses its indicative price.
    const fillPrice = (o: OrderResult) => o.executionPrice ?? o.indicativePrice;
    const missing =
      (quantity !== 0 && !(startPrice! > 0)) ||
      (endQuantity !== 0 && !(endPrice! > 0)) ||
      fills.some((o) => !(fillPrice(o) > 0));
    const flow = fills.reduce(
      (sum, o) => sum + (o.orderType === 'BUY' ? -1 : 1) * o.quantity * fillPrice(o),
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
    timeZone: MARKET_TIMEZONE,
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

/** Ranks the positions that have a result; positions without price history are left out. */
function summarize(rows: readonly PerformanceRow[]) {
  const ranked = rows
    .filter((r) => r.gain !== null)
    .sort((a, b) => b.gain! - a.gain! || a.symbol.localeCompare(b.symbol));
  return {
    ranked,
    missing: rows.filter((r) => r.gain === null).map((r) => r.symbol),
    total: ranked.reduce((sum, r) => sum + r.gain!, 0),
  };
}

function totalMetric(rows: readonly PerformanceRow[], label: string): Metric[] {
  const { ranked, total } = summarize(rows);
  return ranked.length ? [{ label, value: signedDollars(total), tone: tone(total) }] : [];
}

/** Explains a period's result by naming the position that drove it; the amount is the metric. */
export function periodStatement(rows: readonly PerformanceRow[], when: string): string {
  const { ranked, missing, total } = summarize(rows);
  if (!rows.length) return 'No holdings to review yet.';
  if (!ranked.length) return `Performance ${when} is unavailable.`;
  const excluded = missing.length
    ? ` Excludes ${missing.join(', ')}, which ${missing.length === 1 ? 'has' : 'have'} no price history.`
    : '';
  if (total === 0) return `Your holdings were unchanged ${when}.${excluded}`;
  const driver = total > 0 ? ranked[0] : ranked.at(-1)!;
  return `Your holdings ${total > 0 ? 'gained' : 'lost'} value ${when}, led by ${driver.symbol} (${signedDollars(driver.gain!)}).${excluded}`;
}

const PERFORMANCE_DETAIL =
  'Ending holdings value minus starting value minus purchases plus sale proceeds. Shared cash and deposits are excluded. The starting value uses the last close before the period, or the earliest price within it when older history is not available.';

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

/** The position behind a period's result, or nothing when the period is flat or unavailable. */
function driverOf(rows: readonly PerformanceRow[]): string | undefined {
  const { ranked, total } = summarize(rows);
  if (!ranked.length || total === 0) return undefined;
  return (total > 0 ? ranked[0] : ranked.at(-1)!).symbol;
}

/**
 * Week-to-date (from Monday) and month-to-date amounts side by side, with one short line naming
 * what drove them; the amounts carry the result, so the line does not repeat them.
 */
export function periodPerformanceCard(
  week: readonly PerformanceRow[],
  month: readonly PerformanceRow[],
): DuaCard {
  const metrics = [...totalMetric(week, 'This week'), ...totalMetric(month, 'This month')];
  const weekly = driverOf(week);
  const monthly = driverOf(month);
  const missing = [...new Set([...summarize(week).missing, ...summarize(month).missing])];
  return {
    title: 'Your performance',
    metricsFirst: true,
    metrics,
    takeaway:
      !week.length && !month.length
        ? 'No holdings to review yet.'
        : weekly && monthly
          ? weekly === monthly
            ? `${weekly} moved your holdings the most this week and this month.`
            : `${weekly} moved your holdings the most this week, and ${monthly} this month.`
          : weekly || monthly
            ? `${weekly ?? monthly} moved your holdings the most ${weekly ? 'this week' : 'this month'}.`
            : metrics.length
              ? 'No change this week or this month.'
              : 'Performance is unavailable.',
    text: missing.length ? `Excludes ${missing.join(', ')} (no price history).` : '',
    detail: `${PERFORMANCE_DETAIL} The week starts on Monday and the month on the 1st.`,
  };
}

/**
 * The largest gains and losses in dollars, up to `count` of each, for one or more periods.
 * A period with no ranked position is left out.
 */
export function moversCard(
  periods: readonly { rows: readonly PerformanceRow[]; heading?: string }[],
  count: number,
): DuaCard {
  const plural = count > 1 ? 's' : '';
  const movers = periods.flatMap(({ rows, heading }) => {
    const { ranked } = summarize(rows);
    const row = (r: PerformanceRow) => ({ symbol: r.symbol, value: signedDollars(r.gain!) });
    return ranked.length
      ? [
          {
            heading,
            groups: [
              {
                label: `Biggest gainer${plural}`,
                tone: 'gain' as const,
                rows: ranked
                  .filter((r) => r.gain! > 0)
                  .slice(0, count)
                  .map(row),
                empty: 'No gains',
              },
              {
                label: `Biggest loser${plural}`,
                tone: 'loss' as const,
                rows: [...ranked]
                  .reverse()
                  .filter((r) => r.gain! < 0)
                  .slice(0, count)
                  .map(row),
                empty: 'No losses',
              },
            ],
          },
        ]
      : [];
  });
  return {
    title: 'Your biggest movers',
    metricsFirst: true,
    takeaway: movers.length ? '' : 'No gains or losses to rank.',
    text: '',
    movers,
    detail:
      'Dollar contributions include positions sold during the period; they are not since-purchase returns. Positions without price history are left out.',
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
