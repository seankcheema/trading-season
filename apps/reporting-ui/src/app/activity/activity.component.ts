import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowRightLeft,
  lucideCircleAlert,
  lucideCircleX,
  lucideLock,
  lucideWallet,
} from '@ng-icons/lucide';
import { ActivityRange, FeedItem } from '../reporting/console.models';
import {
  clock,
  count,
  day,
  dollars,
  hour,
  percent,
  recent,
  signedDollars,
  signedWholeDollars,
  wholeDollars,
} from '../reporting/format';
import { ReportingApiService } from '../reporting/reporting-api.service';
import { plainReason } from '../orders/order-detail.component';
import { ChangePillComponent, PillTone, statusTone } from '../shared/change-pill.component';
import { ExportMenuComponent, downloadCsv } from '../shared/export-menu.component';
import { ChartPoint, LineChartComponent } from '../shared/line-chart.component';
import { live } from '../shared/live';
import { PageHeaderComponent } from '../shared/page-header.component';
import { SparklineComponent } from '../shared/sparkline.component';
import { TimeframeToggleComponent, ToggleOption } from '../shared/timeframe-toggle.component';

// How often the screen reads the ledgers again.
export const ACTIVITY_REFRESH_MS = 15_000;

const RANGES: ToggleOption<ActivityRange>[] = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: '90d', label: '90D' },
];

interface Kpi {
  label: string;
  value: string;
  // Change against the prior period; null hides the pill.
  change: number | null;
  note: string;
}

interface FeedRow {
  icon: string;
  color: string;
  text: string;
  when: string;
  value: string;
}

// The bar under a status takes the color of its pill.
const BAR_COLORS: Record<PillTone, string> = {
  gain: 'bg-gain',
  loss: 'bg-loss',
  primary: 'bg-primary',
  muted: 'bg-muted-foreground',
};

function feedRow(item: FeedItem): FeedRow {
  const when = recent(item.at);
  switch (item.kind) {
    case 'fill':
      return {
        icon: 'lucideArrowRightLeft',
        color: 'text-primary',
        text: `${item.userName} ${item.side === 'BUY' ? 'bought' : 'sold'} ${count(item.quantity)} ${item.symbol}`,
        when,
        value: dollars(item.amount),
      };
    case 'reject':
      return {
        icon: 'lucideCircleX',
        color: 'text-loss',
        text: `Order #${item.orderId} rejected${item.reason ? ` — ${plainReason(item.reason)}` : ''}`,
        when,
        value: item.symbol,
      };
    case 'cash':
      return {
        icon: 'lucideWallet',
        color: 'text-gain',
        text: `${item.userName} ${item.reason === 'DEPOSIT' ? 'deposited' : 'withdrew'} cash`,
        when,
        value: signedDollars(item.amount),
      };
    case 'lock':
      return {
        icon: 'lucideLock',
        color: 'text-loss',
        text: `${item.userName} locked after ${item.failedAttempts} failed sign-ins`,
        when,
        value: 'Security',
      };
  }
}

