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
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideExpand, lucideX } from '@ng-icons/lucide';
import { RouterLink } from '@angular/router';
import {
  Instrument,
  OrderRequest,
  OrderSide,
  PricePoint,
  Timeframe,
  findInstrument,
  mockPriceSeries,
} from '../mock-data';
import { MarketDataService } from '../market-data.service';
import { InstrumentSearchComponent } from '../shared/instrument-search.component';
import { PriceChartComponent } from '../shared/price-chart.component';
import { SignedPercentPipe } from '../shared/signed-percent.pipe';
import { TimeframeToggleComponent } from '../shared/timeframe-toggle.component';

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

  readonly instrument = input.required<Instrument>();
  readonly instruments = input<readonly Instrument[]>([]);
  readonly sessionId = input<number | null>(null);
  readonly marketTimestamp = input('');
  readonly accountId = input.required<string>();
  readonly cashBalance = input.required<number>();
  // Shares currently held, keyed by symbol. Caps how much can be sold.
  readonly positions = input<Record<string, number>>({});

  readonly closed = output<void>();
  readonly submitted = output<OrderRequest>();

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

  protected readonly canSubmit = computed(() => this.shares() > 0);

  private readonly marketTimeMillis = computed(() => {
    const time = Date.parse(this.marketTimestamp());
    return Number.isNaN(time) ? null : time;
  });

  protected onSharesInput(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.shares.set(Math.max(0, Math.min(this.maxShares(), Math.floor(value) || 0)));
  }

  protected submit(): void {
    if (!this.canSubmit()) {
      return;
    }
    this.submitted.emit({
      accountId: this.accountId(),
      symbol: this.activeInstrument().symbol,
      side: this.side(),
      shares: this.shares(),
      price: this.activeInstrument().price,
    });
  }
}
