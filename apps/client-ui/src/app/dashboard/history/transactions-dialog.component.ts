import { CurrencyPipe, DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CashTransaction } from '../accounts/account.models';
import { AccountStore } from '../accounts/account-store.service';
import { OrderService } from '../orders/order.service';
import {
  HistoryRow,
  HistorySortKey,
  SortDirection,
  cashHistoryRow,
  orderHistoryRow,
  sortHistoryRows,
} from '../shared/activity';
import { ACTIVITY_TAG_CLASSES } from '../shared/activity-row.component';
import { DashboardDialogComponent } from '../shared/dashboard-dialog.component';
import { SortHeaderComponent } from '../shared/sort-header.component';

type KindFilter = 'all' | 'trades' | 'cash';

const KIND_FILTERS: readonly { id: KindFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'trades', label: 'Trades' },
  { id: 'cash', label: 'Cash' },
];

// Every cash transfer and order the user has made, not just the latest few on the dashboard.
// Orders follow the same replay rule as the dashboard: those after the simulated clock are
// hidden.
@Component({
  selector: 'app-transactions-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, DashboardDialogComponent, DatePipe, SortHeaderComponent],
  template: `
    <app-dashboard-dialog
      dialogTitle="Recent Transactions"
      closeLabel="Close recent transactions"
      size="wide"
      (closed)="closed.emit()"
    >
      <div class="mb-4 flex flex-wrap items-center gap-2">
        <div
          class="bg-muted flex gap-0.5 rounded-lg p-0.5"
          role="group"
          aria-label="Transaction type"
        >
          @for (filter of kindFilters; track filter.id) {
            <button
              type="button"
              class="cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
              [class]="
                kind() === filter.id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              "
              [attr.aria-pressed]="kind() === filter.id"
              [attr.data-testid]="'transactions-filter-' + filter.id"
              (click)="kind.set(filter.id)"
            >
              {{ filter.label }}
            </button>
          }
        </div>
        <input
          type="search"
          class="border-input bg-input/30 placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 h-8 w-full max-w-[13.75rem] rounded-lg border px-3 text-sm outline-none focus-visible:ring-3"
          placeholder="Filter by symbol"
          aria-label="Filter by symbol"
          [value]="query()"
          (input)="onQuery($event)"
        />
        <span
          class="text-muted-foreground ml-auto text-xs tabular-nums"
          data-testid="transactions-count"
        >
          {{ rows().length }} {{ rows().length === 1 ? 'transaction' : 'transactions' }}
        </span>
      </div>

      @if (loadError()) {
        <p class="text-loss mb-3 text-xs" role="status" data-testid="transactions-error">
          Unable to load your full cash history. Showing recent transfers only.
        </p>
      }

      <div class="overflow-x-auto">
        <div class="min-w-[46rem]" data-testid="transactions-table">
          <div class="history-grid dash-table-head grid gap-2 px-2">
            @for (column of columns; track column.key) {
              <button
                app-sort-header
                [label]="column.label"
                [align]="column.align"
                [active]="sortKey() === column.key"
                [direction]="sortDirection()"
                (toggled)="sortBy(column.key)"
              ></button>
            }
          </div>
          <ul class="dash-scroll max-h-[min(60vh,32.5rem)] overflow-y-auto pb-4">
            @for (row of rows(); track row.key) {
              <li data-testid="transactions-row" [attr.data-tag]="row.tag">
                <button
                  type="button"
                  class="history-grid hover:bg-muted grid w-full items-center gap-2 rounded-lg px-2 py-2.5 text-left text-sm transition-colors enabled:cursor-pointer disabled:cursor-default disabled:hover:bg-transparent"
                  [disabled]="!row.symbol"
                  [attr.aria-label]="row.symbol ? 'Trade ' + row.symbol : null"
                  (click)="onRow(row)"
                >
                  <span class="text-muted-foreground truncate tabular-nums">
                    {{ row.date | date: 'MMM d, y, h:mm a' : '' : 'en-US' }}
                  </span>
                  <span class="truncate font-medium">{{ row.label }}</span>
                  <span>
                    <span
                      class="rounded-full px-2 py-0.5 text-[10px] font-medium uppercase"
                      [class]="tagClass(row)"
                    >
                      {{ row.tag.toLowerCase() }}
                    </span>
                  </span>
                  <span class="truncate">{{ row.side ?? '—' }}</span>
                  <span class="truncate text-right tabular-nums">{{ row.shares ?? '—' }}</span>
                  <span class="truncate text-right tabular-nums">
                    @if (row.price !== null) {
                      {{ row.price | currency: 'USD' }}
                    } @else {
                      —
                    }
                  </span>
                  <span
                    class="truncate text-right tabular-nums"
                    [class]="row.positive ? 'text-gain' : 'text-loss'"
                  >
                    {{ row.positive ? '+' : '-' }}{{ row.value | currency: 'USD' }}
                  </span>
                </button>
              </li>
            } @empty {
              <li class="text-muted-foreground px-2 py-8 text-center text-sm">
                {{ loading() ? 'Loading transactions…' : 'No transactions match these filters.' }}
              </li>
            }
          </ul>
        </div>
      </div>
    </app-dashboard-dialog>
  `,
  styleUrl: './history-table.css',
})
export class TransactionsDialogComponent implements OnInit {
  private readonly accountStore = inject(AccountStore);
  private readonly orderService = inject(OrderService);
  private readonly destroyRef = inject(DestroyRef);