// What is happening on the platform over a chosen range: headline figures against
// the period before, notional traded, the status split, the newest events, and
// the most traded symbols.
@Component({
  selector: 'app-activity',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    NgIcon,
    PageHeaderComponent,
    TimeframeToggleComponent,
    ExportMenuComponent,
    ChangePillComponent,
    LineChartComponent,
    SparklineComponent,
  ],
  providers: [
    provideIcons({
      lucideArrowRightLeft,
      lucideCircleAlert,
      lucideCircleX,
      lucideLock,
      lucideWallet,
    }),
  ],
  // From 1024px wide the screen fills the window and its lists scroll inside their
  // cards; a window shorter than the minimum scrolls the page instead.
  host: { class: 'flex flex-col gap-3 lg:min-h-[50rem] lg:flex-1 lg:basis-0' },
  styles: `
    .traded-grid {
      display: grid;
      grid-template-columns: 1fr 1.2fr 0.8fr 1fr;
      align-items: center;
      gap: 0.5rem;
    }
  `,
  template: `
    <app-page-header title="Activity" [subtitle]="subtitle()">
      <app-timeframe-toggle
        label="Activity range"
        data-print-hide="true"
        [options]="ranges"
        [value]="range()"
        (valueChange)="choose($event)"
      />
      <app-export-menu (exportCsv)="exportCsv()" />
    </app-page-header>

    @switch (activity.state()) {
      @case ('loading') {
        <section class="dash-card p-5" aria-busy="true">
          <p class="text-muted-foreground text-sm">Loading activity…</p>
        </section>
      }
      @case ('error') {
        <section
          class="dash-card flex flex-col items-center gap-3 px-5 py-14 text-center"
          role="alert"
        >
          <ng-icon name="lucideCircleAlert" size="24" class="text-loss" />
          <p class="text-sm">We couldn't load the activity.</p>
          <button type="button" class="ghost-button" (click)="activity.reload()">Try again</button>
        </section>
      }
      @case ('ready') {
        @let data = activity.data()!;
        <div class="grid shrink-0 grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          @for (kpi of kpis(); track kpi.label) {
            <section class="dash-card p-4">
              <h2 class="dash-label">{{ kpi.label }}</h2>
              <p class="mt-1.5 text-2xl font-semibold tracking-tight tabular-nums">{{ kpi.value }}</p>
              <div class="text-muted-foreground mt-2 flex items-center gap-2 text-xs">
                @if (kpi.change !== null) {
                  <app-change-pill [value]="kpi.change" />
                }
                <span>{{ kpi.note }}</span>
              </div>
            </section>
          }
        </div>

        <div
          class="grid gap-3 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)]"
        >
          <section class="dash-card flex min-h-0 flex-col p-5">
            <h2 class="dash-label">Notional traded</h2>
            <p class="mt-1 flex items-center gap-3">
              <span class="text-3xl font-semibold tracking-tight tabular-nums">
                {{ wholeDollars(data.notional.total) }}
              </span>
              @if (data.notional.change !== null) {
                <app-change-pill [value]="data.notional.change" />
              }
            </p>
            <app-line-chart
              class="mt-1 flex-1"
              area
              [points]="chart()"
              [tone]="(data.notional.change ?? 0) < 0 ? 'loss' : 'gain'"
              [description]="chartDescription()"
            />
          </section>

          <section class="dash-card min-h-0 overflow-hidden p-5">
            <div class="flex items-center justify-between gap-2">
              <h2 class="text-sm font-semibold">Orders by status</h2>
              <a routerLink="/orders" class="dash-link" data-print-hide="true">Open orders</a>
            </div>
            <div class="mt-5 flex flex-col gap-4">
              @for (row of statuses(); track row.status) {
                <div>
                  <div class="flex items-center justify-between text-sm">
                    <app-change-pill tag [tone]="row.tone">{{ row.status.toLowerCase() }}</app-change-pill>
                    <span class="tabular-nums">
                      {{ count(row.count) }}
                      <span class="text-muted-foreground text-xs">{{ percent(row.share) }}</span>
                    </span>
                  </div>
                  <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div class="h-full rounded-full" [class]="row.bar" [style.width.%]="row.share"></div>
                  </div>
                </div>
              }
            </div>
          </section>
        </div>

        <div class="grid gap-3 lg:min-h-0 lg:flex-1 lg:grid-cols-2 lg:grid-rows-[minmax(0,1fr)]">
          <section class="dash-card flex min-h-0 flex-col p-5">
            <div class="flex items-center justify-between gap-2">
              <h2 class="text-sm font-semibold">Live activity</h2>
              <span class="text-muted-foreground flex items-center gap-1.5 text-xs">
                <span class="bg-gain size-1.5 rounded-full"></span>Live
              </span>
            </div>
            @if (feed().length) {
              <ul class="dash-scroll mt-2 max-h-96 min-h-0 lg:max-h-none lg:flex-1">
                @for (item of feed(); track $index; let last = $last) {
                  <li
                    class="flex items-center gap-3 py-2.5 text-sm"
                    [class]="last ? '' : 'border-border/60 border-b'"
                  >
                    <span
                      class="bg-muted flex size-7 shrink-0 items-center justify-center rounded-lg"
                      [class]="item.color"
                    >
                      <ng-icon [name]="item.icon" size="14" />
                    </span>
                    <span class="min-w-0 flex-1">
                      <span class="block truncate">{{ item.text }}</span>
                      <span class="text-muted-foreground block text-xs">{{ item.when }}</span>
                    </span>
                    <span class="shrink-0 tabular-nums">{{ item.value }}</span>
                  </li>
                }
              </ul>
            } @else {
              <p class="text-muted-foreground mt-4 text-sm">Nothing has happened yet.</p>
            }
          </section>

          <section class="dash-card flex min-h-0 flex-col p-5">
            <h2 class="text-sm font-semibold">Most traded</h2>
            @if (data.mostTraded.length) {
              <div class="dash-table-head traded-grid mt-4">
                <span>Asset</span>
                <span>{{ rangeLabel() }}</span>
                <span class="text-right">Orders</span>
                <span class="text-right">Notional</span>
              </div>
              <ul class="dash-scroll max-h-96 min-h-0 lg:max-h-none lg:flex-1">
                @for (row of data.mostTraded; track row.symbol) {
                  <li class="dash-table-row traded-grid">
                    <span class="font-medium">{{ row.symbol }}</span>
                    <app-sparkline [points]="row.prices" />
                    <span class="text-right tabular-nums">{{ count(row.orders) }}</span>
                    <span class="text-right tabular-nums">{{ wholeDollars(row.notional) }}</span>
                  </li>
                }
              </ul>
            } @else {
              <p class="text-muted-foreground mt-4 text-sm">No orders were placed in this period.</p>
            }
          </section>
        </div>
      }
    }
  `,
})
export class ActivityComponent {
  private readonly _api = inject(ReportingApiService);

