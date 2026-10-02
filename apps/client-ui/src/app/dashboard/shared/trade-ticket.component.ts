import { affordableShares, boundedShares, wholeShares } from './share-limits';
import { CurrencyPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  effect,
  linkedSignal,
  signal,
} from '@angular/core';
import { OrderSide } from '../mock-data';

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
      class="border-border bg-card flex h-full min-h-0 flex-col rounded-xl border p-3"
      aria-label="Order execution"
    >
      <div
        role="group"
        aria-label="Order side"
        class="bg-muted grid grid-cols-2 gap-1 rounded-xl p-1"
      >
        <button
          type="button"
          class="h-9 cursor-pointer rounded-lg text-sm font-medium transition-colors"
          [class]="
            side() === 'buy'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          "
          [attr.aria-pressed]="side() === 'buy'"
          (click)="selectSide('buy')"
        >
          Buy
        </button>
        <button
          type="button"
          class="h-9 cursor-pointer rounded-lg text-sm font-medium transition-colors"
          [class]="
            side() === 'sell' ? 'bg-loss text-white' : 'text-muted-foreground hover:text-foreground'
          "
          [attr.aria-pressed]="side() === 'sell'"
          (click)="selectSide('sell')"
        >
          Sell
        </button>
      </div>

      <div class="border-border mt-2.5 rounded-xl border p-3">
        <div class="flex items-center justify-between gap-4">
          <label
            for="future-trade-quantity"
            class="text-muted-foreground text-xs font-medium tracking-wide uppercase"
            >Shares</label
          >
          <span class="text-muted-foreground text-xs tabular-nums">Max {{ maxShares() }}</span>
        </div>
        <input
          id="future-trade-quantity"
          step="1"
          [disabled]="maxShares() === 0 || busy() || !ready()"
          type="number"
          min="0"
          [max]="maxShares()"
          class="mt-1 w-full bg-transparent text-3xl font-semibold tracking-tight tabular-nums outline-none"
          [value]="quantity()"
          (input)="onQuantityInput($event)"
        />
        <input
          [disabled]="busy() || !ready()"
          type="range"
          min="0"
          [max]="maxShares()"
          [value]="quantity()"
          class="accent-primary mt-2 w-full"
          aria-label="Shares"
          (input)="onQuantityInput($event)"
        />
      </div>

      <dl class="bg-muted/60 mt-2.5 space-y-1.5 rounded-xl p-3 text-xs">
        <div class="flex justify-between gap-4">
          <dt class="text-muted-foreground">Market price</dt>
          <dd class="tabular-nums">{{ price() | currency: 'USD' }}</dd>
        </div>
        <div class="flex justify-between gap-4">
          <dt class="text-muted-foreground">Shares</dt>
          <dd class="tabular-nums">{{ quantity() }}</dd>
        </div>
        <div class="flex justify-between gap-4">
          <dt class="text-muted-foreground">Cash before</dt>
          <dd class="tabular-nums">{{ cashBalance() | currency: 'USD' }}</dd>
        </div>
        <div class="flex justify-between gap-4">
          <dt class="text-muted-foreground">Cash after</dt>
          <dd class="tabular-nums">{{ cashAfter() | currency: 'USD' }}</dd>
        </div>
        <div class="border-border flex justify-between gap-4 border-t pt-2 font-semibold">
          <dt>Estimated {{ side() === 'buy' ? 'cost' : 'proceeds' }}</dt>
          <dd class="tabular-nums">{{ draft().estimatedValue | currency: 'USD' }}</dd>
        </div>
      </dl>

      <div class="min-h-2 flex-1"></div>
      <button
        type="button"
        class="h-11 w-full cursor-pointer rounded-xl text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        [class]="
          side() === 'buy'
            ? 'bg-primary text-primary-foreground hover:bg-primary/85'
            : 'bg-loss hover:bg-loss/85 text-white'
        "
        [disabled]="quantity() === 0 || busy() || !ready()"
        (click)="submitOrder()"
      >
        {{
          busy()
            ? 'Submitting…'
            : (side() === 'buy' ? 'Buy' : 'Sell') + ' ' + quantity() + ' ' + symbol()
        }}
      </button>

      @if (message()) {
        <p class="mt-1.5 text-center text-xs" role="status">{{ message() }}</p>
      }

      @if (error()) {
        <p class="text-loss mt-1.5 text-center text-xs" role="alert">{{ error() }}</p>
      }

      @if (refreshFailed()) {
        <button
          type="button"
          class="text-primary mt-1 text-xs"
          (click)="refresh.emit()"
          [disabled]="busy()"
        >
          Retry balance refresh
        </button>
      }
    </section>
  `,
})
export class TradeTicketComponent {
  readonly symbol = input.required<string>();
  readonly price = input.required<number>();
  readonly accountId = input('');
  readonly sessionId = input<number | null>(null);
  readonly marketTimestamp = input('');
  readonly cashBalance = input(0);

  readonly heldShares = input(0);
  readonly ready = input(false);

  readonly busy = input(false);
  readonly message = input('');

  readonly error = input('');
  readonly refreshFailed = input(false);

  readonly submitted = output<TradeTicketDraft>();
  readonly refresh = output<void>();

  protected readonly side = signal<OrderSide>('buy');
  protected readonly quantity = linkedSignal<number, number>({
    source: () => this.maxShares(),
    computation: (maximum, previous) => boundedShares(previous?.value ?? 0, maximum),
  });

  private readonly resetQuantity = effect(() => {
    this.accountId();
    this.symbol();
    this.quantity.set(0);
  });

  protected readonly maxShares = computed(() =>
    this.side() === 'buy'
      ? affordableShares(this.cashBalance(), this.price())
      : wholeShares(this.heldShares()),
  );
  protected readonly cashAfter = computed(() =>
    this.side() === 'buy'
      ? this.cashBalance() - this.quantity() * this.price()
      : this.cashBalance() + this.quantity() * this.price(),
  );
  readonly draft = computed<TradeTicketDraft>(() => ({
    accountId: this.accountId(),
    symbol: this.symbol(),
    side: this.side(),
    quantity: this.quantity(),
    estimatedValue: this.quantity() * this.price(),
    sessionId: this.sessionId(),
    marketTimestamp: this.marketTimestamp(),
  }));

  protected selectSide(side: OrderSide): void {
    this.side.set(side);
    this.quantity.set(Math.min(this.quantity(), this.maxShares()));
  }

  protected onQuantityInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const quantity = boundedShares(Number(input.value), this.maxShares());
    this.quantity.set(quantity);
    input.value = String(quantity);
  }

  protected submitOrder(): void {
    if (!this.ready() || this.busy() || !this.quantity() || this.quantity() > this.maxShares())
      return;

    this.submitted.emit(this.draft());
  }
}
