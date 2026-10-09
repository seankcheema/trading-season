import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCircleAlert, lucideSearch, lucideX } from '@ng-icons/lucide';
import { OrderRow } from '../reporting/console.models';
import { SortState, sortRows } from '../reporting/report-summary';
import { ReportingApiService } from '../reporting/reporting-api.service';
import { ExportMenuComponent, downloadCsv } from '../shared/export-menu.component';
import { FilterSelectComponent, SelectOption } from '../shared/filter-select.component';
import { live } from '../shared/live';
import { PageHeaderComponent } from '../shared/page-header.component';
import { OrderDetailComponent } from './order-detail.component';
import { OrderSortKey, OrderTableComponent, orderSortValue } from './order-table.component';

// How often the order list is read again.
export const ORDERS_REFRESH_MS = 30_000;

const ALL = 'ALL';
const NO_FILTERS = { query: '', status: ALL, side: ALL, symbol: ALL, user: ALL, fill: ALL };
type Filters = typeof NO_FILTERS;

function distinct(orders: readonly OrderRow[], pick: (order: OrderRow) => string): string[] {
  return [...new Set(orders.map(pick))].sort((a, b) => a.localeCompare(b));
}

// Every order on the platform, searchable and filterable. A row opens the order
// with its ledger impact and audit trail.
@Component({
  selector: 'app-orders',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgIcon,
    PageHeaderComponent,
    ExportMenuComponent,
    FilterSelectComponent,
    OrderTableComponent,
    OrderDetailComponent,
  ],
  providers: [provideIcons({ lucideCircleAlert, lucideSearch, lucideX })],
  host: { class: 'flex min-h-[32rem] flex-1 basis-0 flex-col gap-3' },
  template: `
    <app-page-header title="Orders" [subtitle]="subtitle()">
      <app-export-menu (exportCsv)="exportCsv()" />
    </app-page-header>

    <section class="dash-card flex min-h-0 flex-1 flex-col p-5">
      @switch (list.state()) {
        @case ('loading') {
          <p class="text-muted-foreground text-sm" aria-busy="true">Loading orders…</p>
        }
        @case ('error') {
          <div class="flex flex-col items-center gap-3 py-14 text-center" role="alert">
            <ng-icon name="lucideCircleAlert" size="24" class="text-loss" />
            <p class="text-sm">We couldn't load the orders.</p>
            <button type="button" class="ghost-button" (click)="list.reload()">Try again</button>
          </div>
        }
        @case ('ready') {
          <div class="mb-4 flex flex-wrap items-end gap-2" data-print-hide="true">
            <label class="flex max-w-[300px] flex-[1_1_240px] flex-col gap-1">
              <span class="dash-label text-[11px]">Search</span>
              <span class="relative">
                <ng-icon
                  name="lucideSearch"
                  size="16"
                  class="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2"
                />
                <input
                  type="search"
                  class="ds-control py-1 pr-2.5 pl-8"
                  placeholder="Customer, symbol, order # or ref"
                  [value]="filters().query"
                  (input)="set('query', $any($event.target).value)"
                />
              </span>
            </label>
            <app-filter-select
              label="Status"
              [width]="140"
              [options]="statusOptions"
              [value]="filters().status"
              (valueChange)="set('status', $event)"
            />
            <app-filter-select
              label="Side"
              [width]="110"
              [options]="sideOptions"
              [value]="filters().side"
              (valueChange)="set('side', $event)"
            />
            <app-filter-select
              label="Asset"
              [width]="120"
              [options]="symbolOptions()"
              [value]="filters().symbol"
              (valueChange)="set('symbol', $event)"
            />
            <app-filter-select
              label="Customer"
              [width]="170"
              [options]="userOptions()"
              [value]="filters().user"
              (valueChange)="set('user', $event)"
            />
            <app-filter-select
              label="Fill"
              [width]="130"
              [options]="fillOptions"
              [value]="filters().fill"
              (valueChange)="set('fill', $event)"
            />
            @if (filtered()) {
              <button type="button" class="ghost-button is-plain" (click)="filters.set(empty)">
                <ng-icon name="lucideX" size="16" />Clear filters
              </button>
            }
            <span class="text-muted-foreground ml-auto self-center text-xs tabular-nums">
              {{ visible().length }} of {{ orders().length }} orders
            </span>
          </div>
          @if (visible().length) {
            <app-order-table [orders]="visible()" [(sort)]="sort" (opened)="open.set($event.orderId)" />
          } @else {
            <p class="text-muted-foreground px-2 py-6 text-center text-sm">
              {{ orders().length ? 'No orders match these filters.' : 'No orders have been placed yet.' }}
            </p>
          }
        }
      }
    </section>

    @if (open(); as orderId) {
      <app-order-detail [orderId]="orderId" (closed)="open.set(null)" />
    }
  `,
})
export class OrdersComponent {
  private readonly _api = inject(ReportingApiService);

