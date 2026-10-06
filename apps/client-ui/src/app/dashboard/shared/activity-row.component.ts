import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
export interface ActivityItem {
  kind: 'cash' | 'trade';
  key: string;
  date: string;
  reason: string;
  value: number;
  label: string;
  detail: string;
  positive: boolean;
  status?: string;
  rejectionReason?: string | null;
}
@Component({
  selector: 'li[app-activity-row]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, DatePipe],
  host: {
    class:
      'border-border/60 flex items-center justify-between gap-3 border-b py-2.5 text-sm last:border-b-0',
    '[attr.data-kind]': 'transaction().kind',
  },
  template: ` <span class="min-w-0">
      <span class="font-medium">{{ transaction().label }}</span>
      <span
        class="ml-2 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase"
        [class]="transaction().positive ? 'bg-gain/15 text-gain' : 'bg-loss/15 text-loss'"
      >
        {{
          transaction().reason === 'DEPOSIT'
            ? 'deposit'
            : transaction().reason === 'WITHDRAWAL'
              ? 'withdrawal'
              : transaction().reason
        }}
      </span>
      <span class="text-muted-foreground block text-xs">
        {{ transaction().date | date: 'MMM d, y, h:mm a' : '' : 'en-US' }}
      </span>
    </span>
    <span class="shrink-0 text-right tabular-nums">
      <span class="block">
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
}
