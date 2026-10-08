import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCircleAlert, lucideInbox, lucideRefreshCw } from '@ng-icons/lucide';
import { count, dateTime, dollars, percent, time, wholeDollars } from '../reporting/format';
import { TradesPerAccount, VolumeBySymbol } from '../reporting/report.models';
import { ReportStore } from '../reporting/report-store.service';
import { SortState, sortRows, toNumber, toggleSort } from '../reporting/report-summary';
import { PageHeaderComponent } from '../shared/page-header.component';
import { SortHeaderComponent } from '../shared/sort-header.component';
import { DailyTradesChartComponent } from './daily-trades-chart.component';

type SymbolSortKey = 'symbol' | 'fills' | 'shares' | 'notional';
type AccountSortKey = 'account' | 'trader' | 'total' | 'filled' | 'rejected';

interface Kpi {
  label: string;
  value: string;
  note: string;
}

// The latest report run at a glance: headline figures, trades per day, the split of
// filled and rejected orders, and the per-symbol and per-account tables.
@Component({
  selector: 'app-activity',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NgIcon, PageHeaderComponent, SortHeaderComponent, DailyTradesChartComponent],
  providers: [provideIcons({ lucideCircleAlert, lucideInbox, lucideRefreshCw })],
  templateUrl: './activity.component.html',
  styleUrl: './activity.component.css',
})
export class ActivityComponent {
  protected readonly store = inject(ReportStore);

  protected readonly symbolSort = signal<SortState<SymbolSortKey>>({
    key: 'notional',
    direction: 'desc',
  });
  protected readonly accountSort = signal<SortState<AccountSortKey>>({
    key: 'total',
    direction: 'desc',
  });

  protected readonly subtitle = computed(() => {
    const report = this.store.report();
    return report
      ? `From the trade-events topic · run generated ${dateTime(report.generatedAt)} · days in ${report.timezone}`
      : 'From the trade-events topic';
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
        note: `${count(report.eventCount)} events ingested`,
      },
      {
        label: 'Fill rate',
        value: percent(summary.fillRate),
        note: `${count(summary.filled)} filled`,
      },
      {
        label: 'Rejected',
        value: count(summary.rejected),
        note: summary.rejectedRate === null ? 'none resolved yet' : `${percent(summary.rejectedRate)} of resolved`,
      },
      {
        label: 'Notional traded',
        value: wholeDollars(summary.notional),
        note: `${count(summary.shares)} shares · ${count(summary.symbols)} ${summary.symbols === 1 ? 'symbol' : 'symbols'}`,
      },
      {
        label: 'Active accounts',
        value: count(summary.accounts),
        note: 'at least one resolved order',
      },
    ];
  });

  protected readonly statuses = computed(() => {
    const summary = this.store.summary();
    if (!summary) {
      return [];
    }
    const share = (value: number) => (summary.resolved ? (value / summary.resolved) * 100 : 0);
    return [
      { status: 'Filled', tone: 'gain', value: summary.filled, share: share(summary.filled) },
      { status: 'Rejected', tone: 'loss', value: summary.rejected, share: share(summary.rejected) },
    ];
  });

  protected readonly symbols = computed(() =>
    sortRows(this.store.report()?.volumeBySymbol ?? [], this.symbolSort(), symbolValue),
  );

  protected readonly accounts = computed(() =>
    sortRows(this.store.report()?.tradesPerAccount ?? [], this.accountSort(), accountValue),
  );

  // What the report job says about itself, for the pipeline card.
  protected readonly pipeline = computed(() => {
    const status = this.store.scheduler();
    const next = this.store.nextRunAt();
    return {
      health: this.store.overdue() ? 'overdue' : status?.latest_run ? 'on-schedule' : 'waiting',
      interval: status ? `${status.interval_minutes} min` : '—',
      nextRun: next ? time(next) : '—',
    };
  });

  protected readonly emptyMessage = computed(() => {
    const interval = this.store.scheduler()?.interval_minutes;
    return interval
      ? `The reporting consumer writes the first run ${interval} minutes after it starts.`
      : 'The reporting consumer writes the first run on its next scheduled pass.';
  });

  protected readonly count = count;
  protected readonly dollars = dollars;
  protected readonly percent = percent;
  protected readonly dateTime = dateTime;
  protected readonly toNumber = toNumber;

  protected sortSymbols(key: SymbolSortKey): void {
    this.symbolSort.update((sort) => toggleSort(sort, key));
  }

  protected sortAccounts(key: AccountSortKey): void {
    this.accountSort.update((sort) => toggleSort(sort, key));
  }

  protected accountName(row: TradesPerAccount): string {
    return row.accountName || `Account ${row.accountId}`;
  }
}

function symbolValue(row: VolumeBySymbol, key: SymbolSortKey): string | number {
  return key === 'symbol' ? row.symbol : key === 'fills' ? row.fills : toNumber(row[key]);
}

function accountValue(row: TradesPerAccount, key: AccountSortKey): string | number {
  switch (key) {
    case 'account':
      return row.accountName || `Account ${row.accountId}`;
    case 'trader':
      return row.userName ?? '';
    default:
      return row[key];
  }
}
