import { CancelOrderButtonComponent } from '../shared/cancel-order-button.component';
import { CurrencyPipe, DatePipe, NgTemplateOutlet } from '@angular/common';
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
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideFilter } from '@ng-icons/lucide';
import { CashTransaction } from '../accounts/account.models';
import { AccountStore } from '../accounts/account-store.service';
import { OrderService } from '../orders/order.service';
import { ExecutionType, OrderAuditEntry } from '../orders/order.models';
import {
  HistoryRow,
  HistorySortKey,
  SortDirection,
  cashHistoryRow,
  orderHistoryRow,
  sortHistoryRows,
} from '../shared/activity';
import { ACTIVITY_STATUS_CLASSES } from '../shared/activity-row.component';
import { DashboardDialogComponent } from '../shared/dashboard-dialog.component';
import { SortHeaderComponent } from '../shared/sort-header.component';

type TypeFilter = 'all' | HistoryRow['side'];
type StatusFilter = 'all' | HistoryRow['status'];

const TYPE_FILTERS: readonly { id: TypeFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'Buy', label: 'Buy' },
  { id: 'Sell', label: 'Sell' },
  { id: 'Deposit', label: 'Deposit' },
  { id: 'Withdrawal', label: 'Withdrawal' },
];

const STATUS_FILTERS: readonly { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'FILLED', label: 'Filled' },
  { id: 'PENDING', label: 'Pending' },
  { id: 'ACCEPTED', label: 'Accepted' },
  { id: 'REJECTED', label: 'Rejected' },
  { id: 'CANCELLED', label: 'Cancelled' },
  { id: 'COMPLETED', label: 'Completed' },
];

type ExecutionFilter = 'all' | ExecutionType;
type AccountFilter = 'all' | number;

const EXECUTION_LABELS: Record<ExecutionType, string> = {
  MARKET: 'Market',
  LIMIT: 'Limit',
  STOP: 'Stop',
  STOP_LIMIT: 'Stop-limit',
};

const EXECUTION_FILTERS: readonly { id: ExecutionFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'MARKET', label: EXECUTION_LABELS.MARKET },
  { id: 'LIMIT', label: EXECUTION_LABELS.LIMIT },
  { id: 'STOP', label: EXECUTION_LABELS.STOP },
  { id: 'STOP_LIMIT', label: EXECUTION_LABELS.STOP_LIMIT },
];

