import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import { OrderRow } from '../reporting/console.models';
import { count, daySeconds, dollars } from '../reporting/format';
import { SortState, sortRows, toggleSort } from '../reporting/report-summary';
import { ChangePillComponent, statusTone } from '../shared/change-pill.component';
import { SortHeaderComponent } from '../shared/sort-header.component';

export type OrderSortKey =
  | 'id'
  | 'time'
  | 'user'
  | 'account'
  | 'symbol'
  | 'side'
  | 'quantity'
  | 'price'
  | 'status';

// Order ids rise with time, so the two columns sort the same way.
export function orderSortValue(order: OrderRow, key: OrderSortKey): string | number {
  switch (key) {
    case 'id':
    case 'time':
      return order.orderId;
    case 'user':
      return order.userName;
    case 'account':
      return order.accountName;
    case 'price':
      return order.price ?? 0;
    default:
      return order[key];
  }
}

// The orders table of the Orders screen and of a customer's page. Every row
// opens the order. On a customer's page the customer column gives way to the
// account, since every row is theirs.
@Component({
  selector: 'app-order-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChangePillComponent, SortHeaderComponent],
  host: { class: 'dash-scroll block min-h-0 flex-1 overflow-x-auto' },
  styles: `
    .order-grid {
      display: grid;
      grid-template-columns: 0.7fr 1fr 1.3fr 0.9fr 0.7fr 0.6fr 0.5fr 0.9fr 0.9fr;
      align-items: center;
      gap: 0.5rem;
    }
  `,
  template: `
    <div class="min-w-[880px]">
      <div class="dash-table-head order-grid bg-card sticky top-0 z-[1] px-2">
        @for (column of columns(); track column.key) {
          <button
            app-sort-header
            [label]="column.label"
            [align]="column.right ? 'right' : 'left'"
            [active]="sort().key === column.key"
            [direction]="sort().direction"
            (toggled)="sortBy(column.key)"
          ></button>
          @if (column.key === 'quantity') {
            <span>Type</span>
          }
        }
      </div>
      <ul>
        @for (order of sorted(); track order.orderId) {
          <li>
            <button
              type="button"
              class="row-button order-grid whitespace-nowrap"
              [attr.aria-label]="'Open order ' + order.orderId"
              (click)="opened.emit(order)"
            >
              <span class="text-muted-foreground tabular-nums">#{{ order.orderId }}</span>
              <span class="truncate tabular-nums">{{ daySeconds(order.submittedAt) }}</span>
              <span class="truncate">
                @if (showUser()) {
                  {{ order.userName }}
                  <span class="text-muted-foreground"> · {{ order.accountName }}</span>
                } @else {
                  {{ order.accountName }}
                }
              </span>
              <span class="font-medium">{{ order.symbol }}</span>
              <span>
                <app-change-pill tag [tone]="order.side === 'BUY' ? 'primary' : 'loss'">
                  {{ order.side.toLowerCase() }}
                </app-change-pill>
              </span>
              <span class="text-right tabular-nums">{{ count(order.quantity) }}</span>
              <span class="text-muted-foreground text-xs">{{ order.type }}</span>
              <span class="text-right tabular-nums">
                {{ order.price === null ? '—' : dollars(order.price) }}
              </span>
              <span class="text-right">
                <app-change-pill tag [tone]="statusTone(order.status)">
                  {{ order.status.toLowerCase() }}
                </app-change-pill>
              </span>
            </button>
          </li>
        }
      </ul>
    </div>
  `,
})
export class OrderTableComponent {
  readonly orders = input.required<readonly OrderRow[]>();
  readonly showUser = input(true);
  readonly sort = model<SortState<OrderSortKey>>({ key: 'time', direction: 'desc' });
  readonly opened = output<OrderRow>();

  protected readonly columns = computed<{ key: OrderSortKey; label: string; right?: boolean }[]>(
    () => [
      { key: 'id', label: 'Order' },
      { key: 'time', label: 'Time' },
      this.showUser() ? { key: 'user', label: 'Customer' } : { key: 'account', label: 'Account' },
      { key: 'symbol', label: 'Asset' },
      { key: 'side', label: 'Side' },
      { key: 'quantity', label: 'Qty', right: true },
      { key: 'price', label: 'Fill price', right: true },
      { key: 'status', label: 'Status', right: true },
    ],
  );

  protected readonly sorted = computed(() => sortRows(this.orders(), this.sort(), orderSortValue));

  protected readonly count = count;
  protected readonly dollars = dollars;
  protected readonly daySeconds = daySeconds;
  protected readonly statusTone = statusTone;

  protected sortBy(key: OrderSortKey): void {
    this.sort.update((sort) => toggleSort(sort, key));
  }
}
