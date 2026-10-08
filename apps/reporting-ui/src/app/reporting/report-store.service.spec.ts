import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { profile, report, run, schedulerStatus } from '../../testing/fixtures';
import { Report } from './report.models';
import { ReportStore, STATUS_POLL_MS } from './report-store.service';
import { ReportingApiService } from './reporting-api.service';

const httpError = (status: number) => throwError(() => new HttpErrorResponse({ status }));

describe('ReportStore', () => {
  let api: {
    profile: ReturnType<typeof vi.fn>;
    runs: ReturnType<typeof vi.fn>;
    latestReport: ReturnType<typeof vi.fn>;
    schedulerStatus: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    api = {
      profile: vi.fn(() => of(profile())),
      runs: vi.fn(() => of({ latest: run().runId, runs: [run()], timestamp: '' })),
      latestReport: vi.fn(() => of(report())),
      schedulerStatus: vi.fn(() => of(schedulerStatus())),
    };
    TestBed.configureTestingModule({
      providers: [ReportStore, { provide: ReportingApiService, useValue: api }],
    });
  });

  afterEach(() => vi.useRealTimers());

  const create = () => TestBed.inject(ReportStore);

  it('loads the latest report, the runs, the scheduler status and the profile', () => {
    const store = create();

    expect(store.state()).toBe('ready');
    expect(store.report()?.runId).toBe('20261008T194500Z');
    expect(store.summary()?.resolved).toBe(8);
    expect(store.runs()).toHaveLength(1);
    expect(store.latestRunId()).toBe('20261008T194500Z');
    expect(store.scheduler()?.interval_minutes).toBe(15);
    expect(store.profile()?.first_name).toBe('Sean');
    expect(store.refreshing()).toBe(false);
    expect(store.refreshFailed()).toBe(false);
  });

  it('is empty until the consumer has written a first run', () => {
    api.latestReport.mockReturnValue(httpError(404));
    api.runs.mockReturnValue(of({ latest: null, runs: [], timestamp: '' }));
    api.schedulerStatus.mockReturnValue(
      of(schedulerStatus({ latest_run: null, generated_at: null })),
    );
    const store = create();

    expect(store.state()).toBe('empty');
    expect(store.report()).toBeNull();
    expect(store.summary()).toBeNull();
    expect(store.nextRunAt()).toBeNull();
    expect(store.overdue()).toBe(false);
  });

  it('reports an error when the first load fails, and tolerates the side calls failing', () => {
    api.latestReport.mockReturnValue(httpError(503));
    api.runs.mockReturnValue(httpError(503));
    api.schedulerStatus.mockReturnValue(httpError(503));
    api.profile.mockReturnValue(httpError(404));
    const store = create();

    expect(store.state()).toBe('error');
    expect(store.runs()).toEqual([]);
    expect(store.scheduler()).toBeNull();
    expect(store.profile()).toBeNull();
    expect(store.overdue()).toBe(false);
  });

  it('keeps the report on screen when a later refresh fails', () => {
    const store = create();
    api.latestReport.mockReturnValue(httpError(500));

    store.refresh();

    expect(store.state()).toBe('ready');
    expect(store.report()?.runId).toBe('20261008T194500Z');
    expect(store.refreshFailed()).toBe(true);

    api.latestReport.mockReturnValue(of(report()));
    store.refresh();
    expect(store.refreshFailed()).toBe(false);
  });

  it('marks a refresh as in flight until it settles', () => {
    const store = create();
    const pending = new Subject<Report>();
    api.latestReport.mockReturnValue(pending);

    store.refresh();
    expect(store.refreshing()).toBe(true);

    pending.next(report({ runId: '20261008T200000Z' }));
    pending.complete();
    expect(store.refreshing()).toBe(false);
    expect(store.report()?.runId).toBe('20261008T200000Z');
  });

  it('picks up a new run when the scheduler reports one', () => {
    const store = create();
    expect(api.latestReport).toHaveBeenCalledTimes(1);

    // Same run: nothing to reload.
    vi.advanceTimersByTime(STATUS_POLL_MS);
    expect(api.latestReport).toHaveBeenCalledTimes(1);

    api.schedulerStatus.mockReturnValue(of(schedulerStatus({ latest_run: '20261008T200000Z' })));
    api.latestReport.mockReturnValue(of(report({ runId: '20261008T200000Z' })));
    vi.advanceTimersByTime(STATUS_POLL_MS);

    expect(store.report()?.runId).toBe('20261008T200000Z');
  });

  it('retries a failed load on the next poll and ignores a failed poll', () => {
    api.latestReport.mockReturnValue(httpError(503));
    const store = create();
    expect(store.state()).toBe('error');

    api.schedulerStatus.mockReturnValue(httpError(503));
    vi.advanceTimersByTime(STATUS_POLL_MS);
    expect(store.state()).toBe('error');

    api.schedulerStatus.mockReturnValue(of(schedulerStatus()));
    api.latestReport.mockReturnValue(of(report()));
    vi.advanceTimersByTime(STATUS_POLL_MS);
    expect(store.state()).toBe('ready');
  });

  it('works out when the next run is due and whether it is late', () => {
    const store = create();
    expect(store.nextRunAt()?.toISOString()).toBe('2026-10-08T20:00:00.000Z');
    expect(store.overdue()).toBe(false);

    api.schedulerStatus.mockReturnValue(
      of(schedulerStatus({ timestamp: '2026-10-08T20:05:00+00:00' })),
    );
    vi.advanceTimersByTime(STATUS_POLL_MS);
    expect(store.overdue()).toBe(true);

    api.schedulerStatus.mockReturnValue(of(schedulerStatus({ generated_at: 'garbled' })));
    vi.advanceTimersByTime(STATUS_POLL_MS);
    expect(store.nextRunAt()).toBeNull();
    expect(store.overdue()).toBe(false);
  });

  it('stops polling when its owner is destroyed', () => {
    create();
    const calls = api.schedulerStatus.mock.calls.length;

    TestBed.resetTestingModule();
    vi.advanceTimersByTime(STATUS_POLL_MS * 3);

    expect(api.schedulerStatus).toHaveBeenCalledTimes(calls);
  });
});
