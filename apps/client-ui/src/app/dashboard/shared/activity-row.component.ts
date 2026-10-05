import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

// What a row is tagged with: an order's status, or the direction of a cash transfer.
export type ActivityTag = 'FILLED' | 'REJECTED' | 'PENDING' | 'DEPOSIT' | 'WITHDRAWAL';

export interface ActivityItem {
  kind: 'cash' | 'trade';
  key: string;
  date: string;
  value: number;
  label: string;
  detail: string;
  tag: ActivityTag;
  // Money in (a sell or a deposit) is green, money out (a buy or a withdrawal) is red.
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

@Component({
  selector: 'li[app-activity-row]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, DatePipe],
  host: {
    class:
      'border-border/60 flex items-center justify-between gap-3 border-b py-2.5 text-sm last:border-b-0',
    '[attr.data-kind]': 'transaction().kind',
    '[attr.data-tag]': 'transaction().tag',
  },
  template: ` <span class="min-w-0">
      <span class="font-medium">{{ transaction().label }}</span>
      <span
        class="ml-2 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase"
        data-testid="activity-tag"
        [class]="tagClass()"
      >
        {{ transaction().tag.toLowerCase() }}
      </span>
      <span class="text-muted-foreground block text-xs">
        {{ transaction().date | date: 'MMM d, y, h:mm a' : '' : 'en-US' }}
      </span>
    </span>
    <span class="shrink-0 text-right tabular-nums">
      <span
        class="block"
        data-testid="activity-value"
        [class]="transaction().positive ? 'text-gain' : 'text-loss'"
      >
        {{ transaction().positive ? '+' : '-' }}{{ transaction().value | currency: 'USD' }}
      </span>
      <span class="text-muted-foreground block text-xs">{{ transaction().detail }}</span>
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
  protected readonly tagClass = computed(() => ACTIVITY_TAG_CLASSES[this.transaction().tag]);
}
