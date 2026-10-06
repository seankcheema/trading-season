import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { Instrument, PricePoint } from '../mock-data';
import { SortDirection } from '../shared/activity';
import {
  AssetFilter,
  AssetSortKey,
  PricedHolding,
  assetRows,
  matchesAssetFilter,
  matchesAssetQuery,
  sortAssetRows,
  summarizeAssets,
} from '../shared/assets';
import { DailySparklineComponent } from '../shared/daily-sparkline.component';
import { DashboardDialogComponent } from '../shared/dashboard-dialog.component';
import { SignedPercentPipe } from '../shared/signed-percent.pipe';
import { SortHeaderComponent } from '../shared/sort-header.component';

const FILTERS: readonly { id: AssetFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'gainers', label: 'Gainers' },
  { id: 'losers', label: 'Losers' },
];

// Every position in the selected account with portfolio totals, sortable columns, a gain and
// loss filter and each position's share of the portfolio. Choosing a row opens its order ticket.
@Component({
  selector: 'app-assets-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CurrencyPipe,
    DailySparklineComponent,
    DashboardDialogComponent,
    SignedPercentPipe,
    SortHeaderComponent,
  ],
  template: `
    <app-dashboard-dialog
      dialogTitle="Assets"
      closeLabel="Close assets"
      size="xwide"
      (closed)="closed.emit()"
    >
      <div class="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="assets-summary">
        @for (tile of tiles(); track tile.id) {
          <div class="border-border rounded-xl border px-3.5 py-3">
            <div class="dash-label">{{ tile.label }}</div>
            <div
              class="mt-1 text-xl font-semibold tracking-tight tabular-nums"
              [class]="tile.tone"
              [attr.data-testid]="'assets-summary-' + tile.id"
            >
              {{ tile.text }}
            </div>
          </div>
        }
      </div>

      <div class="mb-4 flex flex-wrap items-center gap-2">
        <div class="bg-muted flex gap-0.5 rounded-lg p-0.5" role="group" aria-label="Asset filter">
          @for (option of filters; track option.id) {
            <button
              type="button"
              class="cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
              [class]="
                filter() === option.id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              "
              [attr.aria-pressed]="filter() === option.id"
              [attr.data-testid]="'assets-filter-' + option.id"
              (click)="filter.set(option.id)"
            >
              {{ option.label }}
            </button>
          }
        </div>
        <input
          type="search"
          class="border-input bg-input/30 placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 h-8 w-full max-w-[13.75rem] rounded-lg border px-3 text-sm outline-none focus-visible:ring-3"
          placeholder="Filter by symbol or name"
          aria-label="Filter by symbol or name"
          [value]="query()"
          (input)="onQuery($event)"
        />
        <span class="text-muted-foreground ml-auto text-xs tabular-nums" data-testid="assets-count">
          {{ rows().length }} {{ rows().length === 1 ? 'asset' : 'assets' }}
        </span>
      </div>

      <div class="overflow-x-auto">
        <div class="min-w-[62rem]" data-testid="assets-dialog-table">
          <div class="assets-grid dash-table-head grid gap-2 px-2">
            @for (column of columns; track column.key) {
              <button
                app-sort-header
                [label]="column.label"
                [align]="column.align"
                [active]="sortKey() === column.key"
                [direction]="sortDirection()"
                (toggled)="sortBy(column.key)"
              ></button>
              @if (column.key === 'symbol') {
                <span class="truncate">Today</span>
              }
            }
          </div>
          <ul class="dash-scroll h-[min(50vh,28rem)] overflow-y-auto pb-4">
            @for (row of rows(); track row.symbol) {
              <li>
                <button
                  type="button"
                  class="assets-grid hover:bg-muted grid w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-2.5 text-left text-sm transition-colors"
                  [attr.aria-label]="'Trade ' + row.symbol"
                  [attr.data-testid]="'assets-dialog-row-' + row.symbol"
                  (click)="selected.emit(row.instrument)"
                >
                  <span class="min-w-0">
                    <span class="block truncate font-medium">{{ row.symbol }}</span>
                    <span class="text-muted-foreground block truncate text-xs">{{ row.name }}</span>
                  </span>
                  <app-daily-sparkline
                    [symbol]="row.symbol"
                    [points]="charts()[row.symbol] ?? []"
                  />
                  <span class="truncate text-right tabular-nums">{{ row.shares }}</span>
                  <span class="truncate text-right tabular-nums">
                    {{ row.costBasis | currency: 'USD' }}
                  </span>
                  <span class="truncate text-right tabular-nums">
                    {{ row.price | currency: 'USD' }}
                  </span>
                  <span
                    class="truncate text-right tabular-nums"
                    [class]="row.changePercent >= 0 ? 'text-gain' : 'text-loss'"
                  >
                    {{ row.changePercent | signedPercent }}
                  </span>
                  <span class="truncate text-right tabular-nums">
                    {{ row.value | currency: 'USD' }}
                  </span>
                  <span
                    class="truncate text-right tabular-nums"
                    [class]="row.gainLoss >= 0 ? 'text-gain' : 'text-loss'"
                  >
                    {{ row.gainLoss >= 0 ? '+' : '' }}{{ row.gainLoss | currency: 'USD' }}
                  </span>
                  <span
                    class="truncate text-right tabular-nums"
                    [class]="row.returnPercent >= 0 ? 'text-gain' : 'text-loss'"
                  >
                    {{ row.returnPercent | signedPercent }}
                  </span>
                  <span class="flex items-center justify-end gap-2 tabular-nums">
                    <span
                      class="h-1 w-9 overflow-hidden rounded-full bg-white/10"
                      aria-hidden="true"
                    >
                      <span class="bg-primary block h-full" [style.width.%]="row.weight"></span>
                    </span>
                    <span data-testid="assets-weight">{{ row.weight.toFixed(1) }}%</span>
                  </span>
                </button>
              </li>
            } @empty {
              <li class="text-muted-foreground px-2 py-8 text-center text-sm">
                {{
                  holdings().length
                    ? 'No assets match these filters.'
                    : 'This account has no holdings yet.'
                }}
              </li>
            }
          </ul>
        </div>
      </div>
    </app-dashboard-dialog>
  `,
  styleUrl: './history-table.css',
})
export class AssetsDialogComponent {
  readonly holdings = input.required<readonly PricedHolding[]>();
  // Today's price series by symbol, for the sparklines.
  readonly charts = input<Record<string, PricePoint[]>>({});
  readonly closed = output<void>();
  readonly selected = output<Instrument>();