// Every cash transfer and order the user has made, not just the latest few on the dashboard.
// Orders follow the same replay rule as the dashboard: those after the simulated clock are
// hidden.
@Component({
  selector: 'app-transactions-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CancelOrderButtonComponent, CurrencyPipe, DashboardDialogComponent, DatePipe, NgIcon, NgTemplateOutlet, SortHeaderComponent],
  providers: [provideIcons({ lucideFilter })],
  template: `
    <app-dashboard-dialog
      dialogTitle="Recent Transactions"
      closeLabel="Close recent transactions"
      size="xwide"
      (closed)="closed.emit()"
    >
      <div class="mb-4 flex flex-wrap items-center gap-2">
        <div class="relative" (keydown.escape)="closeFilters($event)">
          <button
            type="button"
            class="border-input bg-input/30 hover:bg-muted flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 text-sm transition-colors"
            aria-haspopup="true"
            aria-label="Filters"
            data-testid="transactions-filters"
            [attr.aria-expanded]="filtersOpen()"
            (click)="filtersOpen.set(!filtersOpen())"
          >
            <ng-icon name="lucideFilter" class="text-[16px]" />
            @if (activeFilters() > 0) {
              <span
                class="bg-primary text-primary-foreground rounded-full px-1.5 text-[10px] leading-4 font-semibold"
                data-testid="transactions-filters-count"
              >
                {{ activeFilters() }}
              </span>
            }
          </button>
          @if (filtersOpen()) {
            <div
              class="fixed inset-0 z-10"
              aria-hidden="true"
              (click)="filtersOpen.set(false)"
            ></div>
            <div
              class="border-border bg-popover absolute top-full left-0 z-20 mt-1 w-72 rounded-xl border p-3 shadow-lg"
              role="group"
              aria-label="Transaction filters"
              data-testid="transactions-filters-panel"
            >
              <p class="text-muted-foreground mb-1.5 text-xs font-medium">Type</p>
              <div class="mb-3 flex flex-wrap gap-1" role="group" aria-label="Transaction type">
                @for (filter of typeFilters; track filter.id) {
                  <button
                    type="button"
                    class="cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
                    [class]="
                      type() === filter.id
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:text-foreground'
                    "
                    [attr.aria-pressed]="type() === filter.id"
                    [attr.data-testid]="'transactions-filter-' + filter.id.toLowerCase()"
                    (click)="type.set(filter.id)"
                  >
                    {{ filter.label }}
                  </button>
                }
              </div>
              <p class="text-muted-foreground mb-1.5 text-xs font-medium">Status</p>
              <div class="mb-3 flex flex-wrap gap-1" role="group" aria-label="Transaction status">
                @for (filter of statusFilters; track filter.id) {
                  <button
                    type="button"
                    class="cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
                    [class]="
                      status() === filter.id
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:text-foreground'
                    "
                    [attr.aria-pressed]="status() === filter.id"
                    [attr.data-testid]="'transactions-status-' + filter.id.toLowerCase()"
                    (click)="status.set(filter.id)"
                  >
                    {{ filter.label }}
                  </button>
                }
              </div>
              <p class="text-muted-foreground mb-1.5 text-xs font-medium">Order kind</p>
              <div class="mb-3 flex flex-wrap gap-1" role="group" aria-label="Order kind">
                @for (filter of executionFilters; track filter.id) {
                  <button
                    type="button"
                    class="cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
                    [class]="
                      execution() === filter.id
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:text-foreground'
                    "
                    [attr.aria-pressed]="execution() === filter.id"
                    [attr.data-testid]="'transactions-execution-' + filter.id.toLowerCase()"
                    (click)="execution.set(filter.id)"
                  >
                    {{ filter.label }}
                  </button>
                }
              </div>
              <p class="text-muted-foreground mb-1.5 text-xs font-medium">Account</p>
              <div class="flex flex-wrap gap-1" role="group" aria-label="Transaction account">
                <button
                  type="button"
                  class="cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
                  [class]="
                    accountId() === 'all'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  "
                  [attr.aria-pressed]="accountId() === 'all'"
                  data-testid="transactions-account-all"
                  (click)="accountId.set('all')"
                >
                  All
                </button>
                @for (account of accountStore.accounts(); track account.accountId) {
                  <button
                    type="button"
                    class="max-w-full cursor-pointer truncate rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
                    [class]="
                      accountId() === account.accountId
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:text-foreground'
                    "
                    [attr.aria-pressed]="accountId() === account.accountId"
                    [attr.data-testid]="'transactions-account-' + account.accountId"
                    (click)="accountId.set(account.accountId)"
                  >
                    {{ account.name }}
                  </button>
                }
              </div>
              @if (activeFilters() > 0) {
                <button
                  type="button"
                  class="text-primary mt-3 cursor-pointer text-xs font-medium hover:underline"
                  data-testid="transactions-filters-clear"
                  (click)="clearFilters()"
                >
                  Clear filters
                </button>
              }
            </div>
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
        <div class="min-w-[54rem]" data-testid="transactions-table">
          <div class="history-grid dash-table-head grid gap-2 px-2">
            <span aria-hidden="true"></span>
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
            <span><span class="sr-only">Actions</span></span>
          </div>
          <ul class="dash-scroll h-[min(60vh,32.5rem)] overflow-y-auto pb-4">
            @for (row of rows(); track row.key) {
              <li data-testid="transactions-row" [attr.data-status]="row.status">
                @if (row.kind === 'trade' && row.orderId !== null) {
                <div class="history-grid hover:bg-muted/50 grid w-full items-center gap-2 rounded-md px-2 py-2.5 text-left text-sm transition-colors">
                  <button type="button" class="text-muted-foreground flex h-4 w-4 cursor-pointer items-center justify-center transition-transform"
                    [class.rotate-90]="expandedOrderId() === row.orderId" [class.text-primary]="expandedOrderId() === row.orderId"
                    [attr.aria-expanded]="expandedOrderId() === row.orderId" [attr.aria-label]="'Show audit trail for ' + row.label"
                    [attr.data-testid]="'transactions-order-' + row.orderId" (click)="toggleAudit(row)">
                    <svg viewBox="0 0 16 16" class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3.5 10.5 8 6 12.5" /></svg>
                  </button>
                  <ng-container [ngTemplateOutlet]="rowCells" [ngTemplateOutletContext]="{ $implicit: row }"></ng-container>
                </div>
                @if (expandedOrderId() === row.orderId) {
                  <section class="audit-trail mb-2 ml-8 mr-2 border-l-2 border-foreground/50 py-1 pl-3 text-foreground/90" [attr.data-testid]="'audit-trail-' + row.orderId" aria-label="Order audit trail">
                    @if (auditLoading().has(row.orderId)) {
                      <p class="text-muted-foreground text-xs">Loading audit trail…</p>
                    } @else if (auditErrors().has(row.orderId)) {
                      <p class="text-loss text-xs" role="status">Unable to load this order's audit trail.</p>
                    } @else {
                      @for (entry of auditEntries().get(row.orderId) ?? []; track entry.occurredAt + entry.eventType) {
                        <div class="audit-entry relative grid grid-cols-[0.75rem_8rem_minmax(0,1fr)_auto] items-baseline gap-x-2 pb-1.5 text-xs last:pb-0">
                          <span class="audit-marker h-2 w-2 self-center rounded-full" [class]="auditMarkerClass(entry)" aria-hidden="true"></span>
                          <span class="truncate font-semibold">{{ entry.eventType }}</span>
                          <time class="text-[0.6875rem] text-muted-foreground tabular-nums" [attr.datetime]="entry.occurredAt">{{ entry.occurredAt | date: 'MMM d, h:mm:ss a' : '' : 'en-US' }}</time>                          <p class="text-right font-semibold tabular-nums">{{ entry.price | currency: 'USD' }}</p>
                        </div>
                      } @empty { <p class="text-muted-foreground text-xs">No audit events were recorded for this order.</p> }
                    }
                  </section>
                }
                } @else {
                <div class="history-grid grid w-full cursor-default items-center gap-2 px-2 py-2.5 text-left text-sm">
                  <span aria-hidden="true"></span>
                  <ng-container [ngTemplateOutlet]="rowCells" [ngTemplateOutletContext]="{ $implicit: row }"></ng-container>
                </div>
                }
                <ng-template #rowCells let-row>
                  <span class="text-muted-foreground truncate tabular-nums">
                    {{ row.date | date: 'MMM d, y, h:mm a' : '' : 'en-US' }}
                  </span>
                  <span class="truncate font-medium">{{ row.label }}</span>
                  <span class="text-muted-foreground truncate" data-testid="transaction-account">{{ row.account }}</span>
                  <span class="truncate">
                    {{ row.side }}
                    @if (row.executionType && row.executionType !== 'MARKET') {
                      <span class="text-muted-foreground block text-[10px]" data-testid="transaction-execution">{{ executionLabel(row.executionType) }}</span>
                    }
                  </span>
                  <span>
                    <span
                      class="rounded-full px-2 py-0.5 text-[10px] font-medium uppercase"
                      [class]="tagClass(row)"
                    >
                      {{ row.status.toLowerCase() }}
                    </span>
                  </span>
                  <span class="truncate text-right tabular-nums">{{ row.shares ?? '—' }}</span>
                  <span class="text-right tabular-nums">
                    <span>
                      @if (row.price !== null) { {{ row.price | currency: 'USD' }} } @else { — }
                    </span>
                    @if (row.priceDetail) { <span class="text-muted-foreground block text-[10px]">{{ row.priceDetail }}</span> }
                  </span>
                  <span
                    class="truncate text-right tabular-nums"
                    data-testid="transaction-amount"
                    [class]="row.kind === 'cash' ? (row.positive ? 'text-gain' : 'text-loss') : ''"
                  >
                    {{ sign(row) }}{{ row.value | currency: 'USD' }}
                  </span>
                  <span class="flex self-stretch items-center justify-end" data-testid="transaction-actions">
                    @if (row.status === 'ACCEPTED' && row.orderId !== null) {
                      <app-cancel-order-button [orderLabel]="row.label" [busy]="cancelling().has(row.orderId)" (confirmed)="cancelOrder(row)" (edited)="orderService.editOrder(row.orderId!)" />
                    }
                  </span>
                </ng-template>
              </li>
            } @empty {
              @if (loading()) {
                <li class="sr-only" role="status">Loading transactions…</li>
                @for (row of skeletonRows; track row) {
                  <li
                    class="history-grid grid items-center gap-2 px-2 py-2.5"
                    aria-hidden="true"
                    data-testid="transactions-row-skeleton"
                  >
                    <span></span>
                    <span class="skeleton h-5 w-4/5"></span>
                    @for (cell of [1, 2, 3, 4]; track cell) {
                      <span class="skeleton h-5 w-3/5"></span>
                    }
                    @for (cell of [1, 2, 3]; track cell) {
                      <span class="skeleton ml-auto h-5 w-3/5"></span>
                    }
                    <span></span>
                  </li>
                }
              } @else {
                <li class="text-muted-foreground px-2 py-8 text-center text-sm">
                  No transactions match these filters.
                </li>
              }
            }
          </ul>
        </div>
      </div>
    </app-dashboard-dialog>
  `,
  styleUrl: './history-table.css',
})
export class TransactionsDialogComponent implements OnInit {
  protected readonly accountStore = inject(AccountStore);
  protected readonly orderService = inject(OrderService);
  private readonly destroyRef = inject(DestroyRef);

