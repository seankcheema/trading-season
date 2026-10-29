import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCircleAlert, lucideSearch, lucideX } from '@ng-icons/lucide';
import { Customer } from '../reporting/console.models';
import { count, dollars, recent } from '../reporting/format';
import { SortState, sortRows, toggleSort } from '../reporting/report-summary';
import { ReportingApiService } from '../reporting/reporting-api.service';
import { ChangePillComponent, statusTone } from '../shared/change-pill.component';
import { ExportMenuComponent, downloadCsv } from '../shared/export-menu.component';
import { FilterSelectComponent, SelectOption } from '../shared/filter-select.component';
import { live } from '../shared/live';
import { PageHeaderComponent } from '../shared/page-header.component';
import { SkeletonTableComponent } from '../shared/skeleton.component';
import { SortHeaderComponent } from '../shared/sort-header.component';

// How often the customer list is read again.
export const CUSTOMERS_REFRESH_MS = 30_000;
// From this many failed sign-ins the count is shown as a warning.
export const FAILED_SIGN_IN_WARNING = 3;

// The table's columns. Its loading placeholder takes the same tracks.
const CUSTOMER_TRACKS = '1.6fr 0.8fr 0.6fr 1fr 1fr 0.8fr 0.8fr';

type CustomerSortKey = 'name' | 'status' | 'accounts' | 'cash' | 'portfolio' | 'failed' | 'last';

const ALL = 'ALL';
const NO_FILTERS = { query: '', status: ALL, level: ALL, flag: ALL };

// Whether a filter lets a value through: it is off, or it names that value.
function picked(choice: string, value: string | null): boolean {
  return choice === ALL || choice === value;
}
type Filters = typeof NO_FILTERS;

// "Sean Cheema" is SC; a trader known only by their email takes its first two letters.
export function initials(name: string): string {
  const parts = name.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

// "BEGINNER" as the product writes it elsewhere: "Beginner".
export function titleCase(value: string | null): string {
  return value ? value[0] + value.slice(1).toLowerCase() : '—';
}

function sortValue(customer: Customer, key: CustomerSortKey): string | number {
  switch (key) {
    case 'failed':
      return customer.failedAttempts;
    case 'last':
      return customer.lastActiveAt ? new Date(customer.lastActiveAt).getTime() : 0;
    default:
      return customer[key];
  }
}

// Every trader on the platform: who they are, whether they are locked out, and
// what they hold. Analysts and admins are not customers, so the service leaves
// them out. A row opens the customer.
@Component({
  selector: 'app-customers',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    NgIcon,
    PageHeaderComponent,
    ExportMenuComponent,
    FilterSelectComponent,
    SortHeaderComponent,
    ChangePillComponent,
    SkeletonTableComponent,
  ],
  providers: [provideIcons({ lucideCircleAlert, lucideSearch, lucideX })],
  host: { class: 'flex min-h-[32rem] flex-1 basis-0 flex-col gap-3' },
  styles: `
    .customer-grid {
      display: grid;
      grid-template-columns: ${CUSTOMER_TRACKS};
      align-items: center;
      gap: 0.5rem;
    }
  `,
  template: `
    <app-page-header
      title="Customers"
      subtitle="Look up a trader to review activity and resolve support requests"
    >
      <app-export-menu (exportCsv)="exportCsv()" />
    </app-page-header>

    <section
      class="dash-card flex min-h-0 flex-1 flex-col p-5"
      [attr.aria-busy]="list.state() === 'loading' ? 'true' : null"
    >
      @switch (list.state()) {
        @case ('loading') {
          <p class="sr-only" role="status">Loading customers…</p>
          <app-skeleton-table [tracks]="tracks" [minWidth]="760" [filters]="3" tall />
        }
        @case ('error') {
          <div class="flex flex-col items-center gap-3 py-14 text-center" role="alert">
            <ng-icon name="lucideCircleAlert" size="24" class="text-loss" />
            <p class="text-sm">We couldn't load the customers.</p>
            <button type="button" class="ghost-button" (click)="list.reload()">Try again</button>
          </div>
        }
        @case ('ready') {
          <div class="mb-4 flex flex-wrap items-end gap-2">
            <label class="flex max-w-[320px] flex-[1_1_240px] flex-col gap-1">
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
                  placeholder="Name, email or user ID"
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
              label="Trader level"
              [width]="150"
              [options]="levelOptions"
              [value]="filters().level"
              (valueChange)="set('level', $event)"
            />
            <app-filter-select
              label="Flags"
              [width]="170"
              [options]="flagOptions"
              [value]="filters().flag"
              (valueChange)="set('flag', $event)"
            />
            @if (filtered()) {
              <button type="button" class="ghost-button is-plain" (click)="filters.set(empty)">
                <ng-icon name="lucideX" size="16" />Clear filters
              </button>
            }
            <span class="text-muted-foreground ml-auto self-center text-xs tabular-nums">
              {{ visible().length }} of {{ customers().length }} customers
            </span>
          </div>

          <div class="dash-scroll min-h-0 flex-1 overflow-x-auto">
            <div class="min-w-[760px]">
              <div class="dash-table-head customer-grid bg-card sticky top-0 z-[1] px-2">
                @for (column of columns; track column.key) {
                  <button
                    app-sort-header
                    [label]="column.label"
                    [align]="column.right ? 'right' : 'left'"
                    [active]="sort().key === column.key"
                    [direction]="sort().direction"
                    (toggled)="sortBy(column.key)"
                  ></button>
                }
              </div>
              @if (!visible().length) {
                <p class="text-muted-foreground px-2 py-6 text-center text-sm">
                  No customers match these filters.
                </p>
              }
              <ul>
                @for (customer of visible(); track customer.userId) {
                  <li>
                    <a
                      class="row-button customer-grid"
                      [routerLink]="['/customers', customer.userId]"
                    >
                      <span class="flex min-w-0 items-center gap-2.5">
                        <span
                          class="bg-primary/15 text-primary flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                          aria-hidden="true"
                        >
                          {{ initials(customer.name) }}
                        </span>
                        <span class="min-w-0">
                          <span class="block truncate font-medium">{{ customer.name }}</span>
                          <span class="text-muted-foreground block truncate text-xs">
                            {{ customer.email }}
                          </span>
                        </span>
                      </span>
                      <span>
                        <app-change-pill tag [tone]="statusTone(customer.status)">
                          {{ customer.status.toLowerCase() }}
                        </app-change-pill>
                      </span>
                      <span class="text-right tabular-nums">{{ count(customer.accounts) }}</span>
                      <span class="text-right tabular-nums">{{ dollars(customer.cash) }}</span>
                      <span class="text-right tabular-nums">{{ dollars(customer.portfolio) }}</span>
                      <span
                        class="text-right tabular-nums"
                        [class.text-loss]="customer.failedAttempts >= warning"
                      >
                        {{ customer.failedAttempts }}
                      </span>
                      <span class="text-muted-foreground text-right tabular-nums">
                        {{ recent(customer.lastActiveAt) }}
                      </span>
                    </a>
                  </li>
                }
              </ul>
            </div>
          </div>
        }
      }
    </section>
  `,
})
export class CustomersComponent {
  private readonly _api = inject(ReportingApiService);

