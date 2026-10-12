// Response shapes of the Reporting Service. The canonical contract is
// apps/reporting-service/openapi.yaml; keep these in step with it.

import { ActivityRange } from './console.models';

export interface StatusCounts {
  FILLED: number;
  REJECTED: number;
}

export interface VolumeBySymbol {
  symbol: string;
  fills: number;
  // Decimals arrive as strings.
  shares: string;
  notional: string;
}

export interface TradesPerAccount {
  accountId: number;
  total: number;
  filled: number;
  rejected: number;
  accountName?: string | null;
  userName?: string | null;
  // Account name and trader name, or the account id when the account is unknown.
  label: string;
}

export interface DailyCount {
  // A day of the report's timezone, YYYY-MM-DD.
  date: string;
  filled: number;
  rejected: number;
}

// The resolved orders of one client segment, which is a trader level. UNKNOWN
// collects accounts no published record names.
export interface SegmentReport {
  segment: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'UNKNOWN';
  // Accounts that resolved at least one order.
  accounts: number;
  total: number;
  filled: number;
  rejected: number;
  notional: string;
}

// The report.json of one run, or the same figures over a part of the run.
export interface Report {
  runId: string;
  generatedAt: string;
  // Whose days dailyCounts is cut in: UTC for a run as written, the viewer's
  // offset, such as UTC-05:00, for a range of it.
  timezone: string;
  // Trade-event lines read, every status included.
  eventCount: number;
  statusCounts: StatusCounts;
  volumeBySymbol: VolumeBySymbol[];
  tradesPerAccount: TradesPerAccount[];
  dailyCounts: DailyCount[];
  activityBySegment: SegmentReport[];
  files: string[];
  // Present when a range narrower than all time was asked for: the range, where
  // it starts, and the generation time of the run, where it ends.
  range?: ActivityRange;
  from?: string;
  to?: string;
}

export interface RunSummary {
  runId: string;
  generatedAt: string;
  eventCount: number;
  files: string[];
}

export interface RunList {
  latest: string | null;
  runs: RunSummary[];
  timestamp: string;
}

export interface SchedulerStatus {
  latest_run: string | null;
  generated_at: string | null;
  interval_minutes: number;
  timestamp: string;
}

export interface UserProfile {
  user_id: string;
  first_name: string;
  last_name: string;
  trader_level: string;
  available_funds: number;
  timestamp: string;
}