  // The simulated clock in milliseconds, or null when there is none. Orders after it are hidden.
  readonly marketTime = input<number | null>(null);
  readonly closed = output<void>();

  protected readonly typeFilters = TYPE_FILTERS;
  protected readonly statusFilters = STATUS_FILTERS;
  protected readonly executionFilters = EXECUTION_FILTERS;
  protected readonly columns: readonly {
    key: HistorySortKey;
    label: string;
    align: 'left' | 'right';
  }[] = [
    { key: 'date', label: 'Date', align: 'left' },
    { key: 'label', label: 'Asset', align: 'left' },
    { key: 'account', label: 'Account', align: 'left' },
    { key: 'side', label: 'Type', align: 'left' },
    { key: 'status', label: 'Status', align: 'left' },
    { key: 'shares', label: 'Shares', align: 'right' },
    { key: 'price', label: 'Price', align: 'right' },
    { key: 'value', label: 'Value', align: 'right' },
  ];
  protected readonly type = signal<TypeFilter>('all');
  protected readonly status = signal<StatusFilter>('all');
  protected readonly execution = signal<ExecutionFilter>('all');
  // Cash is shared by every account, so picking one account leaves cash transfers out.
  protected readonly accountId = signal<AccountFilter>('all');
  protected readonly filtersOpen = signal(false);
  protected readonly activeFilters = computed(
    () =>
      Number(this.type() !== 'all') +
      Number(this.status() !== 'all') +
      Number(this.execution() !== 'all') +
      Number(this.accountId() !== 'all'),
  );
  protected readonly query = signal('');
  protected readonly sortKey = signal<HistorySortKey>('date');
  protected readonly sortDirection = signal<SortDirection>('desc');
  protected readonly loading = signal(true);
  // How many placeholder rows stand in for the table while it loads.
  protected readonly skeletonRows = [1, 2, 3, 4, 5, 6] as const;
  protected readonly loadError = signal(false);
  protected readonly cancelling = signal<ReadonlySet<number>>(new Set());
  protected cancelOrder(row: HistoryRow): void {
    if (row.orderId === null || this.cancelling().has(row.orderId)) {
      return;
    }
    this.cancelling.update((ids) => new Set(ids).add(row.orderId!));
    this.orderService.cancelOrder(row.orderId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => { this.cancelling.update((ids) => withoutId(ids, row.orderId!)); this.accountStore.load(true); },
      error: () => { this.cancelling.update((ids) => withoutId(ids, row.orderId!)); this.loadError.set(true); },
    });
  }
  protected readonly expandedOrderId = signal<number | null>(null);
  protected readonly auditEntries = signal<ReadonlyMap<number, readonly OrderAuditEntry[]>>(new Map());
  protected readonly auditLoading = signal<ReadonlySet<number>>(new Set());
  protected readonly auditErrors = signal<ReadonlySet<number>>(new Set());

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
    const type = this.type();
    const status = this.status();
    const execution = this.execution();
    const accountId = this.accountId();
    const query = this.query().trim().toLowerCase();
    return sortHistoryRows(
      this.allRows().filter((row) =>
        matchesFilters(row, type, status, execution, accountId, query),
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

  // Escape closes just the filter panel, not the dialog around it.
  protected closeFilters(event: Event): void {
    if (this.filtersOpen()) {
      event.stopPropagation();
      this.filtersOpen.set(false);
    }
  }

  protected clearFilters(): void {
    this.type.set('all');
    this.status.set('all');
    this.execution.set('all');
    this.accountId.set('all');
  }

  protected executionLabel(execution: ExecutionType): string {
    return EXECUTION_LABELS[execution];
  }

  protected onQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected sortBy(key: HistorySortKey): void {
    if (this.sortKey() === key) {
      this.sortDirection.update((direction) => (direction === 'desc' ? 'asc' : 'desc'));
    } else {
      this.sortKey.set(key);
      this.sortDirection.set('desc');
    }
  }

  // Only cash transfers carry a +/- sign; a trade's value is its plain notional amount.
  protected sign(row: HistoryRow): string {
    if (row.kind !== 'cash') {
      return '';
    }
    return row.positive ? '+' : '-';
  }

  protected tagClass(row: HistoryRow): string {
    return ACTIVITY_STATUS_CLASSES[row.status];
  }

  protected auditMarkerClass(entry: OrderAuditEntry): string {
    if (entry.eventType === 'FILLED') {
      return 'bg-gain';
    }
    if (entry.eventType === 'REJECTED' || entry.eventType === 'EXECUTION_FAILED') {
      return 'bg-loss';
    }
    if (entry.eventType === 'PENDING') {
      return 'bg-pending';
    }
    return 'bg-primary';
  }

  protected toggleAudit(row: HistoryRow): void {
    if (row.orderId === null) {
      return;
    }
    if (this.expandedOrderId() === row.orderId) {
      this.expandedOrderId.set(null);
      return;
    }
    this.expandedOrderId.set(row.orderId);
    if (this.auditEntries().has(row.orderId) || this.auditLoading().has(row.orderId)) {
      return;
    }
    this.auditErrors.update((ids) => withoutId(ids, row.orderId!));
    this.auditLoading.update((ids) => new Set(ids).add(row.orderId!));
    this.orderService
      .orderAudit(row.orderId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (entries) => {
          this.auditEntries.update((audits) => new Map(audits).set(row.orderId!, entries));
          this.auditLoading.update((ids) => withoutId(ids, row.orderId!));
        },
        error: () => {
          this.auditErrors.update((ids) => new Set(ids).add(row.orderId!));
          this.auditLoading.update((ids) => withoutId(ids, row.orderId!));
        },
      });
  }
}

function matchesFilters(
  row: HistoryRow,
  type: TypeFilter,
  status: StatusFilter,
  execution: ExecutionFilter,
  accountId: AccountFilter,
  query: string,
): boolean {
  if (query && !row.label.toLowerCase().includes(query)) {
    return false;
  }
  return (
    matchesChoice(type, row.side) &&
    matchesChoice(status, row.status) &&
    matchesChoice(execution, row.executionType) &&
    matchesChoice(accountId, row.accountId)
  );
}

function matchesChoice<T>(choice: 'all' | T, value: T | null): boolean {
  return choice === 'all' || choice === value;
}

function withoutId(ids: ReadonlySet<number>, id: number): ReadonlySet<number> {
  const next = new Set(ids);
  next.delete(id);
  return next;
}