  protected readonly filters = FILTERS;
  protected readonly columns: readonly {
    key: AssetSortKey;
    label: string;
    align: 'left' | 'right';
  }[] = [
    { key: 'symbol', label: 'Asset', align: 'left' },
    { key: 'shares', label: 'Shares', align: 'right' },
    { key: 'costBasis', label: 'Avg Price', align: 'right' },
    { key: 'price', label: 'Price', align: 'right' },
    { key: 'changePercent', label: 'Change %', align: 'right' },
    { key: 'value', label: 'Value', align: 'right' },
    { key: 'gainLoss', label: 'Value $', align: 'right' },
    { key: 'returnPercent', label: 'Return', align: 'right' },
    { key: 'weight', label: 'Weight', align: 'right' },
  ];
  protected readonly filter = signal<AssetFilter>('all');
  protected readonly query = signal('');
  protected readonly sortKey = signal<AssetSortKey>('value');
  protected readonly sortDirection = signal<SortDirection>('desc');

  private readonly allRows = computed(() => assetRows(this.holdings()));

  protected readonly rows = computed(() => {
    const filter = this.filter();
    const query = this.query();
    return sortAssetRows(
      this.allRows().filter(
        (row) => matchesAssetFilter(row, filter) && matchesAssetQuery(row, query),
      ),
      this.sortKey(),
      this.sortDirection(),
    );
  });

  // Totals describe the whole portfolio, whatever the filters hide.
  protected readonly tiles = computed(() => {
    const summary = summarizeAssets(this.holdings());
    const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
    return [
      {
        id: 'market-value',
        label: 'Market value',
        text: USD.format(summary.marketValue),
        tone: '',
      },
      { id: 'cost-basis', label: 'Cost basis', text: USD.format(summary.costBasis), tone: '' },
      {
        id: 'unrealized',
        label: 'Unrealized',
        text: `${summary.unrealized >= 0 ? '+' : ''}${USD.format(summary.unrealized)}`,
        tone: summary.unrealized >= 0 ? 'text-gain' : 'text-loss',
      },
      { id: 'positions', label: 'Positions', text: String(summary.positions), tone: '' },
    ];
  });

  protected onQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected sortBy(key: AssetSortKey): void {
    if (this.sortKey() === key) {
      this.sortDirection.update((direction) => (direction === 'desc' ? 'asc' : 'desc'));
    } else {
      this.sortKey.set(key);
      this.sortDirection.set('desc');
    }
  }
}