  // The simulated clock in milliseconds, or null when there is none. Orders after it are hidden.
  readonly marketTime = input<number | null>(null);
  readonly closed = output<void>();
  // A trade row was chosen; the owner decides whether that opens the order ticket.
  readonly symbolSelected = output<string>();

  protected readonly kindFilters = KIND_FILTERS;
  protected readonly columns: readonly {
    key: HistorySortKey;
    label: string;
    align: 'left' | 'right';
  }[] = [
    { key: 'date', label: 'Date', align: 'left' },
    { key: 'label', label: 'Asset', align: 'left' },
    { key: 'tag', label: 'Type', align: 'left' },
    { key: 'side', label: 'Side', align: 'left' },
    { key: 'shares', label: 'Shares', align: 'right' },
    { key: 'price', label: 'Price', align: 'right' },
    { key: 'value', label: 'Value', align: 'right' },
  ];
  protected readonly kind = signal<KindFilter>('all');
  protected readonly query = signal('');
  protected readonly sortKey = signal<HistorySortKey>('date');
  protected readonly sortDirection = signal<SortDirection>('desc');
  protected readonly loading = signal(true);
  protected readonly loadError = signal(false);

  // Starts from the few transfers the dashboard already holds, then swaps in the full ledger.
  private readonly fullCash = signal<CashTransaction[] | null>(null);

  private readonly allRows = computed<HistoryRow[]>(() => {
    const cursor = this.marketTime();
    const accountNames = new Map(
      this.accountStore.accounts().map((account) => [account.accountId, account.name]),
    );
    const catalogue = this.orderService.catalogue();
    const orders = this.orderService
      .orders()
      .map((order) =>
        orderHistoryRow(order, catalogue, accountNames.get(order.accountId ?? -1) ?? 'Account'),
      )
      .filter((row) => Number.isFinite(row.at) && (cursor === null || row.at <= cursor));
    const cash = (this.fullCash() ?? this.accountStore.cashTransactions()).map(cashHistoryRow);
    return [...cash, ...orders];
  });

  protected readonly rows = computed(() => {
    const kind = this.kind();
    const query = this.query().trim().toLowerCase();
    return sortHistoryRows(
      this.allRows().filter(
        (row) =>
          (kind === 'all' || (kind === 'trades' ? row.kind === 'trade' : row.kind === 'cash')) &&
          (!query || row.label.toLowerCase().includes(query)),
      ),
      this.sortKey(),
      this.sortDirection(),
    );
  });

  ngOnInit(): void {
    this.accountStore
      .loadCashHistory()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (transactions) => {
          this.fullCash.set(transactions);
          this.loading.set(false);
        },
        error: () => {
          this.loadError.set(true);
          this.loading.set(false);
        },
      });
  }

  protected onQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected onRow(row: HistoryRow): void {
    if (row.symbol) this.symbolSelected.emit(row.symbol);
  }

  protected sortBy(key: HistorySortKey): void {
    if (this.sortKey() === key) {
      this.sortDirection.update((direction) => (direction === 'desc' ? 'asc' : 'desc'));
    } else {
      this.sortKey.set(key);
      this.sortDirection.set('desc');
    }
  }

  protected tagClass(row: HistoryRow): string {
    return ACTIVITY_TAG_CLASSES[row.tag];
  }
}
