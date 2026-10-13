import { NgTemplateOutlet } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCircleAlert, lucideDownload, lucideInbox, lucideRefreshCw } from '@ng-icons/lucide';
import { Observable, catchError, map, switchMap, throwError } from 'rxjs';
import {
  count,
  dateTime,
  dollars,
  percent,
  plural,
  time,
  utcDay,
  wholeDollars,
} from '../reporting/format';
import { ActivityRange } from '../reporting/console.models';
import { RANGES } from '../reporting/range';
import { toNumber } from '../reporting/report-summary';
import { ReportStore } from '../reporting/report-store.service';
import { ReportingApiService } from '../reporting/reporting-api.service';
import { ChangePillComponent } from '../shared/change-pill.component';
import { ExportMenuComponent, saveFile } from '../shared/export-menu.component';
import { roundStep } from '../shared/line-chart.component';
import { PageHeaderComponent } from '../shared/page-header.component';
import { TimeframeToggleComponent } from '../shared/timeframe-toggle.component';

// What each chart the report job writes shows; an unknown file falls back to its name.
const CHART_TITLES: Record<string, string> = {
  'volume_by_symbol.png': 'Traded value by symbol',
  'daily_trades.png': 'Trades per day',
  'volume_by_segment.png': 'Traded value by client segment',
  'trades_per_account.png': 'Orders per account',
};

// How many steps the daily chart's count axis aims for.
const AXIS_STEPS = 4;
// The daily chart is at least this many columns wide, so a run of one or two
// days draws them as columns and not as blocks that fill the plot.
const MIN_DAY_SLOTS = 8;
const DAY_LABELS = 5;

const FILLED = 'bg-gain';
const REJECTED = 'bg-loss';
const SINGLE = 'bg-primary';

interface Kpi {
  label: string;
  value: string;
  note: string;
}

// One row of a breakdown: a name, its figure, and a bar of one or two parts.
interface MeterRow {
  key: string | number;
  label: string;
  value: string;
  // A quiet figure beside the value, such as a share.
  aside: string;
  detail: string;
  // Widths in percent of the track.
  bars: { tone: string; width: number }[];
}

function outcome(filled: number, rejected: number): string {
  return `${count(filled)} filled · ${count(rejected)} rejected`;
}

// A chart file and the run it was read from.
interface SavedChart {
  runId: string;
  file: Blob;
}

// The latest report run as a dashboard over a chosen range: headline figures,
// trades per day, and traded value by client segment, symbol and account. The
// ranges are Activity's. All time is the run's report.json; a narrower range is
// the service's cut of the same run. The charts are offered as PNG downloads for
// the range on screen, and whole for any earlier run still on disk.
@Component({
  selector: 'app-runs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgIcon,
    NgTemplateOutlet,
    PageHeaderComponent,
    TimeframeToggleComponent,
    ChangePillComponent,
    ExportMenuComponent,
  ],
  providers: [provideIcons({ lucideCircleAlert, lucideDownload, lucideInbox, lucideRefreshCw })],
  // From 1280px wide the screen fills the window and its lists scroll inside their
  // cards; a window shorter than the minimum scrolls the page instead. Narrower,
  // the cards stack and the page scrolls.
  host: { class: 'flex flex-col xl:min-h-[37.5rem] xl:flex-1 xl:basis-0' },
  templateUrl: './runs.component.html',
})
export class RunsComponent {
  private readonly _api = inject(ReportingApiService);
  private readonly _destroyRef = inject(DestroyRef);
  protected readonly store = inject(ReportStore);

  // The day of the daily chart under the pointer.
  protected readonly activeDay = signal<number | null>(null);
  // Whether the last chart download failed.
  protected readonly downloadFailed = signal(false);

  protected readonly subtitle = computed(() => {
    const interval = this.store.scheduler()?.interval_minutes;
    const minutes = interval === 1 ? 'minute' : `${interval} minutes`;
    const every = interval ? ` every ${minutes}` : '';
    const report = this.store.report();
    if (!report) {
      return `Written by the reporting consumer${every} · each run replaces the one before`;
    }
    const replaced = every ? ` · replaced${every}` : '';
    return `Run ${report.runId} · generated ${dateTime(report.generatedAt)}${replaced}`;
  });

