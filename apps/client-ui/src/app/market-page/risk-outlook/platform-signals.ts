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

export type Reading =
  | { kind: 'unknown-symbol' }
  | { kind: 'too-early'; firstDay: string }
  | {
      kind: 'ready';
      asOf: string;
      call: Call;
      /** Whose call this is: the model's, where its record beats the rule's, otherwise the rule's. */
      source: 'model' | 'rule';
      probability: number;
      usualVolatility: number;
      recentVolatility: number;
      modelHits: number;
      modelDays: number;
      ruleHits: number;
      ruleDays: number;
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
  const ruleCall: Call = latest.recentVolatility > latest.usualVolatility ? 'stormier' : 'calmer';
  const modelAhead =
    latest.modelDays >= MIN_RECORD_DAYS &&
    latest.modelHits / latest.modelDays > latest.ruleHits / latest.ruleDays;
  return {
    kind: 'ready',
    asOf: latest.date,
    call: modelAhead ? latest.call : ruleCall,
    source: modelAhead ? 'model' : 'rule',
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
