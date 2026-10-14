import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { OrderSide } from '../mock-data';
import { DashboardDialogComponent } from '../shared/dashboard-dialog.component';
import { ORDER_REVIEW_DISCLAIMER } from './order-disclaimer';

// Confirmation step every order passes through before it is sent. It restates the order and
// the record-keeping disclaimer; only "Confirm" places the order.
@Component({
  selector: 'app-order-review-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, DashboardDialogComponent],
  host: { style: 'display: contents' },
  template: `
    <app-dashboard-dialog
      dialogTitle="Review order"
      closeLabel="Cancel order review"
      (closed)="cancelled.emit()"
    >
      <p class="text-lg font-semibold tabular-nums" data-testid="order-review-summary">
        {{ side() === 'buy' ? 'Buy' : 'Sell' }} {{ quantity() }} {{ symbol() }}
        <span class="text-muted-foreground text-sm font-normal"
          >at {{ price() | currency: 'USD' }}</span
        >
      </p>
      <dl class="bg-muted/60 mt-3 rounded-xl p-3 text-sm">
        <div class="flex justify-between gap-4 font-semibold">
          <dt>Estimated {{ side() === 'buy' ? 'cost' : 'proceeds' }}</dt>
          <dd class="tabular-nums">{{ quantity() * price() | currency: 'USD' }}</dd>
        </div>
      </dl>

      <div
        role="note"
        aria-label="Order disclaimer"
        class="mt-3 space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/8 p-3 text-xs leading-5"
        data-testid="order-review-disclaimer"
      >
        @for (paragraph of disclaimer; track $index) {
          <p class="text-muted-foreground">{{ paragraph }}</p>
        }
      </div>

      <div class="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          class="border-border hover:bg-muted h-10 cursor-pointer rounded-lg border px-4 text-sm font-medium"
          (click)="cancelled.emit()"
        >
          Cancel
        </button>
        <button
          type="button"
          class="h-10 cursor-pointer rounded-lg px-4 text-sm font-semibold transition-colors"
          [class]="
            side() === 'buy'
              ? 'bg-primary text-primary-foreground hover:bg-primary/85'
              : 'bg-loss hover:bg-loss/85 text-white'
          "
          data-testid="order-review-confirm"
          (click)="confirmed.emit()"
        >
          Confirm {{ side() }}
        </button>
      </div>
    </app-dashboard-dialog>
  `,
})
export class OrderReviewDialogComponent {
  readonly side = input.required<OrderSide>();
  readonly symbol = input.required<string>();
  readonly quantity = input.required<number>();
  readonly price = input.required<number>();

  readonly confirmed = output<void>();
  readonly cancelled = output<void>();

  protected readonly disclaimer = ORDER_REVIEW_DISCLAIMER;
}
