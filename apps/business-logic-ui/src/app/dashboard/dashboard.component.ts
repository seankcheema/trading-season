import { CurrencyPipe, DOCUMENT, DatePipe, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  NgZone,
  PLATFORM_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCalendarClock, lucideChevronDown } from '@ng-icons/lucide';
import {
  Instrument,
  MOCK_ACCOUNTS,
  MOCK_CASH_BALANCE,
  MOCK_HOLDINGS,
  MOCK_INSTRUMENTS,
  MOCK_TRANSACTIONS,
  OrderRequest,
  Timeframe,
  findInstrument,
  mockPriceSeries,
} from './mock-data';
import { MarketDataService, MarketSnapshot, MarketTickEvent } from './market-data.service';
import { OrderSubmissionComponent } from './order-submission/order-submission.component';
import { InstrumentSearchComponent } from './shared/instrument-search.component';
import { PriceChartComponent } from './shared/price-chart.component';
import { SignedPercentPipe } from './shared/signed-percent.pipe';
import { TimeframeToggleComponent } from './shared/timeframe-toggle.component';

@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CurrencyPipe,
    DatePipe,
    InstrumentSearchComponent,
    NgIcon,
    OrderSubmissionComponent,
    PriceChartComponent,
    SignedPercentPipe,
    TimeframeToggleComponent,
  ],
  providers: [provideIcons({ lucideCalendarClock, lucideChevronDown })],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnInit, OnDestroy {
  private readonly marketData = inject(MarketDataService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly document = inject(DOCUMENT);
  private readonly zone = inject(NgZone);
  private disconnectMarket?: () => void;
  private readonly updateTimers = new Set<ReturnType<typeof setTimeout>>();
  private readonly openingPrices = new Map<string, number>();
  private marketGeneration = 0;

  protected readonly accounts = MOCK_ACCOUNTS;
  protected readonly selectedAccountId = signal(MOCK_ACCOUNTS[0].id);
  protected readonly cashBalance = signal(MOCK_CASH_BALANCE);
  protected readonly tickerInstruments = signal<Instrument[]>(MOCK_INSTRUMENTS.slice(0, 6));
  protected readonly changedSymbols = signal(new Set<string>());
  protected readonly flashDirections = signal<Record<string, number>>({});
  protected readonly portfolioTimeframe = signal<Timeframe>('1D');
  protected readonly marketSessionId = signal<number | null>(null);
  protected readonly marketDateTime = signal('');
  protected readonly clockError = signal('');
  protected readonly clockUpdating = signal(false);

  // Instrument currently open in the order submission dialog, if any.
  protected readonly orderInstrument = signal<Instrument | null>(null);

  protected readonly holdings = computed(() =>
    MOCK_HOLDINGS.flatMap((holding) => {
      const instrument = findInstrument(holding.symbol);
      if (!instrument) {
        return [];
      }
      const value = holding.shares * instrument.price;
      return [
        { ...holding, instrument, value, gainLoss: value - holding.shares * holding.costBasis },
      ];
    }),
  );

  protected readonly transactions = computed(() =>
    MOCK_TRANSACTIONS.map((transaction) => {
      const current = findInstrument(transaction.symbol)?.price ?? transaction.price;
      const direction = transaction.side === 'buy' ? 1 : -1;
      return {
        ...transaction,
        value: transaction.shares * transaction.price,
        gainLoss: direction * transaction.shares * (current - transaction.price),
      };
    }),
  );

  protected readonly positions = computed(() =>
    Object.fromEntries(this.holdings().map((holding) => [holding.symbol, holding.shares])),
  );

  protected readonly investedValue = computed(() =>
    this.holdings().reduce((total, holding) => total + holding.value, 0),
  );

  protected readonly netWorth = computed(() => this.cashBalance() + this.investedValue());

  protected readonly netWorthChangePercent = computed(() => {
    const cost = this.holdings().reduce((total, h) => total + h.shares * h.costBasis, 0);
    return cost ? ((this.investedValue() - cost) / cost) * 100 : 0;
  });

  // Share of net worth that is invested rather than held as cash.
  protected readonly allocationPercent = computed(() =>
    this.netWorth() ? (this.investedValue() / this.netWorth()) * 100 : 0,
  );

  protected readonly portfolioChart = computed(() =>
    mockPriceSeries(
      `portfolio-${this.selectedAccountId()}`,
      this.portfolioTimeframe(),
      this.netWorth(),
    ),
  );

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) this.loadMarketSnapshot();
  }

  ngOnDestroy(): void {
    this.disconnectMarket?.();
    this.clearQueuedUpdates();
  }

  protected onAccountChange(event: Event): void {
    this.selectedAccountId.set((event.target as HTMLSelectElement).value);
  }

  protected openOrder(instrument: Instrument): void {
    this.orderInstrument.set(instrument);
  }

  protected closeOrder(): void {
    this.orderInstrument.set(null);
  }

  protected onOrderSubmitted(order: OrderRequest): void {
    // TODO: send to the order service once the backend endpoint is available
    console.log('Order submitted', order);
    this.closeOrder();
  }

  protected onDeposit(): void {
    // TODO: open deposit flow
  }

  protected onWithdraw(): void {
    // TODO: open withdrawal flow
  }

  protected onMarketDateTimeChange(event: Event): void {
    this.marketDateTime.set((event.target as HTMLInputElement).value);
  }

  protected applyMarketDateTime(): void {
    const sessionId = this.marketSessionId();
    const value = this.marketDateTime();
    if (sessionId === null || !value) return;
    this.clockUpdating.set(true);
    this.clockError.set('');
    this.marketData.setClock(sessionId, this.marketLocalToIso(value)).subscribe({
      next: (snapshot) => {
        this.applySnapshot(snapshot);
        this.clockUpdating.set(false);
      },
      error: () => {
        this.clockError.set('Choose a seeded trading date and market time.');
        this.clockUpdating.set(false);
      },
    });
  }

  private loadMarketSnapshot(): void {
    this.marketData.snapshot().subscribe({
      next: (snapshot) => this.applySnapshot(snapshot),
      error: () => undefined,
    });
  }

  private applySnapshot(snapshot: MarketSnapshot): void {
    this.disconnectMarket?.();
    this.clearQueuedUpdates();
    this.marketGeneration++;
    this.marketSessionId.set(snapshot.sessionId);
    this.marketDateTime.set(this.isoToMarketLocal(snapshot.marketTimestamp));
    const instruments = snapshot.stocks.map((stock) => {
      this.openingPrices.set(stock.symbol, stock.price - stock.change);
      return {
        symbol: stock.symbol,
        name: stock.companyName,
        price: stock.price,
        change: stock.change,
        changePercent: stock.changePercent,
      };
    });
    this.tickerInstruments.set(instruments);
    this.disconnectMarket = this.marketData.connect(snapshot.sessionId, {
      tick: (event) => this.queueTickBatch(event),
      status: () => undefined,
      resync: () => this.loadMarketSnapshot(),
    });
  }

  private queueTickBatch(event: MarketTickEvent): void {
    if (this.document.hidden) {
      return;
    }
    const generation = this.marketGeneration;
    for (const tick of event.prices) {
      const timer = setTimeout(
        () => {
          this.updateTimers.delete(timer);
          if (generation !== this.marketGeneration) return;
          this.zone.run(() => this.applyTick(tick.symbol, tick.price));
        },
        Math.floor(Math.random() * 1000),
      );
      this.updateTimers.add(timer);
    }
  }

  private applyTick(symbol: string, price: number): void {
    const previous =
      this.tickerInstruments().find((stock) => stock.symbol === symbol)?.price ?? price;
    this.tickerInstruments.update((stocks) =>
      stocks.map((stock) => {
        if (stock.symbol !== symbol) return stock;
        const open = this.openingPrices.get(symbol) ?? price;
        const change = price - open;
        return { ...stock, price, change, changePercent: open ? (change / open) * 100 : 0 };
      }),
    );
    this.changedSymbols.update((symbols) => new Set(symbols).add(symbol));
    this.flashDirections.update((directions) => ({
      ...directions,
      [symbol]: Math.sign(price - previous),
    }));
    const flashTimer = setTimeout(() => {
      this.updateTimers.delete(flashTimer);
      this.changedSymbols.update((symbols) => {
        const next = new Set(symbols);
        next.delete(symbol);
        return next;
      });
      this.flashDirections.update((directions) => {
        const next = { ...directions };
        delete next[symbol];
        return next;
      });
    }, 220);
    this.updateTimers.add(flashTimer);
  }

  private clearQueuedUpdates(): void {
    this.updateTimers.forEach(clearTimeout);
    this.updateTimers.clear();
    this.changedSymbols.set(new Set());
    this.flashDirections.set({});
  }

  private isoToMarketLocal(timestamp: string): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Chicago',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(timestamp));
    const part = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((value) => value.type === type)?.value ?? '';
    return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`;
  }

  private marketLocalToIso(value: string): string {
    const [date, time] = value.split('T');
    const [year, month, day] = date.split('-').map(Number);
    const [hour, minute] = time.split(':').map(Number);
    const desired = Date.UTC(year, month - 1, day, hour, minute);
    let instant = desired;
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    for (let attempt = 0; attempt < 2; attempt++) {
      const parts = formatter.formatToParts(new Date(instant));
      const part = (type: Intl.DateTimeFormatPartTypes) =>
        Number(parts.find((item) => item.type === type)?.value);
      const represented = Date.UTC(
        part('year'),
        part('month') - 1,
        part('day'),
        part('hour'),
        part('minute'),
      );
      instant += desired - represented;
    }
    return new Date(instant).toISOString();
  }
}
