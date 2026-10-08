import { Report } from './report.models';

// Headline figures derived from one report. Only FILLED and REJECTED count as
// resolved orders; ACCEPTED events are in eventCount but not in statusCounts.
export interface ReportSummary {
  resolved: number;
  filled: number;
  rejected: number;
  // Filled as a share of resolved, 0 to 100; null when nothing has resolved.
  fillRate: number | null;
  rejectedRate: number | null;
  notional: number;
  shares: number;
  symbols: number;
  accounts: number;
}

export function summarize(report: Report): ReportSummary {
  const filled = report.statusCounts.FILLED;
  const rejected = report.statusCounts.REJECTED;
  const resolved = filled + rejected;
  return {
    resolved,
    filled,
    rejected,
    fillRate: resolved ? (filled / resolved) * 100 : null,
    rejectedRate: resolved ? (rejected / resolved) * 100 : null,
    notional: report.volumeBySymbol.reduce((sum, row) => sum + toNumber(row.notional), 0),
    shares: report.volumeBySymbol.reduce((sum, row) => sum + toNumber(row.shares), 0),
    symbols: report.volumeBySymbol.length,
    accounts: report.tradesPerAccount.length,
  };
}

// The service sends decimals as strings; anything unparseable counts as zero.
export function toNumber(value: string | number | null | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export type SortDirection = 'asc' | 'desc';

export interface SortState<K extends string> {
  key: K;
  direction: SortDirection;
}

// First click on a column sorts descending, the next flips it.
export function toggleSort<K extends string>(current: SortState<K>, key: K): SortState<K> {
  return {
    key,
    direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc',
  };
}

export function sortRows<T, K extends string>(
  rows: readonly T[],
  sort: SortState<K>,
  value: (row: T, key: K) => string | number,
): T[] {
  const sorted = [...rows].sort((a, b) => {
    const x = value(a, sort.key);
    const y = value(b, sort.key);
    return typeof x === 'string' || typeof y === 'string'
      ? String(x).localeCompare(String(y))
      : x - y;
  });
  return sort.direction === 'desc' ? sorted.reverse() : sorted;
}
