import { CurrencyPipe, DOCUMENT, DatePipe, isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  NgZone,
  PLATFORM_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideBriefcaseBusiness,
  lucideCalendarClock,
  lucideCheck,
  lucideChevronDown,
} from '@ng-icons/lucide';
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
import {
  MarketCalendarAvailability,
  MarketDataService,
  MarketSnapshot,
  MarketTickEvent,
} from './market-data.service';
import { OrderSubmissionComponent } from './order-submission/order-submission.component';
import { DashboardHeaderDropdownComponent } from './shared/dashboard-header-dropdown.component';
import { InstrumentSearchComponent } from './shared/instrument-search.component';
import { PriceChartComponent } from './shared/price-chart.component';
import { SignedPercentPipe } from './shared/signed-percent.pipe';
import { TimeframeToggleComponent } from './shared/timeframe-toggle.component';

const DEFAULT_MARKET_CALENDAR: MarketCalendarAvailability = {
  timezone: 'America/Chicago',
  firstTimestamp: '2026-01-01T14:30:00Z',
  lastTimestamp: '2026-12-31T20:59:59Z',
  tradingDates: marketWeekdays(2026),
};

type HeaderDropdown = 'account' | 'market-clock';

@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CurrencyPipe,
    DatePipe,
    DashboardHeaderDropdownComponent,
    InstrumentSearchComponent,
    NgIcon,
    OrderSubmissionComponent,
    PriceChartComponent,
    SignedPercentPipe,
    TimeframeToggleComponent,
  ],
  providers: [
    provideIcons({ lucideBriefcaseBusiness, lucideCalendarClock, lucideCheck, lucideChevronDown }),
  ],
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
  protected readonly openHeaderDropdown = signal<HeaderDropdown | null>(null);
  protected readonly selectedAccountId = signal(MOCK_ACCOUNTS[0].id);
  protected readonly selectedAccount = computed(
    () => this.accounts.find((account) => account.id === this.selectedAccountId()) ?? this.accounts[0],
  );
  protected readonly cashBalance = signal(MOCK_CASH_BALANCE);
  protected readonly instruments = signal<Instrument[]>([...MOCK_INSTRUMENTS]);
  protected readonly tickerInstruments = computed(() => this.instruments().slice(0, 6));
  protected readonly changedSymbols = signal(new Set<string>());
  protected readonly flashDirections = signal<Record<string, number>>({});
  protected readonly portfolioTimeframe = signal<Timeframe>('1D');
  protected readonly marketSessionId = signal<number | null>(null);
  protected readonly currentMarketTimestamp = signal('');
  protected readonly marketCalendar = signal<MarketCalendarAvailability>(DEFAULT_MARKET_CALENDAR);
  protected readonly marketDateTime = signal('');
  protected readonly clockError = signal('');
  protected readonly clockUpdating = signal(false);
  protected readonly marketClockLabel = computed(() =>
    this.currentMarketTimestamp()
      ? this.formatMarketTime(this.currentMarketTimestamp(), {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          timeZoneName: 'short',
        })
      : 'Market time',
  );
  protected readonly marketClockRangeLabel = computed(() => {
    const calendar = this.marketCalendar();
    return `${this.formatMarketTime(calendar.firstTimestamp, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })} - ${this.formatMarketTime(calendar.lastTimestamp, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    })}`;
  });
  protected readonly marketClockShortRangeLabel = computed(() => {
    const calendar = this.marketCalendar();
    return `${this.formatMarketTime(calendar.firstTimestamp, {
      month: 'short',
      day: 'numeric',
    })} - ${this.formatMarketTime(calendar.lastTimestamp, {
      month: 'short',
      day: 'numeric',
    })}`;
  });
  protected readonly marketDateTimeMin = computed(() => {
    const calendar = this.marketCalendar();
    return this.isoToMarketLocal(calendar.firstTimestamp);
  });
  protected readonly marketDateTimeMax = computed(() => {
    const calendar = this.marketCalendar();
    return this.isoToMarketLocal(calendar.lastTimestamp);
  });

  // Symbol currently open in the order submission dialog, if any.
  private readonly orderSymbol = signal<string | null>(null);
  protected readonly orderInstrument = computed(() => {
    const symbol = this.orderSymbol();
    return symbol ? findInstrument(symbol, this.instruments()) ?? null : null;
  });

  protected readonly holdings = computed(() =>
    MOCK_HOLDINGS.flatMap((holding) => {
      const instrument = findInstrument(holding.symbol, this.instruments());
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
      const current =
        findInstrument(transaction.symbol, this.instruments())?.price ?? transaction.price;
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

  protected onHeaderDropdownOpenChange(dropdown: HeaderDropdown, open: boolean): void {
    this.openHeaderDropdown.set(open ? dropdown : null);
  }

  @HostListener('document:click', ['$event'])
  protected closeHeaderDropdownOnDocumentClick(event: MouseEvent): void {
    const target = event.target;
    if (target instanceof Element && target.closest('app-dashboard-header-dropdown')) {
      return;
    }
    this.openHeaderDropdown.set(null);
  }

  protected selectAccount(accountId: string): void {
    this.selectedAccountId.set(accountId);
    this.openHeaderDropdown.set(null);
  }

  protected openOrder(instrument: Instrument): void {
    this.orderSymbol.set(instrument.symbol);
  }

  protected closeOrder(): void {
    this.orderSymbol.set(null);
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

  protected applyMarketDateTime(value = this.marketDateTime()): void {
    const sessionId = this.marketSessionId();
    this.marketDateTime.set(value);
    if (sessionId === null || !value) {
      return;
    }
    const resolved = this.resolveMarketDateTime(value);
    if (resolved.error) {
      this.clockError.set(resolved.error);
      return;
    }
    this.marketDateTime.set(resolved.value);
    this.clockUpdating.set(true);
    this.clockError.set('');
    this.marketData.setClock(sessionId, this.marketLocalToIso(resolved.value)).subscribe({
      next: (snapshot) => {
        this.applySnapshot(snapshot);
        this.clockUpdating.set(false);
        this.openHeaderDropdown.set(null);
      },
      error: (error: HttpErrorResponse) => {
        this.clockError.set(this.clockErrorMessage(error));
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
    this.currentMarketTimestamp.set(snapshot.marketTimestamp);
    this.marketCalendar.set(snapshot.calendar);
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
    this.instruments.set(instruments);
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
    this.zone.run(() => this.currentMarketTimestamp.set(event.marketTimestamp));
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
      this.instruments().find((stock) => stock.symbol === symbol)?.price ?? price;
    this.instruments.update((stocks) =>
      stocks.map((stock) => {
        if (stock.symbol !== symbol) return stock;
        const open = this.openingPrices.get(symbol) ?? price;
        const change = price - open;
        return { ...stock, price, change, changePercent: open ? (change / open) * 100 : 0 };
      }),
    );
    const previousCents = Math.round(previous * 100);
    const nextCents = Math.round(price * 100);
    if (previousCents === nextCents) {
      return;
    }
    this.changedSymbols.update((symbols) => new Set(symbols).add(symbol));
    this.flashDirections.update((directions) => ({
      ...directions,
      [symbol]: Math.sign(nextCents - previousCents),
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

  private resolveMarketDateTime(value: string): { value: string; error: string } {
    const calendar = this.marketCalendar();
    const selected = value.slice(0, 10);
    const min = this.marketDateTimeMin();
    const max = this.marketDateTimeMax();
    if ((min && value < min) || (max && value > max)) {
      return {
        value,
        error: `This simulation has market data from ${this.marketClockRangeLabel()}.`,
      };
    }
    if (!calendar.tradingDates.includes(selected)) {
      const replacement = this.nearestLoadedDateInMonth(selected);
      if (!replacement) {
        return {
          value,
          error: `${this.formatMarketDate(selected)} is not in this simulation archive. Choose one of the loaded trading dates.`,
        };
      }
      return { value: `${replacement}${value.slice(10)}`, error: '' };
    }
    return { value, error: '' };
  }

  private nearestLoadedDateInMonth(value: string): string {
    const calendar = this.marketCalendar();
    const month = value.slice(0, 7);
    const dates = calendar.tradingDates.filter((date) => date.startsWith(month));
    const next = dates.find((date) => date >= value);
    if (next) return next;
    for (let index = dates.length - 1; index >= 0; index--) {
      if (dates[index] <= value) return dates[index];
    }
    return '';
  }

  private clockErrorMessage(error: HttpErrorResponse): string {
    const message = typeof error.error?.error === 'string' ? error.error.error : '';
    return message || `Unable to update the market clock. Available range: ${this.marketClockRangeLabel()}.`;
  }

  private formatMarketDate(value: string): string {
    const [year, month, day] = value.split('-').map(Number);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(year, month - 1, day)));
  }

  private formatMarketTime(
    timestamp: string,
    options: Intl.DateTimeFormatOptions,
  ): string {
    const calendar = this.marketCalendar();
    return new Intl.DateTimeFormat('en-US', {
      ...options,
      timeZone: calendar?.timezone ?? 'America/Chicago',
    })
      .format(new Date(timestamp))
      .replace(/\bC[DS]T\b/, 'CT');
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

function marketWeekdays(year: number): string[] {
  const dates: string[] = [];
  for (
    let time = Date.UTC(year, 0, 1);
    time <= Date.UTC(year, 11, 31);
    time += 24 * 60 * 60 * 1000
  ) {
    const day = new Date(time).getUTCDay();
    if (day !== 0 && day !== 6) {
      dates.push(new Date(time).toISOString().slice(0, 10));
    }
  }
  return dates;
}