  protected readonly list = live(() => this._api.orders(), ORDERS_REFRESH_MS);
  protected readonly orders = computed(() => this.list.data()?.orders ?? []);

  protected readonly empty = NO_FILTERS;
  protected readonly filters = signal<Filters>(NO_FILTERS);
  protected readonly sort = signal<SortState<OrderSortKey>>({ key: 'time', direction: 'desc' });
  // The order whose detail is open.
  protected readonly open = signal<number | null>(null);

  protected readonly statusOptions: (string | SelectOption)[] = [
    { value: ALL, label: 'All statuses' },
    'FILLED',
    'PENDING',
    'ACCEPTED',
    'REJECTED',
  ];
  protected readonly sideOptions: SelectOption[] = [
    { value: ALL, label: 'Buy & sell' },
    { value: 'BUY', label: 'Buy' },
    { value: 'SELL', label: 'Sell' },
  ];
  protected readonly fillOptions: SelectOption[] = [
    { value: ALL, label: 'Any' },
    { value: 'priced', label: 'Has fill price' },
    { value: 'unfilled', label: 'No fill yet' },
  ];
  protected readonly symbolOptions = computed<(string | SelectOption)[]>(() => [
    { value: ALL, label: 'All assets' },
    ...distinct(this.orders(), (order) => order.symbol),
  ]);
  protected readonly userOptions = computed<(string | SelectOption)[]>(() => [
    { value: ALL, label: 'All customers' },
    ...distinct(this.orders(), (order) => order.userName),
  ]);

  protected readonly subtitle = computed(() => {
    const session = this.list.data()?.sessionId;
    return session ? `All accounts · simulation session #${session}` : 'All accounts';
  });

  protected readonly filtered = computed(() => this.filters() !== NO_FILTERS);

  protected readonly visible = computed(() => {
    const { query, status, side, symbol, user, fill } = this.filters();
    const needle = query.trim().toLowerCase();
    return this.orders().filter(
      (order) =>
        (status === ALL || order.status === status) &&
        (side === ALL || order.side === side) &&
        (symbol === ALL || order.symbol === symbol) &&
        (user === ALL || order.userName === user) &&
        (fill === ALL || (fill === 'priced') === (order.price !== null)) &&
        (!needle ||
          `${order.userName} ${order.symbol} ${order.orderId} ${order.clientReference}`
            .toLowerCase()
            .includes(needle)),
    );
  });

  protected set(key: keyof Filters, value: string): void {
    const next = { ...this.filters(), [key]: value };
    // Back at the defaults means no filter is on, however it got there.
    const cleared = (Object.keys(NO_FILTERS) as (keyof Filters)[]).every(
      (name) => next[name] === NO_FILTERS[name],
    );
    this.filters.set(cleared ? NO_FILTERS : next);
  }

  // The rows on screen, in the order they are shown.
  protected exportCsv(): void {
    downloadCsv(
      'orders',
      ['Order', 'Time', 'Customer', 'Account', 'Asset', 'Side', 'Qty', 'Type', 'Fill price', 'Status', 'Client reference'],
      sortRows(this.visible(), this.sort(), orderSortValue).map((order) => [
        order.orderId,
        order.submittedAt,
        order.userName,
        order.accountName,
        order.symbol,
        order.side,
        order.quantity,
        order.type,
        order.price ?? '',
        order.status,
        order.clientReference,
      ]),
    );
  }
}
