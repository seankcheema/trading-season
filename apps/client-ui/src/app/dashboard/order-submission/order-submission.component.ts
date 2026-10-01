import { CurrencyPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
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
import {
  Instrument,
  OrderSide,
  PricePoint,
  Timeframe,
  findInstrument,
  mockPriceSeries,
} from '../mock-data';
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
    () =>
      findInstrument(this.activeSymbol(), this.instruments()) ??
      findInstrument(this.activeSymbol()) ??
      this.instrument(),
  );
  protected readonly fullScreenUrl = computed(() => [
    '/dashboard/markets',
    this.activeInstrument().symbol.toLowerCase(),
  ]);
  protected readonly sides: readonly OrderSide[] = ['buy', 'sell'];
  protected readonly side = signal<OrderSide>('buy');
  protected readonly timeframe = signal<Timeframe>('1D');
  private readonly candlePoints = signal<PricePoint[] | null>(null);

  private readonly candleLoader = effect((onCleanup) => {
    const sessionId = this.sessionId();
    const symbol = this.activeSymbol();
    const timeframe = this.timeframe();
    this.candlePoints.set(null);
    if (sessionId === null) {
      return;
    }

    const subscription = this.marketData.candles(sessionId, symbol, timeframe).subscribe({
      next: (series) =>
        this.candlePoints.set(
          series.points.map((point) => ({
            time: new Date(point.timestamp),
            value: point.close,
          })),
        ),
      error: () => this.candlePoints.set(null),
    });
    onCleanup(() => subscription.unsubscribe());
  });

  protected readonly chartPoints = computed(() => {
    const instrument = this.activeInstrument();
    const marketTime = this.marketTimeMillis();
    const candles = this.candlePoints();
    if (candles?.length) {
      const points = [...candles];
      points[points.length - 1] = {
        time: new Date(marketTime ?? points[points.length - 1].time.getTime()),
        value: instrument.price,
      };
      return points;
    }
    return mockPriceSeries(
      instrument.symbol,
      this.timeframe(),
      instrument.price,
      marketTime ?? undefined,
    );
  });

  protected readonly sharesHeld = computed(
    () => this.positions()[this.activeInstrument().symbol] ?? 0,
  );

  protected readonly maxShares = computed(() =>
    this.side() === 'buy'
      ? Math.floor(this.cashBalance() / this.activeInstrument().price)
      : this.sharesHeld(),
  );

  // Resets whenever the instrument or side changes the allowed range.
  protected readonly shares = linkedSignal(() => Math.min(1, this.maxShares()));

  protected readonly orderValue = computed(() => this.shares() * this.activeInstrument().price);

  protected readonly cashAfter = computed(() =>
    this.side() === 'buy'
      ? this.cashBalance() - this.orderValue()
      : this.cashBalance() + this.orderValue(),
  );

  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal('');
  // The order's final status once the backend has answered. A rejection is an outcome, not an
  // error: the request succeeded and said why the trade did not.
  protected readonly outcome = signal<OrderResult | null>(null);

  protected readonly filled = computed(() => this.outcome()?.status === 'FILLED');
  protected readonly rejectionReason = computed(() => {
    const outcome = this.outcome();
    return outcome?.status === 'REJECTED' ? (outcome.rejectionReason ?? ORDER_REJECTED) : '';
  });

  // A filled order is done; leave the button disabled rather than let a second click place
  // another trade the trader did not ask for.
  protected readonly canSubmit = computed(
    () => this.shares() > 0 && !this.submitting() && !this.filled(),
  );

  protected readonly submitLabel = computed(() => {
    if (this.submitting()) {
      return 'Submitting…';
    }
    if (this.filled()) {
      return 'Order filled';
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
    const value = Number((event.target as HTMLInputElement).value);
    this.shares.set(Math.max(0, Math.min(this.maxShares(), Math.floor(value) || 0)));
  }

  protected submit(): void {
    if (!this.canSubmit()) {
      return;
    }
    const accountId = Number(this.accountId());
    if (!Number.isInteger(accountId) || accountId <= 0) {
      // No account selected yet, so there is nothing to place the order against.
      this.errorMessage.set(ORDER_NEEDS_ACCOUNT);
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set('');
    this.outcome.set(null);
    this.orders
      .submitOrder({
        accountId,
        symbol: this.activeInstrument().symbol,
        orderType: this.side() === 'buy' ? 'BUY' : 'SELL',
        quantity: this.shares(),
        indicativePrice: this.activeInstrument().price,
      })
      .subscribe({
        next: (result) => {
          this.submitting.set(false);
          this.outcome.set(result);
          this.submitted.emit(result);
        },
        error: (error: unknown) => {
          this.submitting.set(false);
          this.errorMessage.set(toOrderErrorMessage(error));
        },
      });
  }
}
