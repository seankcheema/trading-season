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
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import {
  lucideBriefcaseBusiness,
  lucideCalendarClock,
  lucideCheck,
  lucideChevronDown,
  lucideLogOut,
  lucidePencil,
  lucidePlus,
  lucideSettings,
} from '@ng-icons/lucide';
import { Subscription } from 'rxjs';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { AuthService } from '../core/auth/auth.service';
import {
  Instrument,
  MOCK_INSTRUMENTS,
  MOCK_TRANSACTIONS,
  OrderRequest,
  OrderSide,
  PricePoint,
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
import { AccountStore } from './accounts/account-store.service';
import { AccountDialogComponent } from './accounts/account-dialog.component';
import { Account, AccountHolding, CashTransactionReason } from './accounts/account.models';
import {
  CashTransactionDialogComponent,
  CashTransactionMode,
} from './accounts/cash-transaction-dialog.component';
import { OrderSubmissionComponent } from './order-submission/order-submission.component';
import { SettingsDialogComponent } from './settings-dialog/settings-dialog.component';
import { DashboardHeaderDropdownComponent } from './shared/dashboard-header-dropdown.component';
import { DailySparklineComponent } from './shared/daily-sparkline.component';
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

type HeaderDropdown = 'account' | 'market-clock' | 'profile';

// The account or cash dialog currently open over the dashboard, if any. An account dialog
// with an account renames it; without one it creates a new, empty account.
type AccountDialog =
  | { kind: 'account'; account: Account | null }
  | { kind: 'cash'; mode: CashTransactionMode };

// One position in an account's portfolio, valued at the latest price.
interface PricedHolding {
  symbol: string;
  shares: number;
  // Average cost per share, used to derive gain/loss.
  costBasis: number;
  instrument: Instrument;
  value: number;
  gainLoss: number;
}

// One row of the recent transactions list: a cash deposit or withdrawal from the account
// service, or a trade. Trades are still mock data until order history is integrated.
type ActivityItem =
  | { kind: 'cash'; key: string; date: string; reason: CashTransactionReason; value: number }
  | {
      kind: 'trade';
      key: string;
      date: string;
      symbol: string;
      side: OrderSide;
      shares: number;
      price: number;
      value: number;
    };

@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AccountDialogComponent,
    CashTransactionDialogComponent,
    CurrencyPipe,
    DatePipe,
    DashboardHeaderDropdownComponent,
    DailySparklineComponent,
    InstrumentSearchComponent,
    NgIcon,
    OrderSubmissionComponent,
    PriceChartComponent,
    SettingsDialogComponent,
    SignedPercentPipe,
    TimeframeToggleComponent,
  ],
  providers: [
    AccountStore,
    provideIcons({
      lucideBriefcaseBusiness,
      lucideCalendarClock,
      lucideCheck,
      lucideChevronDown,
      lucideLogOut,
      lucidePencil,
      lucidePlus,
      lucideSettings,
    }),
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
  private readonly assetChartSubscriptions = new Map<string, Subscription>();
  private marketGeneration = 0;
  private readonly _authService = inject(AuthService);
  private readonly _router = inject(Router);

  // Only ever the signed-in user's own accounts; see AccountStore. Each account's portfolio
  // is its holdings, and the user's cash is shared by all of them.
  protected readonly accountStore = inject(AccountStore);
  protected readonly accounts = this.accountStore.accounts;
  protected readonly selectedAccount = this.accountStore.selectedAccount;
  protected readonly selectedAccountId = this.accountStore.selectedAccountId;
  protected readonly hasAccounts = computed(() => this.accounts().length > 0);
  protected readonly accountLabel = computed(() => {
    switch (this.accountStore.status()) {
      case 'idle':
      case 'loading':
        return 'Loading accounts…';
      case 'error':
        return 'Accounts unavailable';
      case 'ready':
        return this.selectedAccount()?.name ?? 'No accounts';
    }
  });
  protected readonly accountDialog = signal<AccountDialog | null>(null);
  protected readonly openHeaderDropdown = signal<HeaderDropdown | null>(null);
  protected readonly cashBalance = this.accountStore.cashBalance;
  protected readonly instruments = signal<Instrument[]>([...MOCK_INSTRUMENTS]);
  protected readonly tickerInstruments = computed(() => this.instruments().slice(0, 6));
  protected readonly portfolioTimeframe = signal<Timeframe>('1D');
  protected readonly marketSessionId = signal<number | null>(null);
  protected readonly currentMarketTimestamp = signal('');
  protected readonly assetCandlePoints = signal(new Map<string, PricePoint[]>());
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

  protected readonly settingsOpen = signal(false);

  // Symbol currently open in the order submission dialog, if any.
  private readonly orderSymbol = signal<string | null>(null);
  protected readonly orderInstrument = computed(() => {
    const symbol = this.orderSymbol();
    return symbol ? findInstrument(symbol, this.instruments()) ?? null : null;
  });

  // The selected account's portfolio.
  protected readonly holdings = computed(() =>
    this.priceHoldings(this.accountStore.selectedHoldings()),
  );

  // Only the symbols, so price ticks don't look like a change of holdings.
  private readonly heldSymbols = computed(() =>
    this.accountStore
      .selectedHoldings()
      .map((holding) => holding.symbol)
      .join(','),
  );

  // Value of each owned account's portfolio, keyed by account id.
  protected readonly portfolioValues = computed(() => {
    const values = new Map<number, number>();
    for (const [accountId, holdings] of this.accountStore.holdingsByAccount()) {
      values.set(accountId, totalValue(this.priceHoldings(holdings)));
    }
    return values;
  });

  protected readonly transactions = computed<ActivityItem[]>(() => {
    const cash: ActivityItem[] = this.accountStore.cashTransactions().map((transaction) => ({
      kind: 'cash',
      key: `cash-${transaction.cashTransactionId}`,
      date: transaction.createdAt,
      reason: transaction.reason,
      value: transaction.amount,
    }));
    const trades: ActivityItem[] = MOCK_TRANSACTIONS.map((transaction, index) => ({
      kind: 'trade',
      key: `trade-${index}`,
      ...transaction,
      value: transaction.shares * transaction.price,
    }));
    // ISO dates and instants both sort correctly as strings; newest first.
    return [...cash, ...trades].sort((a, b) => b.date.localeCompare(a.date));
  });

  protected readonly positions = computed(() =>
    Object.fromEntries(this.holdings().map((holding) => [holding.symbol, holding.shares])),
  );

  private readonly marketTimeMillis = computed(() => {
    const time = Date.parse(this.currentMarketTimestamp());
    return Number.isNaN(time) ? null : time;
  });

  protected readonly assetCharts = computed<Record<string, PricePoint[]>>(() => {
    const candlesBySymbol = this.assetCandlePoints();
    const marketTime = this.marketTimeMillis();
    return Object.fromEntries(
      this.holdings().map((holding) => {
        const candles = candlesBySymbol.get(holding.symbol);
        if (candles?.length) {
          const points = [...candles];
          points[points.length - 1] = {
            time: new Date(marketTime ?? points[points.length - 1].time.getTime()),
            value: holding.instrument.price,
          };
          return [holding.symbol, points];
        }
        return [
          holding.symbol,
          mockPriceSeries(
            holding.symbol,
            '1D',
            holding.instrument.price,
            marketTime ?? undefined,
          ),
        ];
      }),
    );
  });

  // The selected account's portfolio value.
  protected readonly portfolioValue = computed(() => totalValue(this.holdings()));

  protected readonly portfolioChangePercent = computed(() => {
    const cost = this.holdings().reduce((total, h) => total + h.shares * h.costBasis, 0);
    return cost ? ((this.portfolioValue() - cost) / cost) * 100 : 0;
  });

  // Every account's portfolio value together.
  protected readonly investedValue = computed(() =>
    [...this.portfolioValues().values()].reduce((total, value) => total + value, 0),
  );

  // The user's shared cash plus the value of every account's portfolio.
  protected readonly netWorth = computed(() => this.cashBalance() + this.investedValue());

  // Share of net worth that is invested rather than held as cash.
  protected readonly allocationPercent = computed(() =>
    this.netWorth() ? (this.investedValue() / this.netWorth()) * 100 : 0,
  );

  protected readonly portfolioChart = computed(() =>
    mockPriceSeries(
      `portfolio-${this.selectedAccountId()}`,
      this.portfolioTimeframe(),
      this.portfolioValue(),
      this.marketTimeMillis() ?? undefined,
    ),
  );

  constructor() {
    // Holdings arrive after the market snapshot and change with the selected account, so
    // load daily candles for any newly held symbol once there is a market session.
    effect(() => {
      this.heldSymbols();
      const sessionId = this.marketSessionId();
      if (sessionId !== null) {
        untracked(() => this.loadAssetCharts(sessionId, this.marketGeneration));
      }
    });
  }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.loadMarketSnapshot();
      this.accountStore.load();
    }
  }

  ngOnDestroy(): void {
    this.disconnectMarket?.();
    this.clearAssetChartSubscriptions();
    this.clearQueuedUpdates();
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

  protected selectAccount(accountId: number): void {
    this.accountStore.selectAccount(accountId);
    this.openHeaderDropdown.set(null);
  }

  protected retryAccounts(): void {
    this.accountStore.load();
  }

  protected openCreateAccount(): void {
    this.openHeaderDropdown.set(null);
    this.accountDialog.set({ kind: 'account', account: null });
  }

  protected openRenameAccount(account: Account): void {
    // Only accounts the store lists for the caller can be renamed.
    if (!this.accountStore.isOwnedAccount(account.accountId)) {
      return;
    }
    this.openHeaderDropdown.set(null);
    this.accountDialog.set({ kind: 'account', account });
  }

  protected closeAccountDialog(): void {
    this.accountDialog.set(null);
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
    this.openCashDialog('deposit');
  }

  protected onWithdraw(): void {
    this.openCashDialog('withdraw');
  }

  // Cash belongs to the user rather than an account, so it can move before any account exists.
  private openCashDialog(mode: CashTransactionMode): void {
    this.accountDialog.set({ kind: 'cash', mode });
  }

  // Values holdings at the latest price, or at cost for a symbol with no live price.
  private priceHoldings(holdings: readonly AccountHolding[]): PricedHolding[] {
    return holdings.map((holding) => {
      const instrument = findInstrument(holding.symbol, this.instruments()) ?? {
        symbol: holding.symbol,
        name: holding.symbol,
        price: holding.averageCost,
        change: 0,
        changePercent: 0,
      };
      const value = holding.quantity * instrument.price;
      return {
        symbol: holding.symbol,
        shares: holding.quantity,
        costBasis: holding.averageCost,
        instrument,
        value,
        gainLoss: value - holding.quantity * holding.averageCost,
      };
    });
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
    this.clearAssetChartSubscriptions();
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
    this.loadAssetCharts(snapshot.sessionId, this.marketGeneration);
    this.disconnectMarket = this.marketData.connect(snapshot.sessionId, {
      tick: (event) => this.queueTickBatch(event),
      status: () => undefined,
      resync: () => this.loadMarketSnapshot(),
    });
  }

  private loadAssetCharts(sessionId: number, generation: number): void {
    for (const holding of this.holdings()) {
      const symbol = holding.symbol;
      if (this.assetChartSubscriptions.has(symbol)) {
        continue;
      }
      const subscription = this.marketData.candles(sessionId, symbol, '1D').subscribe({
        next: (series) => {
          if (generation !== this.marketGeneration) {
            return;
          }
          const points = series.points.map((point) => ({
            time: new Date(point.timestamp),
            value: point.close,
          }));
          this.assetCandlePoints.update((current) => new Map(current).set(symbol, points));
        },
        error: () => {
          if (generation !== this.marketGeneration) {
            return;
          }
          this.assetCandlePoints.update((current) => {
            const next = new Map(current);
            next.delete(symbol);
            return next;
          });
        },
      });
      this.assetChartSubscriptions.set(symbol, subscription);
    }
  }

  private clearAssetChartSubscriptions(): void {
    this.assetChartSubscriptions.forEach((subscription) => subscription.unsubscribe());
    this.assetChartSubscriptions.clear();
    this.assetCandlePoints.set(new Map());
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
    this.instruments.update((stocks) =>
      stocks.map((stock) => {
        if (stock.symbol !== symbol) return stock;
        const open = this.openingPrices.get(symbol) ?? price;
        const change = price - open;
        return { ...stock, price, change, changePercent: open ? (change / open) * 100 : 0 };
      }),
    );
  }

  private clearQueuedUpdates(): void {
    this.updateTimers.forEach(clearTimeout);
    this.updateTimers.clear();
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

  protected onSettings(): void {
    this.openHeaderDropdown.set(null);
    this.settingsOpen.set(true);
  }

  protected closeSettings(): void {
    this.settingsOpen.set(false);
  }

  protected onSignOut(): void {
    this.openHeaderDropdown.set(null);
    this._authService.logout().subscribe(() => void this._router.navigateByUrl('/login'));
  }
}

function totalValue(holdings: readonly PricedHolding[]): number {
  return holdings.reduce((total, holding) => total + holding.value, 0);
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