  protected readonly ranges = RANGES;
  protected readonly range = signal<ActivityRange>('today');
  protected readonly activity = live(() => this._api.activity(this.range()), ACTIVITY_REFRESH_MS);

  protected readonly rangeLabel = computed(
    () => RANGES.find((option) => option.value === this.range())!.label,
  );

  protected readonly subtitle = computed(() => {
    const data = this.activity.data();
    if (!data) {
      return 'Derived from order and cash ledgers';
    }
    const session = data.sessionId ? ` · simulation session #${data.sessionId}` : '';
    return `Derived from order and cash ledgers · updated ${clock(data.generatedAt)}${session}`;
  });

  protected readonly kpis = computed<Kpi[]>(() => {
    const { orders, fillRate, rejected, netCashFlow, activeTraders } = this.activity.data()!.kpis;
    return [
      { label: 'Orders', value: count(orders.value), change: orders.change, note: 'vs prior period' },
      {
        label: 'Fill rate',
        value: percent(fillRate.value),
        change: fillRate.change,
        note: `${count(fillRate.filled)} filled`,
      },
      {
        label: 'Rejected',
        value: count(rejected.value),
        change: null,
        note: rejected.topReason
          ? `${count(rejected.topReasonCount)} ${plainReason(rejected.topReason)}`
          : 'none in this period',
      },
      {
        label: 'Net cash flow',
        value: signedWholeDollars(netCashFlow.value),
        change: netCashFlow.change,
        note: 'deposits – withdrawals',
      },
      {
        label: 'Active traders',
        value: count(activeTraders.value),
        change: activeTraders.change,
        note: 'placed ≥ 1 order',
      },
    ];
  });

  // Today is plotted by the hour, the longer ranges by the day.
  protected readonly chart = computed<ChartPoint[]>(() => {
    const data = this.activity.data()!;
    const label = data.range === 'today' ? hour : day;
    return data.notional.points.map((point) => ({ value: point.value, label: label(point.at) }));
  });

  protected readonly chartDescription = computed(() => {
    const data = this.activity.data()!;
    return `Notional traded, ${this.rangeLabel()}: ${wholeDollars(data.notional.total)}`;
  });

  protected readonly statuses = computed(() => {
    const rows = this.activity.data()!.statuses;
    const total = rows.reduce((sum, row) => sum + row.count, 0);
    return rows.map((row) => {
      const tone = statusTone(row.status);
      return { ...row, tone, bar: BAR_COLORS[tone], share: total ? (row.count / total) * 100 : 0 };
    });
  });

  protected readonly feed = computed(() => this.activity.data()!.feed.map(feedRow));

  protected readonly count = count;
  protected readonly percent = percent;
  protected readonly wholeDollars = wholeDollars;

  protected choose(range: ActivityRange): void {
    this.range.set(range);
    this.activity.reload();
  }

  protected exportCsv(): void {
    downloadCsv(
      `activity-${this.range()}`,
      ['Status', 'Orders'],
      this.activity.data()?.statuses.map((row) => [row.status, row.count]) ?? [],
    );
  }
}
