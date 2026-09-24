import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { OrderSide } from '../mock-data';

export const TRADING_AVAILABLE = false;

export interface TradeTicketDraft {
  accountId: string;
  symbol: string;
  side: OrderSide;
  quantity: number;
  estimatedValue: number;
  sessionId: number | null;
  marketTimestamp: string;
}

@Component({
  selector: 'app-trade-ticket',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe],
  host: { class: 'block' },
  template: `
    <section
      class="border-primary/20 bg-card rounded-xl border p-3"
      aria-labelledby="trade-ticket-title"
    >
      <header class="border-primary/15 flex items-center justify-between border-b pb-2">
        <h2 id="trade-ticket-title" class="text-sm font-semibold">Executions</h2>
        <span class="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase"
          >Trading coming soon</span
        >
      </header>
      <div
        class="border-primary/15 bg-[#181818] mt-2.5 flex items-center justify-between gap-3 rounded-lg border p-2.5"
      >
        <div class="min-w-0 flex-1">
          <label class="text-muted-foreground text-[11px]" for="future-trade-quantity"
            >Shares <span class="text-[10px]">(&#64; {{ price() | currency: 'USD' }})</span></label
          >
          <div class="mt-0.5 flex items-center gap-1.5">
            <input
              id="future-trade-quantity"
              type="number"
              min="0"
              class="w-16 bg-transparent text-lg font-bold opacity-60 outline-none"
              [value]="quantity()"
              disabled
            />
            <button
              type="button"
              class="border-border bg-muted size-6 rounded border opacity-50"
              disabled
              aria-label="Decrease shares"
            >
              −
            </button>
            <button
              type="button"
              class="border-border bg-muted size-6 rounded border opacity-50"
              disabled
              aria-label="Increase shares"
            >
              +
            </button>
          </div>
        </div>
        <div class="border-primary/15 border-l pl-3 text-right">
          <span
            class="text-muted-foreground block text-[10px] font-semibold tracking-wider uppercase"
            >Est. total</span
          >
          <strong class="text-base tabular-nums">{{
            draft().estimatedValue | currency: 'USD'
          }}</strong>
        </div>
      </div>
      <input
        type="range"
        min="0"
        max="100"
        value="0"
        class="accent-primary mt-2 h-1.5 w-full opacity-40"
        disabled
        aria-label="Order allocation"
      />
      <div class="text-muted-foreground mt-1 flex justify-between text-[10px]">
        <span>0 shares</span><span>Buying power unavailable</span>
      </div>
      <div class="mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          class="bg-primary text-primary-foreground h-9 rounded-lg text-xs font-bold opacity-40"
          disabled
        >
          Buy {{ symbol() }}
        </button>
        <button
          type="button"
          class="border-primary/20 bg-[#181818] h-9 rounded-lg border text-xs font-semibold opacity-40"
          disabled
        >
          Sell {{ symbol() }}
        </button>
      </div>
    </section>
  `,
})
export class TradeTicketComponent {
  readonly symbol = input.required<string>();
  readonly price = input.required<number>();
  readonly accountId = input('');
  readonly sessionId = input<number | null>(null);
  readonly marketTimestamp = input('');
  protected readonly side = signal<OrderSide>('buy');
  protected readonly quantity = signal(0);
  readonly draft = computed<TradeTicketDraft>(() => ({
    accountId: this.accountId(),
    symbol: this.symbol(),
    side: this.side(),
    quantity: this.quantity(),
    estimatedValue: this.quantity() * this.price(),
    sessionId: this.sessionId(),
    marketTimestamp: this.marketTimestamp(),
  }));
}
