/**
 * The platform trend signal file and how a reading is taken from it.
 *
 * Written by the stock forecast pipeline (apps/holdings-and-trade-service/stock-forecast,
 * export-platform-trend.py); its fields are a contract with that script. Each symbol has
 * one record per trading day scored, made at that day's close and about the next
 * `horizonDays`: the model's probability that the price is higher then, the momentum the
 * pattern reads, the strong-trend read's call (or none, on a week too weak to call), and,
 * once the window has closed, the outcome and the realized move. The card leads with the
 * strong-trend read and quotes its record over its last RECORD_WINDOW closed calls with
 * the share of weeks it called; the model and the pattern are scored over the last
 * RECORD_WINDOW closed reads beside it. Only windows closed by the reading day count. A
 * read is a machine-learning output on a simulated market, never advice.
 */
import { RECORD_WINDOW, TrackRecord, tradingDate } from '../risk-outlook/platform-signals';

export type TrendCall = 'up' | 'down';

export interface TrendDay {
  date: string;
  probability: number;
  call: TrendCall;
  momentum: number;
  modelHits: number;
  modelDays: number;
  ruleHits: number;
  ruleDays: number;
  /** The last signalDays days' move against its noise; the read calls when it reaches the month's cut-off. */
  strength: number;
  /** The strong-trend read's call, or null on a week too weak to call. */
  signal: TrendCall | null;
  signalHits: number;
  signalDays: number;
  outcome: TrendCall | null;
  move: number | null;
}

export interface TrendSymbol {
  firstDay: string;
  lastDay: string;
  days: TrendDay[];
}

export interface PlatformTrend {
  generatedAt: string;
  question: string;
  horizonDays: number;
  momentumDays: number;
  model: string;
  rule: string;
  signalRule: string;
  signalDays: number;
  /** Each month's strength cut-off, or null for a month that makes no call. */
  signalCutoffs: Record<string, number | null>;
  notice: string;
  symbols: Record<string, TrendSymbol>;
}

/** One past call of the strong-trend read, and what then happened. */
export interface TrendRead {
  date: string;
  call: TrendCall;
  outcome: TrendCall;
  move: number;
  hit: boolean;
}

/** The strong-trend read's last RECORD_WINDOW closed calls, and how many closed weeks it took to make them. */
export interface SignalRecord {
  signalHits: number;
  signalCalls: number;
  /** Closed weeks looked back over to find those calls; calls / weeks is how often it speaks up. */
  signalWeeks: number;
}

export type TrendReading =
  | { kind: 'unknown-symbol' }
  | { kind: 'too-early'; firstDay: string }
  | ({
      kind: 'ready';
      asOf: string;
      /** The strong-trend read's call, which the card leads with; null when the trend is too weak to call. */
      call: TrendCall | null;
      modelCall: TrendCall;
      ruleCall: TrendCall;
      /** The model's chance that the price is higher after the horizon. */
      probability: number;
      /** The pattern's input: the log return over the last momentumDays. */
      momentum: number;
      strength: number;
      modelHits: number;
      modelDays: number;
      ruleHits: number;
      ruleDays: number;
      recent: TrendRead[];
    } & SignalRecord);

/** How many past reads the card lists as evidence. */
export const TREND_RECENT_READS = 6;

/** The pattern's call on a day: the next days continue the last ones' direction. */
function ruleCallFor(day: TrendDay): TrendCall {
  return day.momentum > 0 ? 'up' : 'down';
}

/** Each source's record over the last RECORD_WINDOW reads whose window had closed by the day at `index`. */
export function trendRecordAt(days: TrendDay[], index: number, horizon: number): TrackRecord {
  const record: TrackRecord = { modelHits: 0, modelDays: 0, ruleHits: 0, ruleDays: 0 };
  for (let j = index - horizon; j >= 0 && record.modelDays < RECORD_WINDOW; j--) {
    const day = days[j];
    if (!day.outcome) {
      continue;
    }
    record.modelDays++;
    record.ruleDays++;
    if (day.call === day.outcome) {
      record.modelHits++;
    }
    if (ruleCallFor(day) === day.outcome) {
      record.ruleHits++;
    }
  }
  return record;
}

