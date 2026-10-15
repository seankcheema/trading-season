import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideSearch, lucideX } from '@ng-icons/lucide';
import { OrderRow, TransferRow } from '../reporting/console.models';
import { SortState, sortRows } from '../reporting/report-summary';
import { FilterSelectComponent, SelectOption } from '../shared/filter-select.component';
import { LedgerRow, LedgerSortKey, TRANSFER_STATUS, ledgerRows, ledgerSortValue } from './ledger-rows';
import { OrderTableComponent } from './order-table.component';

const ALL = 'ALL';
const NO_FILTERS = { query: '', status: ALL, side: ALL, symbol: ALL, owner: ALL, fill: ALL };

// Whether a filter lets a value through: it is off, or it names that value.
function picked(choice: string, value: string | null): boolean {
  return choice === ALL || choice === value;
}
type Filters = typeof NO_FILTERS;

function distinct(rows: readonly LedgerRow[], pick: (row: LedgerRow) => string): string[] {
  return [...new Set(rows.map(pick))].sort((a, b) => a.localeCompare(b));
}

// Orders and cash transfers with the search, the filters and the table: the
// whole of the Orders screen's card, and the orders card of a customer's page.
// There every row is the customer's, so the rows are told apart by account.
@Component({
  selector: 'app-order-browser',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon, FilterSelectComponent, OrderTableComponent],
  providers: [provideIcons({ lucideSearch, lucideX })],
  host: { class: 'flex min-h-0 flex-1 flex-col' },
  template: `
    @if (rows().length) {
      <div class="mb-4 flex flex-wrap items-end gap-2">
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
              [placeholder]="owner() + ', symbol, order # or ref'"
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
          [width]="130"
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
          [label]="owner()"
          [width]="170"
          [options]="ownerOptions()"
          [value]="filters().owner"
          (valueChange)="set('owner', $event)"
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
        <span class="text-muted-foreground ml-auto self-center text-xs tabular-nums" data-count>
          {{ visible().length }} of {{ rows().length }} rows
        </span>
      </div>
      @if (visible().length) {
        <app-order-table
          [rows]="visible()"
          [showUser]="showUser()"
          [(sort)]="sort"
          (opened)="opened.emit($event)"
        />
      } @else {
        <p class="text-muted-foreground px-2 py-6 text-center text-sm">
          No orders or transfers match these filters.
        </p>
      }
    } @else {
      <p class="text-muted-foreground px-2 py-6 text-center text-sm">{{ emptyMessage() }}</p>
    }
  `,
})
export class OrderBrowserComponent {
  readonly orders = input.required<readonly OrderRow[]>();
  readonly transfers = input<readonly TransferRow[]>([]);
  // False on a customer's page, where the account takes the customer's place.
  readonly showUser = input(true);
  // What to say when there is neither an order nor a transfer.
  readonly emptyMessage = input('No orders have been placed yet.');
  readonly opened = output<OrderRow>();

  protected readonly empty = NO_FILTERS;
  protected readonly filters = signal<Filters>(NO_FILTERS);
  protected readonly sort = signal<SortState<LedgerSortKey>>({ key: 'time', direction: 'desc' });

  protected readonly rows = computed(() => ledgerRows(this.orders(), this.transfers()));

  // Who the rows are told apart by: the customer, or on a customer's page the account.
  protected readonly owner = computed(() => (this.showUser() ? 'Customer' : 'Account'));
  private readonly _ownerOf = computed(() =>
    this.showUser() ? (row: LedgerRow) => row.userName : (row: LedgerRow) => row.accountName,
  );

  protected readonly statusOptions: (string | SelectOption)[] = [
    { value: ALL, label: 'All statuses' },
    'FILLED',
    'PENDING',
    'ACCEPTED',
    'CANCELLED',
    'REJECTED',
    TRANSFER_STATUS,
  ];
  protected readonly sideOptions: SelectOption[] = [
    { value: ALL, label: 'All sides' },
    { value: 'BUY', label: 'Buy' },
    { value: 'SELL', label: 'Sell' },
    { value: 'DEPOSIT', label: 'Deposit' },
    { value: 'WITHDRAWAL', label: 'Withdrawal' },
  ];
  // Only an order can fill, so either choice leaves the transfers out.
  protected readonly fillOptions: SelectOption[] = [
    { value: ALL, label: 'Any' },
    { value: 'priced', label: 'Has fill price' },
    { value: 'unfilled', label: 'No fill yet' },
  ];
  protected readonly symbolOptions = computed<(string | SelectOption)[]>(() => [
    { value: ALL, label: 'All assets' },
    ...distinct(this.rows(), (row) => row.symbol),
  ]);
  protected readonly ownerOptions = computed<(string | SelectOption)[]>(() => [
    { value: ALL, label: this.showUser() ? 'All customers' : 'All accounts' },
    ...distinct(this.rows(), this._ownerOf()),
  ]);

  protected readonly filtered = computed(() => this.filters() !== NO_FILTERS);

  protected readonly visible = computed(() => {
    const { query, status, side, symbol, owner, fill } = this.filters();
    const needle = query.trim().toLowerCase();
    const ownerOf = this._ownerOf();
    const chosen = (row: LedgerRow) =>
      picked(status, row.status) &&
      picked(side, row.side) &&
      picked(symbol, row.symbol) &&
      picked(owner, ownerOf(row));
    const priced = (row: LedgerRow) =>
      fill === ALL || (row.order !== null && (fill === 'priced') === (row.price !== null));
    const named = (row: LedgerRow) =>
      !needle ||
      `${row.userName} ${row.accountName} ${row.symbol} ${row.side} ${row.order ? row.id : ''} ${row.reference}`
        .toLowerCase()
        .includes(needle);
    return this.rows().filter((row) => chosen(row) && priced(row) && named(row));
  });

  // The rows on screen, in the order they are shown, for an export.
  shown(): LedgerRow[] {
    return sortRows(this.visible(), this.sort(), ledgerSortValue);
  }

  protected set(key: keyof Filters, value: string): void {
    const next = { ...this.filters(), [key]: value };
    // Back at the defaults means no filter is on, however it got there.
    const cleared = (Object.keys(NO_FILTERS) as (keyof Filters)[]).every(
      (name) => next[name] === NO_FILTERS[name],
    );
    this.filters.set(cleared ? NO_FILTERS : next);
  }
}
