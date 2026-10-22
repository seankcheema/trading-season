/**
 * The platform trend signal file and how a reading is taken from it.
 *
 * Written by the stock forecast pipeline (apps/holdings-and-trade-service/stock-forecast,
 * export-platform-trend.py); its fields are a contract with that script. Each symbol has
 * one record per trading day scored, made at that day's close and about the next
 * `horizonDays`: the model's probability that the price is higher then, the momentum the
 * pattern reads, and, once the window has closed, the outcome and the realized move. As
 * with the volatility signal, the running counts cover only windows closed by that day,
 * and the card compares the model and the pattern over the last RECORD_WINDOW closed
 * reads. A read is a machine-learning output on a simulated market, never advice.
 */
import {
  MIN_RECORD_DAYS,
  RECORD_WINDOW,
  TrackRecord,
  tradingDate,
} from '../risk-outlook/platform-signals';

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
  notice: string;
  symbols: Record<string, TrendSymbol>;
}

/** One past read as the card showed it at the time, and what then happened. */
export interface TrendRead {
  date: string;
  call: TrendCall;
  source: 'model' | 'rule';
  outcome: TrendCall;
  move: number;
  hit: boolean;
}

export type TrendReading =
  | { kind: 'unknown-symbol' }
  | { kind: 'too-early'; firstDay: string }
  | {
      kind: 'ready';
      asOf: string;
      call: TrendCall;
      /** Whose call this is: the model's where its recent record beats the pattern's, else the pattern's. */
      source: 'model' | 'rule';
      modelCall: TrendCall;
      ruleCall: TrendCall;
      /** The model's chance that the price is higher after the horizon. */
      probability: number;
      /** The pattern's input: the log return over the last momentumDays. */
      momentum: number;
      modelHits: number;
      modelDays: number;
      ruleHits: number;
      ruleDays: number;
      recent: TrendRead[];
    };

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

function cardCall(
  days: TrendDay[],
  index: number,
  horizon: number,
): { call: TrendCall; source: 'model' | 'rule'; ruleCall: TrendCall } {
  const day = days[index];
  const ruleCall = ruleCallFor(day);
  const record = trendRecordAt(days, index, horizon);
  const modelAhead =
    record.modelDays >= MIN_RECORD_DAYS &&
    record.modelHits / record.modelDays > record.ruleHits / record.ruleDays;
  return {
    call: modelAhead ? day.call : ruleCall,
    source: modelAhead ? 'model' : 'rule',
    ruleCall,
  };
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
  const shown = cardCall(entry.days, index, trend.horizonDays);
  return {
    kind: 'ready',
    asOf: latest.date,
    call: shown.call,
    source: shown.source,
    modelCall: latest.call,
    ruleCall: shown.ruleCall,
    probability: latest.probability,
    momentum: latest.momentum,
    recent: trendRecentReads(entry.days, index, trend.horizonDays),
    ...trendRecordAt(entry.days, index, trend.horizonDays),
  };
}

/** The last reads whose window had closed by the day at `latestIndex`, most recent first. */
export function trendRecentReads(
  days: TrendDay[],
  latestIndex: number,
  horizon: number,
): TrendRead[] {
  const reads: TrendRead[] = [];
  for (let j = latestIndex - horizon; j >= 0 && reads.length < TREND_RECENT_READS; j--) {
    const day = days[j];
    if (!day.outcome || day.move === null) {
      continue;
    }
    const shown = cardCall(days, j, horizon);
    reads.push({
      date: day.date,
      call: shown.call,
      source: shown.source,
      outcome: day.outcome,
      move: day.move,
      hit: shown.call === day.outcome,
    });
  }
  return reads;
}

/** One symbol's current read, for a list across the platform. */
export interface TrendOverviewRow {
  symbol: string;
  call: TrendCall;
  source: 'model' | 'rule';
  momentum: number;
  hits: number;
  days: number;
}

/** Every covered symbol's reading at a simulated moment, strongest momentum first. */
export function trendOverview(trend: PlatformTrend, marketTimestamp: string): TrendOverviewRow[] {
  const rows: TrendOverviewRow[] = [];
  for (const symbol of Object.keys(trend.symbols).sort()) {
    const reading = trendReadingFor(trend, symbol, marketTimestamp);
    if (reading.kind !== 'ready') {
      continue;
    }
    const model = reading.source === 'model';
    rows.push({
      symbol,
      call: reading.call,
      source: reading.source,
      momentum: reading.momentum,
      hits: model ? reading.modelHits : reading.ruleHits,
      days: model ? reading.modelDays : reading.ruleDays,
    });
  }
  return rows.sort((a, b) => b.momentum - a.momentum);
}
