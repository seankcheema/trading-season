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
/**
 * Closed reads the record compares: the most recent ones, not every read since the
 * file began, so the source that has read this stock's recent regime better leads.
 */
export const RECORD_WINDOW = 20;

/** The model's and the rule's hits over the last RECORD_WINDOW closed reads. */
export interface TrackRecord {
  modelHits: number;
  modelDays: number;
  ruleHits: number;
  ruleDays: number;
}
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
      /** Each source's hits over the last RECORD_WINDOW reads closed by the simulated date. */
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
  let latestIndex = -1;
  for (const [index, day] of entry.days.entries()) {
    if (day.date >= today) {
      break;
    }
    latestIndex = index;
  }
  if (latestIndex < 0) {
    return { kind: 'too-early', firstDay: entry.firstDay };
  }
  const latest = entry.days[latestIndex];
  const record = recordAt(entry.days, latestIndex, signals.horizonDays);
  const shown = cardCall(entry.days, latestIndex, signals.horizonDays);
  return {
    kind: 'ready',
    asOf: latest.date,
    call: shown.call,
    source: shown.source,
    modelCall: latest.call,
    ruleCall: shown.ruleCall,
    recent: recentReads(entry.days, latestIndex, signals.horizonDays),
    probability: latest.probability,
    usualVolatility: latest.usualVolatility,
    recentVolatility: latest.recentVolatility,
    ...record,
  };
}

/** "7 of 10" style record, or null before any window has closed. */
export function recordLabel(hits: number, days: number): string | null {
  return days ? `${hits} of ${days}` : null;
}

/** The rule's call on a day: the next days like the last ones. */
function ruleCallFor(day: SignalDay): Call {
  return day.recentVolatility > day.usualVolatility ? 'stormier' : 'calmer';
}

/**
 * Each source's record over the last RECORD_WINDOW reads whose window had closed by
 * the day at `index`: a read made at j is closed once j + horizon <= index, the same
 * rule the file's running counts use, so nothing after that day is counted. The
 * file's own counts run from its first day; this window follows the recent regime.
 */
export function recordAt(days: SignalDay[], index: number, horizon: number): TrackRecord {
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

/** The call the card shows for a day: the model's where its recent record has earned it, else the rule's. */
function cardCall(
  days: SignalDay[],
  index: number,
  horizon: number,
): { call: Call; source: 'model' | 'rule'; ruleCall: Call } {
  const day = days[index];
  const ruleCall = ruleCallFor(day);
  const record = recordAt(days, index, horizon);
  const modelAhead =
    record.modelDays >= MIN_RECORD_DAYS &&
    record.modelHits / record.modelDays > record.ruleHits / record.ruleDays;
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
    const shown = cardCall(days, j, horizon);
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
