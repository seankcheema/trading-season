import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideDownload, lucideInbox, lucideRefreshCw } from '@ng-icons/lucide';
import { catchError, distinctUntilChanged, forkJoin, map, of, startWith, switchMap, tap } from 'rxjs';
import { count, dateTime } from '../reporting/format';
import { RunSummary } from '../reporting/report.models';
import { ReportStore } from '../reporting/report-store.service';
import { ReportingApiService } from '../reporting/reporting-api.service';
import { PageHeaderComponent } from '../shared/page-header.component';

// A chart of the selected run. url is undefined while loading and null when it failed.
export interface ChartImage {
  name: string;
  title: string;
  url: string | null | undefined;
}

// What each chart the report job writes shows; an unknown file falls back to its name.
const CHART_TITLES: Record<string, string> = {
  'volume_by_symbol.png': 'Traded value by symbol',
  'daily_trades.png': 'Trades per day',
  'trades_per_account.png': 'Orders per account',
};

// The report runs on disk and the charts the report job rendered for the selected one.
@Component({
  selector: 'app-runs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon, PageHeaderComponent],
  providers: [provideIcons({ lucideDownload, lucideInbox, lucideRefreshCw })],
  templateUrl: './runs.component.html',
  styleUrl: './runs.component.css',
})
export class RunsComponent {
  private readonly _api = inject(ReportingApiService);
  protected readonly store = inject(ReportStore);

  // The run the user picked; null follows the latest run.
  private readonly _selectedRunId = signal<string | null>(null);

  protected readonly selectedRun = computed<RunSummary | null>(() => {
    const runs = this.store.runs();
    const wanted = this._selectedRunId() ?? this.store.latestRunId();
    return runs.find((run) => run.runId === wanted) ?? runs[0] ?? null;
  });

  protected readonly charts = signal<ChartImage[]>([]);

  protected readonly subtitle = computed(() => {
    const interval = this.store.scheduler()?.interval_minutes;
    return interval
      ? `Written by the reporting consumer every ${interval} minutes · each run replaces the one before`
      : 'Written by the reporting consumer · each run replaces the one before';
  });

  protected readonly count = count;
  protected readonly dateTime = dateTime;

  constructor() {
    toObservable(this.selectedRun)
      .pipe(
        distinctUntilChanged((a, b) => a?.runId === b?.runId),
        tap(() => this.releaseCharts()),
        switchMap((run) => {
          if (!run?.files.length) {
            return of<ChartImage[]>([]);
          }
          const pending = run.files.map((name) => this.chart(name, undefined));
          return forkJoin(
            run.files.map((name) =>
              this._api.runFile(run.runId, name).pipe(
                map((blob) => this.chart(name, URL.createObjectURL(blob))),
                catchError(() => of(this.chart(name, null))),
              ),
            ),
          ).pipe(startWith(pending));
        }),
        takeUntilDestroyed(),
      )
      .subscribe((charts) => this.charts.set(charts));

    inject(DestroyRef).onDestroy(() => this.releaseCharts());
  }

  protected select(run: RunSummary): void {
    this._selectedRunId.set(run.runId);
  }

  private chart(name: string, url: string | null | undefined): ChartImage {
    return { name, title: CHART_TITLES[name] ?? name, url };
  }

  // Object URLs keep their blobs alive until they are revoked.
  private releaseCharts(): void {
    for (const chart of this.charts()) {
      if (chart.url) {
        URL.revokeObjectURL(chart.url);
      }
    }
    this.charts.set([]);
  }
}
