import { CurrencyPipe, DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AccountStore } from '../accounts/account-store.service';
import { OrderStatus } from '../orders/order.models';
import { OrderService } from '../orders/order.service';
import {
  HistoryRow,
  HistorySortKey,
  SortDirection,
  orderHistoryRow,
  sortHistoryRows,
} from '../shared/activity';
import { ACTIVITY_TAG_CLASSES } from '../shared/activity-row.component';
import { DashboardDialogComponent } from '../shared/dashboard-dialog.component';
import { SortHeaderComponent } from '../shared/sort-header.component';

type StatusFilter = 'all' | OrderStatus;

const STATUS_FILTERS: readonly { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'FILLED', label: 'Filled' },
  { id: 'PENDING', label: 'Pending' },
  { id: 'REJECTED', label: 'Rejected' },
];

// Every order the user has placed on any of their accounts, whatever its outcome. Unlike the
// dashboard's recent transactions it is not trimmed to the simulated clock: it is the full
// record. Statuses stay current because the dashboard keeps polling while orders are pending.
@Component({
  selector: 'app-order-history-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, DashboardDialogComponent, DatePipe, SortHeaderComponent],
  template: `
    <app-dashboard-dialog
      dialogTitle="Order History"
      closeLabel="Close order history"
      size="wide"
      (closed)="closed.emit()"
    >
      <div class="mb-4 flex flex-wrap items-center gap-2">
        <div class="bg-muted flex gap-0.5 rounded-lg p-0.5" role="group" aria-label="Order status">
          @for (filter of statusFilters; track filter.id) {
            <button
              type="button"
              class="cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
              [class]="
                status() === filter.id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              "
              [attr.aria-pressed]="status() === filter.id"
              [attr.data-testid]="'order-history-filter-' + filter.id.toLowerCase()"
              (click)="status.set(filter.id)"
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
          data-testid="order-history-count"
        >
          {{ rows().length }} {{ rows().length === 1 ? 'order' : 'orders' }}
        </span>
      </div>

      @if (orderService.historyStatus() === 'error' || orderService.historyError()) {
        <p class="text-loss mb-3 text-xs" role="status" data-testid="order-history-dialog-error">
          Unable to refresh your orders.
          <button type="button" class="underline" (click)="refresh()">Retry</button>
        </p>
      }

      <div class="overflow-x-auto">
        <div class="min-w-[50rem]" data-testid="order-history-table">
          <div class="order-grid dash-table-head grid gap-2 px-2">
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
              <li data-testid="order-history-row" [attr.data-tag]="row.tag">
                <div class="order-grid grid w-full items-center gap-2 px-2 py-2.5 text-sm">
                  <span class="text-muted-foreground truncate tabular-nums">
                    {{ row.date | date: 'MMM d, y, h:mm a' : '' : 'en-US' }}
                  </span>
                  <span class="truncate">{{ row.account }}</span>
                  <span class="truncate font-medium">{{ row.label }}</span>
                  <span>
                    <span
                      class="rounded-full px-2 py-0.5 text-[10px] font-medium uppercase"
                      data-testid="order-history-status"
                      [class]="tagClass(row)"
                    >
                      {{ row.tag.toLowerCase() }}
                    </span>
                  </span>
                  <span class="truncate">{{ row.side }}</span>
                  <span class="truncate text-right tabular-nums">{{ row.shares }}</span>
                  <span class="truncate text-right tabular-nums">
                    {{ row.price | currency: 'USD' }}
                  </span>
                  <span
                    class="truncate text-right tabular-nums"
                    [class]="row.positive ? 'text-gain' : 'text-loss'"
                  >
                    {{ row.positive ? '+' : '-' }}{{ row.value | currency: 'USD' }}
                  </span>
                </div>
                @if (row.rejectionReason) {
                  <p class="text-loss px-2 pb-2 text-xs">{{ row.rejectionReason }}</p>
                }
              </li>
            } @empty {
              <li class="text-muted-foreground px-2 py-8 text-center text-sm">
                @if (orderService.historyStatus() === 'loading') {
                  Loading orders…
                } @else if (allRows().length === 0) {
                  You have not placed any orders yet.
                } @else {
                  No orders match these filters.
                }
              </li>
            }
          </ul>
        </div>
      </div>
    </app-dashboard-dialog>
  `,
  styleUrl: './history-table.css',
})
export class OrderHistoryDialogComponent implements OnInit {
  protected readonly orderService = inject(OrderService);
  private readonly accountStore = inject(AccountStore);
  private readonly destroyRef = inject(DestroyRef);

  readonly closed = output<void>();

  protected readonly statusFilters = STATUS_FILTERS;
  protected readonly columns: readonly {
    key: HistorySortKey;
    label: string;
    align: 'left' | 'right';
  }[] = [
    { key: 'date', label: 'Date', align: 'left' },
    { key: 'account', label: 'Account', align: 'left' },
    { key: 'label', label: 'Asset', align: 'left' },
    { key: 'tag', label: 'Status', align: 'left' },
    { key: 'side', label: 'Side', align: 'left' },
    { key: 'shares', label: 'Shares', align: 'right' },
    { key: 'price', label: 'Price', align: 'right' },
    { key: 'value', label: 'Value', align: 'right' },
  ];
  protected readonly status = signal<StatusFilter>('all');
  protected readonly query = signal('');
  protected readonly sortKey = signal<HistorySortKey>('date');
  protected readonly sortDirection = signal<SortDirection>('desc');

  protected readonly allRows = computed<HistoryRow[]>(() => {
    const accountNames = new Map(
      this.accountStore.accounts().map((account) => [account.accountId, account.name]),
    );
    const catalogue = this.orderService.catalogue();
    return this.orderService
      .orders()
      .map((order) =>
        orderHistoryRow(order, catalogue, accountNames.get(order.accountId ?? -1) ?? 'Account'),
      )
      .filter((row) => Number.isFinite(row.at));
  });

  protected readonly rows = computed(() => {
    const status = this.status();
    const query = this.query().trim().toLowerCase();
    return sortHistoryRows(
      this.allRows().filter(
        (row) =>
          (status === 'all' || row.tag === status) &&
          (!query || row.label.toLowerCase().includes(query)),
      ),
      this.sortKey(),
      this.sortDirection(),
    );
  });

  ngOnInit(): void {
    this.refresh();
  }

  // Opening the dialog revalidates the orders, so it never shows a status older than the
  // backend's.
  protected refresh(): void {
    this.orderService
      .loadOrders()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ error: () => undefined });
    this.orderService
      .instruments()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ error: () => undefined });
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

  protected tagClass(row: HistoryRow): string {
    return ACTIVITY_TAG_CLASSES[row.tag];
  }
}
