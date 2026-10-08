// Response shapes of the Reporting Service. The canonical contract is
// apps/reporting-service/openapi.yaml; keep these in step with it.

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
  // UTC day, YYYY-MM-DD.
  date: string;
  filled: number;
  rejected: number;
}

// The report.json of one run.
export interface Report {
  runId: string;
  generatedAt: string;
  timezone: string;
  // Trade-event lines read for the run, every status included.
  eventCount: number;
  statusCounts: StatusCounts;
  volumeBySymbol: VolumeBySymbol[];
  tradesPerAccount: TradesPerAccount[];
  dailyCounts: DailyCount[];
  files: string[];
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
