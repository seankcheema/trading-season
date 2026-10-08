import { computed, signal } from '@angular/core';
import { vi } from 'vitest';
import {
  Report,
  RunSummary,
  SchedulerStatus,
  UserProfile,
} from '../app/reporting/report.models';
import { ReportState, ReportStore } from '../app/reporting/report-store.service';
import { summarize } from '../app/reporting/report-summary';

// Test data shaped like the Reporting Service responses. Not part of the application build.

export function report(overrides: Partial<Report> = {}): Report {
  return {
    runId: '20261008T194500Z',
    generatedAt: '2026-10-08T19:45:00.123456+00:00',
    timezone: 'UTC',
    eventCount: 14,
    statusCounts: { FILLED: 6, REJECTED: 2 },
    volumeBySymbol: [
      { symbol: 'NVDA', fills: 4, shares: '25', notional: '4619.25' },
      { symbol: 'AAPL', fills: 2, shares: '4.5', notional: '1424.66' },
    ],
    tradesPerAccount: [
      {
        accountId: 7,
        total: 5,
        filled: 4,
        rejected: 1,
        accountName: 'Growth',
        userName: 'Sean Cheema',
        label: 'Growth (Sean Cheema)',
      },
      {
        accountId: 12,
        total: 3,
        filled: 2,
        rejected: 1,
        accountName: null,
        userName: null,
        label: '12',
      },
    ],
    dailyCounts: [
      { date: '2026-10-07', filled: 2, rejected: 1 },
      { date: '2026-10-08', filled: 4, rejected: 1 },
    ],
    files: ['volume_by_symbol.png', 'daily_trades.png', 'trades_per_account.png'],
    ...overrides,
  };
}

export function run(overrides: Partial<RunSummary> = {}): RunSummary {
  return {
    runId: '20261008T194500Z',
    generatedAt: '2026-10-08T19:45:00+00:00',
    eventCount: 14,
    files: ['volume_by_symbol.png', 'daily_trades.png', 'trades_per_account.png'],
    ...overrides,
  };
}

export function schedulerStatus(overrides: Partial<SchedulerStatus> = {}): SchedulerStatus {
  return {
    latest_run: '20261008T194500Z',
    generated_at: '2026-10-08T19:45:00+00:00',
    interval_minutes: 15,
    timestamp: '2026-10-08T19:50:00+00:00',
    ...overrides,
  };
}

export function profile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    user_id: '6f1c0a52-9d1e-4b62-8a51-0d6f6f3f6f10',
    first_name: 'Sean',
    last_name: 'Cheema',
    trader_level: 'ADVANCED',
    available_funds: 4820.55,
    timestamp: '2026-10-08T19:50:00+00:00',
    ...overrides,
  };
}

// An unsigned token with the given claims, in the shape the auth service issues.
export function accessToken(claims: Record<string, unknown> = {}): string {
  const encode = (value: unknown) =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${encode({ alg: 'RS256' })}.${encode({ sub: 'user-1', ...claims })}.signature`;
}

// A stand-in for ReportStore whose signals a component test sets directly.
export function fakeReportStore(state: ReportState = 'ready') {
  const reportSignal = signal<Report | null>(state === 'ready' ? report() : null);
  const store = {
    report: reportSignal,
    state: signal<ReportState>(state),
    runs: signal<RunSummary[]>(state === 'ready' ? [run()] : []),
    latestRunId: signal<string | null>(state === 'ready' ? run().runId : null),
    scheduler: signal<SchedulerStatus | null>(schedulerStatus()),
    profile: signal<UserProfile | null>(null),
    refreshing: signal(false),
    refreshFailed: signal(false),
    summary: computed(() => {
      const current = reportSignal();
      return current ? summarize(current) : null;
    }),
    nextRunAt: signal<Date | null>(new Date('2026-10-08T20:00:00Z')),
    overdue: signal(false),
    refresh: vi.fn(),
  };
  return store as typeof store & ReportStore;
}