  protected readonly list = live(() => this._api.customers(), CUSTOMERS_REFRESH_MS);
  protected readonly customers = computed(() => this.list.data()?.customers ?? []);

  protected readonly tracks = CUSTOMER_TRACKS;
  protected readonly empty = NO_FILTERS;
  protected readonly warning = FAILED_SIGN_IN_WARNING;
  protected readonly filters = signal<Filters>(NO_FILTERS);
  protected readonly sort = signal<SortState<CustomerSortKey>>({ key: 'last', direction: 'desc' });

  protected readonly columns: { key: CustomerSortKey; label: string; right?: boolean }[] = [
    { key: 'name', label: 'Customer' },
    { key: 'status', label: 'Status' },
    { key: 'accounts', label: 'Accounts', right: true },
    { key: 'cash', label: 'Cash', right: true },
    { key: 'portfolio', label: 'Portfolio', right: true },
    { key: 'failed', label: 'Failed sign-ins', right: true },
    { key: 'last', label: 'Last active', right: true },
  ];

  protected readonly statusOptions: (string | SelectOption)[] = [
    { value: ALL, label: 'All statuses' },
    'ACTIVE',
    'LOCKED',
  ];
  protected readonly levelOptions: SelectOption[] = [
    { value: ALL, label: 'All levels' },
    { value: 'BEGINNER', label: 'Beginner' },
    { value: 'INTERMEDIATE', label: 'Intermediate' },
    { value: 'ADVANCED', label: 'Advanced' },
  ];
  protected readonly flagOptions: SelectOption[] = [
    { value: ALL, label: 'No flag filter' },
    { value: 'failed', label: 'Failed sign-ins' },
    { value: 'nocash', label: 'No cash' },
    { value: 'noaccounts', label: 'No accounts' },
  ];

  protected readonly filtered = computed(() => this.filters() !== NO_FILTERS);

  protected readonly visible = computed(() => {
    const { query, status, level, flag } = this.filters();
    const needle = query.trim().toLowerCase();
    const flagged: Record<string, (customer: Customer) => boolean> = {
      [ALL]: () => true,
      failed: (customer) => customer.failedAttempts > 0,
      nocash: (customer) => customer.cash === 0,
      noaccounts: (customer) => customer.accounts === 0,
    };
    const named = (customer: Customer) =>
      !needle ||
      `${customer.name} ${customer.email} ${customer.userId}`.toLowerCase().includes(needle);
    const matches = this.customers().filter(
      (customer) =>
        picked(status, customer.status) &&
        picked(level, customer.traderLevel) &&
        flagged[flag](customer) &&
        named(customer),
    );
    return sortRows(matches, this.sort(), sortValue);
  });

  protected readonly count = count;
  protected readonly dollars = dollars;
  protected readonly recent = recent;
  protected readonly initials = initials;
  protected readonly statusTone = statusTone;

  protected set(key: keyof Filters, value: string): void {
    const next = { ...this.filters(), [key]: value };
    // Back at the defaults means no filter is on, however it got there.
    const cleared = (Object.keys(NO_FILTERS) as (keyof Filters)[]).every(
      (name) => next[name] === NO_FILTERS[name],
    );
    this.filters.set(cleared ? NO_FILTERS : next);
  }

  protected sortBy(key: CustomerSortKey): void {
    this.sort.update((sort) => toggleSort(sort, key));
  }

  // The rows on screen, in the order they are shown.
  protected exportCsv(): void {
    downloadCsv(
      'customers',
      ['User ID', 'Name', 'Email', 'Status', 'Trader level', 'Accounts', 'Cash', 'Portfolio', 'Failed sign-ins', 'Last active'],
      this.visible().map((customer) => [
        customer.userId,
        customer.name,
        customer.email,
        customer.status,
        customer.traderLevel,
        customer.accounts,
        customer.cash,
        customer.portfolio,
        customer.failedAttempts,
        customer.lastActiveAt,
      ]),
    );
  }
}
