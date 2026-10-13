import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import { OrderRow } from '../reporting/console.models';
import { count, daySeconds, dollars } from '../reporting/format';
import { SortState, sortRows, toggleSort } from '../reporting/report-summary';
import { ChangePillComponent, PillTone, statusTone } from '../shared/change-pill.component';
import { SortHeaderComponent } from '../shared/sort-header.component';
import { LedgerRow, LedgerSortKey, ledgerSortValue } from './ledger-rows';

// Money and shares coming in read as a gain, a sale as the loss color the kit gives it.
const SIDE_TONES: Record<LedgerRow['side'], PillTone> = {
  BUY: 'primary',
  SELL: 'loss',
  DEPOSIT: 'gain',
  WITHDRAWAL: 'muted',
};

// The table's columns. Its loading placeholder takes the same tracks.
export const ORDER_TRACKS = '0.7fr 1fr 1.3fr 0.7fr 0.8fr 0.6fr 0.9fr 0.9fr 0.9fr';
// The width under which the table scrolls sideways.
export const ORDER_TABLE_MIN_WIDTH = 880;

// The orders table of the Orders screen and of a customer's page, with the
// deposits and withdrawals among the orders. An order's row opens the order; a
// transfer has nothing more to show, so its row is not a button. On a
// customer's page the customer column gives way to the account, since every
// row is theirs.
@Component({
  selector: 'app-order-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, ChangePillComponent, SortHeaderComponent],
  host: { class: 'dash-scroll block min-h-0 flex-1 overflow-x-auto' },
  styles: `
    .order-grid {
      display: grid;
      grid-template-columns: ${ORDER_TRACKS};
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
        }
      </div>
      <ul>
        @for (row of sorted(); track row.key) {
          <li>
            @if (row.order; as order) {
              <button
                type="button"
                class="row-button order-grid whitespace-nowrap"
                [attr.aria-label]="'Open order ' + order.orderId"
                (click)="opened.emit(order)"
              >
                <ng-container [ngTemplateOutlet]="cells" [ngTemplateOutletContext]="{ $implicit: row }" />
              </button>
            } @else {
              <div
                class="row-button order-grid cursor-default whitespace-nowrap hover:bg-transparent"
                data-transfer
              >
                <ng-container [ngTemplateOutlet]="cells" [ngTemplateOutletContext]="{ $implicit: row }" />
              </div>
            }
          </li>
        }
      </ul>
    </div>

    <ng-template #cells let-row>
      <span class="text-muted-foreground tabular-nums">{{ row.order ? '#' + row.id : '—' }}</span>
      <span class="truncate tabular-nums">{{ daySeconds(row.at) }}</span>
      <span class="truncate">
        @if (showUser()) {
          {{ row.userName }}
          <span class="text-muted-foreground"> · {{ row.accountName }}</span>
        } @else {
          {{ row.accountName }}
        }
      </span>
      <span class="font-medium">{{ row.symbol }}</span>
      <span>
        <app-change-pill tag [tone]="sideTone(row)">{{ row.side.toLowerCase() }}</app-change-pill>
      </span>
      <span class="text-right tabular-nums">
        {{ row.quantity === null ? '—' : count(row.quantity) }}
      </span>
      <span class="text-right tabular-nums">{{ row.price === null ? '—' : dollars(row.price) }}</span>
      <span class="text-right tabular-nums">{{ row.amount === null ? '—' : dollars(row.amount) }}</span>
      <span class="text-right">
        <app-change-pill tag [tone]="statusTone(row.status)">
          {{ row.status.toLowerCase() }}
        </app-change-pill>
      </span>
    </ng-template>
  `,
})
export class OrderTableComponent {
  readonly rows = input.required<readonly LedgerRow[]>();
  readonly showUser = input(true);
  readonly sort = model<SortState<LedgerSortKey>>({ key: 'time', direction: 'desc' });
  readonly opened = output<OrderRow>();

  protected readonly columns = computed<{ key: LedgerSortKey; label: string; right?: boolean }[]>(
    () => [
      { key: 'id', label: 'Order' },
      { key: 'time', label: 'Time' },
      this.showUser() ? { key: 'user', label: 'Customer' } : { key: 'account', label: 'Account' },
      { key: 'symbol', label: 'Asset' },
      { key: 'side', label: 'Side' },
      { key: 'quantity', label: 'Qty', right: true },
      { key: 'price', label: 'Fill price', right: true },
      { key: 'amount', label: 'Amount', right: true },
      { key: 'status', label: 'Status', right: true },
    ],
  );

  protected readonly sorted = computed(() => sortRows(this.rows(), this.sort(), ledgerSortValue));

  protected readonly count = count;
  protected readonly dollars = dollars;
  protected readonly daySeconds = daySeconds;
  protected readonly statusTone = statusTone;

  protected sideTone(row: LedgerRow): PillTone {
    return SIDE_TONES[row.side];
  }

  protected sortBy(key: LedgerSortKey): void {
    this.sort.update((sort) => toggleSort(sort, key));
  }
}