/**
 * The strong-trend read's last RECORD_WINDOW calls whose window had closed by the day at
 * `index`, and how many closed weeks it looked back over to find them.
 */
export function signalRecordAt(days: TrendDay[], index: number, horizon: number): SignalRecord {
  const record: SignalRecord = { signalHits: 0, signalCalls: 0, signalWeeks: 0 };
  for (let j = index - horizon; j >= 0 && record.signalCalls < RECORD_WINDOW; j--) {
    const day = days[j];
    if (!day.outcome) {
      continue;
    }
    record.signalWeeks++;
    if (day.signal) {
      record.signalCalls++;
      if (day.signal === day.outcome) {
        record.signalHits++;
      }
    }
  }
  return record;
}

/** The index of the latest record made at a close strictly before the simulated moment's trading date. */
function latestIndexBefore(entry: TrendSymbol, marketTimestamp: string): number {
  const today = tradingDate(marketTimestamp);
  let latest = -1;
  for (const [index, day] of entry.days.entries()) {
    if (day.date >= today) {
      break;
    }
    latest = index;
  }
  return latest;
}

/** The reading for a symbol at a simulated moment; a day's own close is never used during that day. */
export function trendReadingFor(
  trend: PlatformTrend,
  symbol: string,
  marketTimestamp: string,
): TrendReading {
  const entry = trend.symbols[symbol.toUpperCase()];
  if (!entry) {
    return { kind: 'unknown-symbol' };
  }
  const index = latestIndexBefore(entry, marketTimestamp);
  if (index < 0) {
    return { kind: 'too-early', firstDay: entry.firstDay };
  }
  const latest = entry.days[index];
  return {
    kind: 'ready',
    asOf: latest.date,
    call: latest.signal,
    modelCall: latest.call,
    ruleCall: ruleCallFor(latest),
    probability: latest.probability,
    momentum: latest.momentum,
    strength: latest.strength,
    recent: trendRecentReads(entry.days, index, trend.horizonDays),
    ...trendRecordAt(entry.days, index, trend.horizonDays),
    ...signalRecordAt(entry.days, index, trend.horizonDays),
  };
}

/** The strong-trend read's last calls whose window had closed by the day at `latestIndex`, most recent first. */
export function trendRecentReads(
  days: TrendDay[],
  latestIndex: number,
  horizon: number,
): TrendRead[] {
  const reads: TrendRead[] = [];
  for (let j = latestIndex - horizon; j >= 0 && reads.length < TREND_RECENT_READS; j--) {
    const day = days[j];
    if (!day.outcome || day.move === null || !day.signal) {
      continue;
    }
    reads.push({
      date: day.date,
      call: day.signal,
      outcome: day.outcome,
      move: day.move,
      hit: day.signal === day.outcome,
    });
  }
  return reads;
}

/** One symbol's current read, for a list across the platform. */
export interface TrendOverviewRow {
  symbol: string;
  /** The strong-trend read's call, or null when the stock's trend is too weak to call. */
  call: TrendCall | null;
  momentum: number;
  hits: number;
  /** Closed calls behind `hits`, and the closed weeks it took to make them. */
  calls: number;
  weeks: number;
}

/** Every covered symbol's reading at a simulated moment, strongest momentum first. */
export function trendOverview(trend: PlatformTrend, marketTimestamp: string): TrendOverviewRow[] {
  const rows: TrendOverviewRow[] = [];
  for (const symbol of Object.keys(trend.symbols).sort()) {
    const reading = trendReadingFor(trend, symbol, marketTimestamp);
    if (reading.kind !== 'ready') {
      continue;
    }
    rows.push({
      symbol,
      call: reading.call,
      momentum: reading.momentum,
      hits: reading.signalHits,
      calls: reading.signalCalls,
      weeks: reading.signalWeeks,
    });
  }
  return rows.sort((a, b) => b.momentum - a.momentum);
}
