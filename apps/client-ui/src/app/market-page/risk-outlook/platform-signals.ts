/**
 * The platform risk signal file and how a reading is taken from it.
 *
 * The file is written by the stock forecast pipeline
 * (apps/holdings-and-trade-service/stock-forecast, export-platform-signals.py) and
 * its fields are a contract with that script. Each symbol has one record per
 * trading day the model scored, made at that day's close and about the next
 * `horizonDays`. The running counts on a record cover only windows that had
 * closed by that day, so a reading taken at any simulated date never uses
 * prices after it.
 */
export type Call = 'stormier' | 'calmer';

export interface SignalDay {
  date: string;
  probability: number;
  call: Call;
  usualVolatility: number;
  recentVolatility: number;
  modelHits: number;
  modelDays: number;
  ruleHits: number;
  ruleDays: number;
  outcome: Call | null;
}

export interface SignalSymbol {
  firstDay: string;
  lastDay: string;
  days: SignalDay[];
}

export interface PlatformSignals {
  generatedAt: string;
  question: string;
  horizonDays: number;
  usualWindowDays: number;
  model: string;
  rule: string;
  symbols: Record<string, SignalSymbol>;
}

/** Closed windows the model needs before its record can outrank the rule's. */
export const MIN_RECORD_DAYS = 20;
/** How many past reads the card lists as evidence. */
export const RECENT_READS = 6;

/** One past read as the card showed it at the time, and what then happened. */
export interface RecentRead {
  date: string;
  call: Call;
  source: 'model' | 'rule';
  outcome: Call;
  hit: boolean;
}

export type Reading =
  | { kind: 'unknown-symbol' }
  | { kind: 'too-early'; firstDay: string }
  | {
      kind: 'ready';
      asOf: string;
      call: Call;
      /** Whose call this is: the model's, where its record beats the rule's, otherwise the rule's. */
      source: 'model' | 'rule';
      /** What each would have said on its own, so the card can show the one not chosen. */
      modelCall: Call;
      ruleCall: Call;
      probability: number;
      usualVolatility: number;
      recentVolatility: number;
      modelHits: number;
      modelDays: number;
      ruleHits: number;
      ruleDays: number;
      /** The latest reads whose window had closed by the simulated date, most recent first. */
      recent: RecentRead[];
    };

/** The trading date of a market timestamp, as the signal file writes dates. */
export function tradingDate(marketTimestamp: string): string {
  return marketTimestamp.slice(0, 10);
}

/**
 * The reading for a symbol at a simulated moment: the latest record made at a
 * close strictly before that moment's trading date, so a day's own close is
 * never used during that day.
 */
export function readingFor(
  signals: PlatformSignals,
  symbol: string,
  marketTimestamp: string,
): Reading {
  const entry = signals.symbols[symbol.toUpperCase()];
  if (!entry) {
    return { kind: 'unknown-symbol' };
  }
  const today = tradingDate(marketTimestamp);
  let latest: SignalDay | undefined;
  for (const day of entry.days) {
    if (day.date >= today) {
      break;
    }
    latest = day;
  }
  if (!latest) {
    return { kind: 'too-early', firstDay: entry.firstDay };
  }
  const shown = cardCall(latest);
  return {
    kind: 'ready',
    asOf: latest.date,
    call: shown.call,
    source: shown.source,
    modelCall: latest.call,
    ruleCall: shown.ruleCall,
    recent: recentReads(entry.days, entry.days.indexOf(latest), signals.horizonDays),
    probability: latest.probability,
    usualVolatility: latest.usualVolatility,
    recentVolatility: latest.recentVolatility,
    modelHits: latest.modelHits,
    modelDays: latest.modelDays,
    ruleHits: latest.ruleHits,
    ruleDays: latest.ruleDays,
  };
}

/** "7 of 10" style record, or null before any window has closed. */
export function recordLabel(hits: number, days: number): string | null {
  return days ? `${hits} of ${days}` : null;
}

/** The call the card shows for a day's record: the model's where its record has earned it, else the rule's. */
function cardCall(day: SignalDay): { call: Call; source: 'model' | 'rule'; ruleCall: Call } {
  const ruleCall: Call = day.recentVolatility > day.usualVolatility ? 'stormier' : 'calmer';
  const modelAhead =
    day.modelDays >= MIN_RECORD_DAYS && day.modelHits / day.modelDays > day.ruleHits / day.ruleDays;
  return {
    call: modelAhead ? day.call : ruleCall,
    source: modelAhead ? 'model' : 'rule',
    ruleCall,
  };
}

/**
 * The last reads whose window had closed by the day at `latestIndex`, most recent
 * first: a read made at index j is closed once j + horizon <= latestIndex, the same
 * rule the file's running counts use, so nothing after the simulated date shows.
 */
export function recentReads(days: SignalDay[], latestIndex: number, horizon: number): RecentRead[] {
  const reads: RecentRead[] = [];
  for (let j = latestIndex - horizon; j >= 0 && reads.length < RECENT_READS; j--) {
    const day = days[j];
    if (!day.outcome) {
      continue;
    }
    const shown = cardCall(day);
    reads.push({
      date: day.date,
      call: shown.call,
      source: shown.source,
      outcome: day.outcome,
      hit: shown.call === day.outcome,
    });
  }
  return reads;
}