  protected readonly ranges = RANGES;

  // When a run that is late was expected. A late run usually means the consumer is not running.
  protected readonly overdue = computed(() => {
    const next = this.store.nextRunAt();
    return next && this.store.overdue() ? time(next) : null;
  });

  // The range of the report on screen, which trails the one chosen while it loads.
  private readonly _shownRange = computed<ActivityRange>(() => this.store.report()?.range ?? 'all');

  // What a card says when it has nothing to show: nothing at all yet, or nothing in the range.
  protected readonly nothing = computed(() => {
    const ranged = this._shownRange() !== 'all';
    return {
      resolved: ranged ? 'No order resolved in this period.' : 'No order has resolved yet.',
      filled: ranged ? 'No order filled in this period.' : 'No order has filled yet.',
      rejected: ranged ? 'nothing resolved in this period' : 'nothing resolved yet',
    };
  });

  protected readonly kpis = computed<Kpi[]>(() => {
    const report = this.store.report();
    const summary = this.store.summary();
    if (!report || !summary) {
      return [];
    }
    return [
      {
        label: 'Orders resolved',
        value: count(summary.resolved),
        note: `${plural(report.eventCount, 'event')} read`,
      },
      { label: 'Fill rate', value: percent(summary.fillRate), note: `${count(summary.filled)} filled` },
      {
        label: 'Rejected',
        value: count(summary.rejected),
        note:
          summary.rejectedRate === null
            ? this.nothing().rejected
            : `${percent(summary.rejectedRate)} of resolved`,
      },
      {
        label: 'Traded value',
        value: wholeDollars(summary.notional),
        note: `${plural(summary.shares, 'share')} filled`,
      },
      {
        label: 'Active accounts',
        value: count(summary.accounts),
        note: `${plural(summary.symbols, 'symbol')} traded`,
      },
    ];
  });

  // Filled and rejected orders per day of the report's timezone as stacked columns,
  // with a count axis in whole steps. Null when no order has resolved.
  protected readonly daily = computed(() => {
    const counts = this.store.report()?.dailyCounts ?? [];
    if (!counts.length) {
      return null;
    }
    const highest = Math.max(1, ...counts.map((day) => day.filled + day.rejected));
    const step = Math.max(1, roundStep(highest / AXIS_STEPS));
    const top = Math.ceil(highest / step) * step;
    const slots = Math.max(counts.length, MIN_DAY_SLOTS);
    const days = counts.map((day) => ({
      ...day,
      label: utcDay(day.date),
      detail: outcome(day.filled, day.rejected),
      filledHeight: (day.filled / top) * 100,
      rejectedHeight: (day.rejected / top) * 100,
    }));
    // A handful of the days, evenly spread and always ending on the newest.
    const labelled = Math.min(DAY_LABELS, days.length);
    const labels = Array.from({ length: labelled }, (_, index) => {
      const at = labelled === 1 ? 0 : Math.round((index / (labelled - 1)) * (days.length - 1));
      return { at: ((at + 0.5) / slots) * 100, text: days[at].label };
    });
    const ticks = Array.from({ length: top / step + 1 }, (_, index) => ({
      value: index * step,
      at: ((index * step) / top) * 100,
    }));
    return { days, labels, ticks, slot: 100 / slots };
  });

  // The day the readout above the chart describes: the one under the pointer, otherwise the newest.
  protected readonly shownDay = computed(() => {
    const days = this.daily()?.days ?? [];
    return days[this.activeDay() ?? -1] ?? days.at(-1) ?? null;
  });

  // A segment's share is of the notional traded.
  protected readonly segments = computed<MeterRow[]>(() => {
    const rows = this.store.report()?.activityBySegment ?? [];
    const total = rows.reduce((sum, row) => sum + toNumber(row.notional), 0);
    return rows.map((row) => {
      const notional = toNumber(row.notional);
      const share = total ? (notional / total) * 100 : 0;
      return {
        key: row.segment,
        label: row.segment[0] + row.segment.slice(1).toLowerCase(),
        value: dollars(notional),
        aside: percent(share),
        detail: `${plural(row.accounts, 'account')} · ${outcome(row.filled, row.rejected)}`,
        bars: [{ tone: SINGLE, width: share }],
      };
    });
  });

