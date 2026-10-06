import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

// What a row is tagged with: an order's status, or the direction of a cash transfer.
export type ActivityTag = 'FILLED' | 'REJECTED' | 'PENDING' | 'DEPOSIT' | 'WITHDRAWAL';

// What a row is: the side of a trade or the direction of a cash transfer.
export type ActivityType = 'BUY' | 'SELL' | 'DEPOSIT' | 'WITHDRAWAL';

// Where a row stands. Cash transfers have no lifecycle and always read as completed.
export type ActivityStatus = 'FILLED' | 'REJECTED' | 'PENDING' | 'COMPLETED';

export interface ActivityItem {
  kind: 'cash' | 'trade';
  key: string;
  date: string;
  value: number;
  label: string;
  // Extra text after the date, such as a trade's quantity and price. Empty for cash.
  detail: string;
  type: ActivityType;
  status: ActivityStatus;
  // Money in (a sell or a deposit) versus money out (a buy or a withdrawal). The row only shows
  // it as a +/- sign on cash transfers.
  positive: boolean;
  rejectionReason?: string | null;
}

// Classes for each tag: green filled, red rejected, yellow pending, cyan for cash transfers.
export const ACTIVITY_TAG_CLASSES: Record<ActivityTag, string> = {
  FILLED: 'bg-gain/15 text-gain',
  REJECTED: 'bg-loss/15 text-loss',
  PENDING: 'bg-amber-400/15 text-amber-400',
  DEPOSIT: 'bg-primary/15 text-primary',
  WITHDRAWAL: 'bg-primary/15 text-primary',
};

// Classes for each type label: green buy, red sell, cyan deposit, amber withdrawal.
export const ACTIVITY_TYPE_CLASSES: Record<ActivityType, string> = {
  BUY: 'bg-gain/15 text-gain',
  SELL: 'bg-loss/15 text-loss',
  DEPOSIT: 'bg-primary/15 text-primary',
  WITHDRAWAL: 'bg-amber-400/15 text-amber-400',
};

@Component({
  selector: 'li[app-activity-row]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, DatePipe],
  host: {
    class:
      'border-border/60 flex items-center justify-between gap-3 border-b py-2.5 text-sm last:border-b-0',
    '[attr.data-kind]': 'transaction().kind',
    '[attr.data-type]': 'transaction().type',
    '[attr.data-status]': 'transaction().status',
  },
  template: ` <span class="min-w-0">
      <span class="font-medium">{{ transaction().label }}</span>
      <span
        class="ml-2 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase"
        data-testid="activity-tag"
        [class]="tagClass()"
      >
        {{ transaction().type.toLowerCase() }}
      </span>
      <span class="text-muted-foreground block text-xs">
        {{ transaction().date | date: 'MMM d, y, h:mm a' : '' : 'en-US' }}
        @if (transaction().detail) {
          · {{ transaction().detail }}
        }
      </span>
    </span>
    <span class="shrink-0 text-right tabular-nums">
      <span class="block" data-testid="activity-value">
        {{ sign() }}{{ transaction().value | currency: 'USD' }}
      </span>
      <span class="text-muted-foreground block text-xs" data-testid="activity-status">
        {{ transaction().status.toLowerCase() }}
      </span>
    </span>
    @if (transaction().rejectionReason) {
      <p class="text-loss mt-1 w-full text-xs">{{ transaction().rejectionReason }}</p>
    }`,
  styles: [
    `
      :host {
        flex-wrap: wrap;
      }
      :host > span:first-child {
        flex: 1;
        min-width: 0;
      }
    `,
  ],
})
export class ActivityRowComponent {
  readonly transaction = input.required<ActivityItem>();
  // Only cash transfers carry a sign; a trade's amount is the plain notional value.
  protected readonly sign = computed(() => {
    const item = this.transaction();
    if (item.kind !== 'cash') return '';
    return item.positive ? '+' : '-';
  });
  protected readonly tagClass = computed(() => ACTIVITY_TYPE_CLASSES[this.transaction().type]);
}
