import { WatchlistStarComponent } from '../watchlist/watchlist-star.component';
import { ToastService } from '../../notifications/toast.service';
import { affordableShares, boundedShares, wholeShares } from '../shared/share-limits';
import { CurrencyPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  untracked,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideExpand, lucideX } from '@ng-icons/lucide';
import { RouterLink } from '@angular/router';
import { Instrument, OrderSide, PricePoint, Timeframe, findInstrument } from '../mock-data';
import { MarketDataService } from '../market-data.service';
import { toOrderErrorMessage } from '../orders/order-error';
import { OrderResult } from '../orders/order.models';
import { OrderService } from '../orders/order.service';
import { InstrumentSearchComponent } from '../shared/instrument-search.component';
import { PriceChartComponent } from '../shared/price-chart.component';
import { SignedPercentPipe } from '../shared/signed-percent.pipe';
import { TimeframeToggleComponent } from '../shared/timeframe-toggle.component';

const ORDER_NEEDS_ACCOUNT = 'Select an account before placing an order.';
const ORDER_REJECTED = 'The order was rejected.';

@Component({
  selector: 'app-order-submission',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    WatchlistStarComponent,
    CurrencyPipe,
    NgIcon,
    RouterLink,
    InstrumentSearchComponent,
    PriceChartComponent,
    SignedPercentPipe,
    TimeframeToggleComponent,
  ],
  providers: [provideIcons({ lucideExpand, lucideX })],
  host: { '(document:keydown.escape)': 'closed.emit()' },
  templateUrl: './order-submission.component.html',
  styleUrl: './order-submission.component.css',
})
export class OrderSubmissionComponent {
  private readonly marketData = inject(MarketDataService);
  private readonly orders = inject(OrderService);
  private readonly toasts = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private cooldownTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    this.destroyRef.onDestroy(() => clearTimeout(this.cooldownTimer));
  }

  readonly instrument = input.required<Instrument>();
  readonly instruments = input<readonly Instrument[]>([]);
  readonly sessionId = input<number | null>(null);
  readonly marketTimestamp = input('');
  readonly accountId = input.required<string>();
  readonly cashBalance = input.required<number>();
  // Shares currently held, keyed by symbol. Caps how much can be sold.
  readonly positions = input<Record<string, number>>({});

  readonly closed = output<void>();
  // A trade that reached a final status. Emitted for a rejection too: the dashboard's funds
  // and holdings are only stale after a fill, but either way the attempt is over.
  readonly submitted = output<OrderResult>();

  // Starts as the instrument picked on the dashboard; the in-dialog search can swap symbols.
  protected readonly activeSymbol = linkedSignal(() => this.instrument().symbol);
  protected readonly activeInstrument = computed(
    () => findInstrument(this.activeSymbol(), this.instruments()) ?? this.instrument(),
  );
  protected readonly fullScreenUrl = computed(() => [
    '/dashboard/markets',
    this.activeInstrument().symbol.toLowerCase(),
  ]);
  protected readonly sides: readonly OrderSide[] = ['buy', 'sell'];
  protected readonly side = signal<OrderSide>('buy');
  protected readonly timeframe = signal<Timeframe>('1D');
  private readonly candlePoints = signal<PricePoint[] | null>(null);

  protected readonly chartTimeframe = signal<Timeframe>('1D');
  protected readonly chartRefreshing = signal(false);
  protected readonly chartError = signal('');
  private readonly candleMinute = computed(() =>
    Math.floor((this.marketTimeMillis() ?? 0) / 60_000),
  );
  private readonly chartRetry = signal(0);
  protected retryChart(): void {
    this.chartRetry.update((value) => value + 1);
  }
  private chartContext = '';
  private readonly candleLoader = effect((onCleanup) => {
    const sessionId = this.sessionId();
    const symbol = this.activeSymbol();
    const timeframe = this.timeframe();
    this.candleMinute();
    this.chartRetry();
    this.marketData.revision?.();
    const context = `${sessionId}:${symbol}`;
    if (this.chartContext !== context) {
      this.candlePoints.set(null);
      this.chartContext = context;
    }
    if (sessionId === null) return;
    this.chartRefreshing.set(true);
    this.chartError.set('');
    const subscription = this.marketData.candles(sessionId, symbol, timeframe).subscribe({
      next: (series) => {
        this.candlePoints.set(
          series.points.map((point) => ({ time: new Date(point.timestamp), value: point.close })),
        );
        this.chartTimeframe.set(timeframe);
        this.chartRefreshing.set(false);
      },
      error: () => {
        this.chartRefreshing.set(false);
        this.chartError.set('Chart data could not refresh.');
      },
    });
    onCleanup(() => subscription.unsubscribe());
  });

  protected readonly chartPoints = computed(() => {
    const instrument = this.activeInstrument();
    const marketTime = this.marketTimeMillis();
    const candles = this.candlePoints();
    if (candles?.length) {
      if (marketTime !== null && marketTime < candles[candles.length - 1].time.getTime())
        return candles;
      const points = [...candles];
      points[points.length - 1] = {
        time: new Date(marketTime ?? points[points.length - 1].time.getTime()),
        value: instrument.price,
      };
      return points;
    }
    return [];
  });

  protected readonly sharesHeld = computed(
    () => this.positions()[this.activeInstrument().symbol] ?? 0,
  );

  protected readonly maxShares = computed(() =>
    this.side() === 'buy'
      ? affordableShares(this.cashBalance(), this.activeInstrument().price)
      : wholeShares(this.sharesHeld()),
  );

  // Preserve valid edits when the live limit changes; clamp only when necessary.
  protected readonly shares = linkedSignal<number, number>({
    source: () => this.maxShares(),
    computation: (maximum, previous) => boundedShares(previous?.value ?? 1, maximum),
  });

  protected readonly orderValue = computed(() => this.shares() * this.activeInstrument().price);

  protected readonly cashAfter = computed(() =>
    this.side() === 'buy'
      ? this.cashBalance() - this.orderValue()
      : this.cashBalance() + this.orderValue(),
  );

  protected readonly submitting = signal(false);
  private readonly coolingDown = signal(false);
  private readonly submittedSide = signal<OrderSide>('buy');
  protected readonly busy = computed(() => this.submitting() || this.coolingDown());
  protected readonly errorMessage = signal('');
  // The order's final status once the backend has answered. A rejection is an outcome, not an
  // error: the request succeeded and said why the trade did not.
  protected readonly outcome = signal<OrderResult | null>(null);

  protected readonly filled = computed(() => this.outcome()?.status === 'FILLED');
  protected readonly rejectionReason = computed(() => {
    const outcome = this.outcome();
    return outcome?.status === 'REJECTED' ? (outcome.rejectionReason ?? ORDER_REJECTED) : '';
  });

  // Each completed request leaves the ticket ready for another deliberate order.
  protected readonly canSubmit = computed(
    () => this.shares() > 0 && this.shares() <= this.maxShares() && !this.busy(),
  );

  protected readonly submitLabel = computed(() => {
    if (this.busy()) {
      return this.submittedSide() === 'buy' ? 'Buying\u2026' : 'Selling\u2026';
    }
    const action = this.side() === 'buy' ? 'Buy' : 'Sell';
    return `${action} ${this.shares()} ${this.activeInstrument().symbol}`;
  });

  private readonly marketTimeMillis = computed(() => {
    const time = Date.parse(this.marketTimestamp());
    return Number.isNaN(time) ? null : time;
  });

  // Any change to what is being traded starts a new order, so the previous attempt's outcome
  // and error must not linger next to it.
  private readonly resetOnChange = effect(() => {
    this.activeSymbol();
    this.side();
    untracked(() => {
      this.outcome.set(null);
      this.errorMessage.set('');
    });
  });

  protected onSharesInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const quantity = boundedShares(Number(input.value), this.maxShares());
    this.shares.set(quantity);
    input.value = String(quantity);
  }

  protected submit(): void {
    if (!this.canSubmit()) {
      return;
    }
    const accountId = Number(this.accountId());
    if (!Number.isInteger(accountId) || accountId <= 0) {
      // No account selected yet, so there is nothing to place the order against.
      this.errorMessage.set(ORDER_NEEDS_ACCOUNT);
      this.toasts.show(ORDER_NEEDS_ACCOUNT, 'error');
      return;
    }

    const symbol = this.activeInstrument().symbol;
    this.submittedSide.set(this.side());
    this.coolingDown.set(true);
    this.cooldownTimer = setTimeout(() => this.coolingDown.set(false), 1000);
    this.submitting.set(true);
    this.errorMessage.set('');
    this.outcome.set(null);
    this.orders
      .submitOrder({
        accountId,
        symbol,
        orderType: this.side() === 'buy' ? 'BUY' : 'SELL',
        quantity: this.shares(),
        indicativePrice: this.activeInstrument().price,
        simulatedAt: Number.isFinite(Date.parse(this.marketTimestamp()))
          ? new Date(this.marketTimestamp()).toISOString()
          : undefined,
      })
      .subscribe({
        next: (result) => {
          this.submitting.set(false);
          this.outcome.set(result);
          if (result.status === 'FILLED') {
            const price = new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
            }).format(result.indicativePrice);
            this.toasts.show(`Filled ${result.quantity} ${symbol} at ${price}.`, 'success');
          } else if (result.status === 'REJECTED') {
            this.toasts.show(`Rejected: ${result.rejectionReason ?? ORDER_REJECTED}`, 'error');
          }
          this.submitted.emit(result);
        },
        error: (error: unknown) => {
          this.submitting.set(false);
          const message = toOrderErrorMessage(error);
          this.errorMessage.set(message);
          this.toasts.show(message, 'error');
        },
      });
  }
}