  // Bars are measured against the most traded symbol, which the service lists first.
  protected readonly symbols = computed<MeterRow[]>(() => {
    const rows = this.store.report()?.volumeBySymbol ?? [];
    const most = Math.max(...rows.map((row) => toNumber(row.notional))) || 1;
    return rows.map((row) => ({
      key: row.symbol,
      label: row.symbol,
      value: dollars(toNumber(row.notional)),
      aside: '',
      detail: `${plural(row.fills, 'fill')} · ${plural(toNumber(row.shares), 'share')}`,
      bars: [{ tone: SINGLE, width: (toNumber(row.notional) / most) * 100 }],
    }));
  });

  // Bars are measured against the busiest account; filled and rejected share one bar.
  protected readonly accounts = computed<MeterRow[]>(() => {
    const rows = this.store.report()?.tradesPerAccount ?? [];
    const most = Math.max(1, ...rows.map((row) => row.total));
    return rows.map((row) => ({
      key: row.accountId,
      label: row.label,
      value: plural(row.total, 'order'),
      aside: '',
      detail: outcome(row.filled, row.rejected),
      bars: [
        { tone: FILLED, width: (row.filled / most) * 100 },
        { tone: REJECTED, width: (row.rejected / most) * 100 },
      ],
    }));
  });

  // Runs still on disk besides the one shown. The service normally keeps only the newest.
  protected readonly earlierRuns = computed(() => {
    const shown = this.store.report()?.runId;
    return this.store.runs().filter((run) => run.runId !== shown);
  });

  protected readonly dateTime = dateTime;
  protected readonly plural = plural;

  protected chartTitle(name: string): string {
    return CHART_TITLES[name] ?? name;
  }

  // Whether the run on screen has the chart file.
  protected hasFile(name: string): boolean {
    return this.store.report()?.files.includes(name) ?? false;
  }

  // Saves a chart PNG. Fetched as a blob because a link cannot carry the bearer token.
  // The service keeps only its newest run, so the run on screen can be gone before the
  // next status poll brings the one that replaced it. Its chart then comes from that
  // newest run, which covers the same events and more. The run on screen is drawn
  // over the range it is shown in, and the file says which; an earlier run is whole.
  protected download(name: string, runId = this.store.report()!.runId): void {
    this.downloadFailed.set(false);
    const onScreen = runId === this.store.report()?.runId;
    const range = onScreen ? this._shownRange() : 'all';
    const period = range === 'all' ? '' : `${range}-`;
    this._api
      .runFile(runId, name, range)
      .pipe(
        map((file): SavedChart => ({ runId, file })),
        catchError((error: unknown) =>
          onScreen && error instanceof HttpErrorResponse && error.status === 404
            ? this.fromNewestRun(name, runId, range)
            : throwError(() => error),
        ),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe({
        next: (chart) => saveFile(`${chart.runId}-${period}${name}`, chart.file),
        error: () => this.downloadFailed.set(true),
      });
  }

  // The same chart from the run that replaced the one on screen, and the screen with it.
  private fromNewestRun(name: string, missing: string, range: ActivityRange): Observable<SavedChart> {
    return this._api.runs().pipe(
      switchMap(({ latest }) => {
        if (!latest || latest === missing) {
          return throwError(() => new Error(`Run ${missing} has no ${name}`));
        }
        this.store.refresh();
        return this._api
          .runFile(latest, name, range)
          .pipe(map((file): SavedChart => ({ runId: latest, file })));
      }),
    );
  }

  // Keeps a label that is centered on a column from running off either edge.
  protected anchor(x: number): string {
    if (x < 5) {
      return 'translateX(0)';
    }
    return x > 95 ? 'translateX(-100%)' : 'translateX(-50%)';
  }
}
