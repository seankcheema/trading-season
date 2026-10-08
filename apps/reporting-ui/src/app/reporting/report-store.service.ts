import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Subject, catchError, forkJoin, map, of, switchMap, tap, timer } from 'rxjs';
import { Report, RunSummary, SchedulerStatus, UserProfile } from './report.models';
import { summarize } from './report-summary';
import { ReportingApiService } from './reporting-api.service';

// loading: first load in flight. empty: the service has no run yet (404).
// error: the load failed and there is nothing older to show.
export type ReportState = 'loading' | 'ready' | 'empty' | 'error';

// How often the scheduler status is checked for a newer run.
export const STATUS_POLL_MS = 30_000;
// A run later than this past its expected time is shown as overdue.
const OVERDUE_GRACE_MS = 60_000;

type ReportOutcome =
  | { kind: 'report'; report: Report }
  | { kind: 'none' }
  | { kind: 'failed' };

// What the signed-in screens share: the latest report, the run list, the scheduler status
// and the caller's profile. Provided by the shell, so it lives exactly as long as a
// signed-in session is on screen and its polling stops on sign-out.
@Injectable()
export class ReportStore {
  private readonly _api = inject(ReportingApiService);
  private readonly _reload = new Subject<void>();

  readonly report = signal<Report | null>(null);
  readonly state = signal<ReportState>('loading');
  readonly runs = signal<RunSummary[]>([]);
  readonly latestRunId = signal<string | null>(null);
  readonly scheduler = signal<SchedulerStatus | null>(null);
  // Null for a sign-in that has no trading profile, such as the seeded admin.
  readonly profile = signal<UserProfile | null>(null);
  readonly refreshing = signal(false);
  // The last reload failed while an older report is still on screen.
  readonly refreshFailed = signal(false);

  readonly summary = computed(() => {
    const report = this.report();
    return report ? summarize(report) : null;
  });

  // When the report job should next write a run, from the last run and the interval.
  readonly nextRunAt = computed(() => {
    const status = this.scheduler();
    if (!status?.generated_at) {
      return null;
    }
    const generated = new Date(status.generated_at).getTime();
    return Number.isNaN(generated)
      ? null
      : new Date(generated + status.interval_minutes * 60_000);
  });

  // Measured against the service's own clock, so a skewed browser clock cannot raise it.
  readonly overdue = computed(() => {
    const status = this.scheduler();
    const next = this.nextRunAt();
    if (!status || !next) {
      return false;
    }
    return new Date(status.timestamp).getTime() > next.getTime() + OVERDUE_GRACE_MS;
  });

  constructor() {
    this._reload
      .pipe(
        tap(() => this.refreshing.set(true)),
        switchMap(() =>
          forkJoin({
            report: this._api.latestReport().pipe(
              map((report): ReportOutcome => ({ kind: 'report', report })),
              catchError((error: unknown) =>
                of<ReportOutcome>(
                  error instanceof HttpErrorResponse && error.status === 404
                    ? { kind: 'none' }
                    : { kind: 'failed' },
                ),
              ),
            ),
            runs: this._api.runs().pipe(catchError(() => of(null))),
            status: this._api.schedulerStatus().pipe(catchError(() => of(null))),
          }),
        ),
        takeUntilDestroyed(),
      )
      .subscribe(({ report, runs, status }) => {
        this.refreshing.set(false);
        this.applyReport(report);
        if (runs) {
          this.runs.set(runs.runs);
          this.latestRunId.set(runs.latest);
        }
        if (status) {
          this.scheduler.set(status);
        }
      });

    // The consumer writes a new run on its own schedule; pick it up without a reload.
    timer(STATUS_POLL_MS, STATUS_POLL_MS)
      .pipe(
        switchMap(() => this._api.schedulerStatus().pipe(catchError(() => EMPTY))),
        takeUntilDestroyed(),
      )
      .subscribe((status) => {
        this.scheduler.set(status);
        const shown = this.report()?.runId ?? null;
        if (status.latest_run !== shown || this.state() === 'error') {
          this._reload.next();
        }
      });

    this._api
      .profile()
      .pipe(
        catchError(() => of(null)),
        takeUntilDestroyed(),
      )
      .subscribe((profile) => this.profile.set(profile));

    this._reload.next();
  }

  refresh(): void {
    this._reload.next();
  }

  private applyReport(outcome: ReportOutcome): void {
    switch (outcome.kind) {
      case 'report':
        this.report.set(outcome.report);
        this.state.set('ready');
        this.refreshFailed.set(false);
        break;
      case 'none':
        this.report.set(null);
        this.state.set('empty');
        this.refreshFailed.set(false);
        break;
      case 'failed':
        // Keep an older report on screen rather than replacing it with an error.
        if (this.report()) {
          this.refreshFailed.set(true);
        } else {
          this.state.set('error');
        }
        break;
    }
  }
}
