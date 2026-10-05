import { WatchlistStore } from './watchlist/watchlist-store.service';
import { ActivityItem, ActivityRowComponent } from './shared/activity-row.component';
import { cashActivity, orderActivity, orderDate } from './shared/activity';
import { OrderHistoryDialogComponent } from './history/order-history-dialog.component';
import { TransactionsDialogComponent } from './history/transactions-dialog.component';
import { AccountControlComponent } from './shared/account-control.component';
import { MarketClockControlComponent } from './shared/market-clock-control.component';
import { MarketClockService } from './shared/market-clock.service';
import { cashAt, holdingsAt } from './accounts/simulation-account';
import { CurrencyPipe, DOCUMENT, isPlatformBrowser } from '@angular/common';
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
  lucideCalendarClock,
  lucideCheck,
  lucideChevronDown,
  lucideLogOut,
  lucidePencil,
  lucidePiggyBank,
  lucidePlus,
  lucideSettings,
} from '@ng-icons/lucide';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { AuthService } from '../core/auth/auth.service';
import { Instrument, PricePoint, Timeframe, findInstrument } from './mock-data';
import { MarketDataService, MarketSnapshot, MarketTickEvent } from './market-data.service';
import { AccountStore } from './accounts/account-store.service';
import { PortfolioHistoryService } from './accounts/portfolio-history.service';
import { AccountDialogComponent } from './accounts/account-dialog.component';
import { Account, AccountHolding } from './accounts/account.models';
import {
  CashTransactionDialogComponent,
  CashTransactionMode,
} from './accounts/cash-transaction-dialog.component';
import { OrderSubmissionComponent } from './order-submission/order-submission.component';
import { OrderResult } from './orders/order.models';
import { OrderService } from './orders/order.service';
import { SettingsDialogComponent } from './settings-dialog/settings-dialog.component';
import { DashboardHeaderDropdownComponent } from './shared/dashboard-header-dropdown.component';
import { DailySparklineComponent } from './shared/daily-sparkline.component';
import { InstrumentSearchComponent } from './shared/instrument-search.component';
import { PriceChartComponent } from './shared/price-chart.component';
import { SignedPercentPipe } from './shared/signed-percent.pipe';
import { TimeframeToggleComponent } from './shared/timeframe-toggle.component';

type HeaderDropdown = 'account' | 'market-clock' | 'profile';
type TickAnimation = {
  direction: 'gain' | 'loss';
  durationMs: number;
  revision: number;
};

// The account or cash dialog currently open over the dashboard, if any. An account dialog
// with an account renames it; without one it creates a new, empty account.
type AccountDialog =
  { kind: 'account'; account: Account | null } | { kind: 'cash'; mode: CashTransactionMode };

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

// User-wide cash movements and orders across the caller's owned accounts.
@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActivityRowComponent,
    AccountDialogComponent,
    AccountControlComponent,
    MarketClockControlComponent,
    CashTransactionDialogComponent,
    CurrencyPipe,
    OrderHistoryDialogComponent,
    TransactionsDialogComponent,
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
    MarketClockService,
    provideIcons({
      lucideCalendarClock,
      lucideCheck,
      lucideChevronDown,
      lucideLogOut,
      lucidePencil,
      lucidePiggyBank,
      lucidePlus,
      lucideSettings,
    }),
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnInit, OnDestroy {
  protected readonly clock = inject(MarketClockService);
  private readonly marketData = inject(MarketDataService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly document = inject(DOCUMENT);
  private readonly zone = inject(NgZone);
  private disconnectMarket?: () => void;
  private readonly tickAnimationTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly openingPrices = new Map<string, number>();
  private readonly assetChartSubscriptions = new Map<string, Subscription>();
  private marketGeneration = 0;
  private readonly _authService = inject(AuthService);
  private readonly _router = inject(Router);

  // Only ever the signed-in user's own accounts; see AccountStore. Each account's portfolio
  // is its holdings, and the user's cash is shared by all of them.
  protected readonly accountStore = inject(AccountStore);
  protected readonly orderService = inject(OrderService);
  private readonly recentOrderSubscriptions = new Subscription();
  protected readonly accounts = this.accountStore.accounts;
  protected readonly selectedAccount = this.accountStore.selectedAccount;
  protected readonly selectedAccountId = this.accountStore.selectedAccountId;
  private initialAccountRestored = false;
  private readonly restoreAccount = effect(() => {
    const id = Number(this._router.routerState.snapshot.root.firstChild?.queryParams['accountId']);
    if (this.accountStore.status() === 'ready' && !this.initialAccountRestored) {
      this.initialAccountRestored = true;
      if (id > 0) this.accountStore.selectAccount(id);
    }
  });
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
  protected readonly cashBalance = computed(() => {
    const at = this.marketTimeMillis();
    return at === null
      ? this.accountStore.cashBalance()
      : cashAt(this.accountStore.cashBalance(), this.orderService.orders(), at);
  });
  private readonly simulationHoldings = computed(() => {
    const at = this.marketTimeMillis();
    return new Map(
      [...this.accountStore.holdingsByAccount()].map(([accountId, current]) => [
        accountId,
        at === null
          ? current
          : holdingsAt(
              current,
              this.orderService.orders(),
              this.orderService.catalogue(),
              accountId,
              at,
            ),
      ]),
    );
  });
  // First and last initial of the signed-in user; empty until the profile loads.
  protected readonly profileInitials = this.accountStore.initials;
  protected readonly instruments = signal<Instrument[]>([]);
  protected readonly watchedInstruments = computed(() =>
    this.watchlist.entries().map((entry) => ({
      symbol: entry.symbol,
      instrument: this.instruments().find((instrument) => instrument.symbol === entry.symbol),
    })),
  );
  protected readonly portfolioTabs = [
    { id: 'assets', label: 'Assets' },
    { id: 'watchlist', label: 'Watch List' },
  ] as const;
  protected readonly assetsTab = signal<'assets' | 'watchlist'>('assets');
  protected refreshWatchlist(): void {
    this.watchlist.load(true).subscribe({ error: () => undefined });
  }
  protected readonly tickAnimations = signal(new Map<string, TickAnimation>());
  protected readonly portfolioTimeframe = signal<Timeframe>('1D');
  protected readonly marketSessionId = this.clock.marketSessionId;
  protected readonly currentMarketTimestamp = this.clock.currentMarketTimestamp;
  private readonly simulationClockRevision = signal(0);
  protected readonly assetCandlePoints = signal(new Map<string, PricePoint[]>());
  protected readonly marketCalendar = this.clock.marketCalendar;
  protected readonly marketDateTime = this.clock.marketDateTime;
  protected readonly clockError = this.clock.clockError;
  protected readonly clockUpdating = this.clock.clockUpdating;
  protected readonly marketClockLabel = this.clock.marketClockLabel;
  protected readonly settingsOpen = signal(false);
  protected readonly historyDialog = signal<'transactions' | 'orders' | null>(null);

  // Symbol currently open in the order submission dialog, if any.
  private readonly orderSymbol = signal<string | null>(null);
  protected readonly orderInstrument = computed(() => {
    const symbol = this.orderSymbol();
    return symbol ? (findInstrument(symbol, this.instruments()) ?? null) : null;
  });

  // The selected account's portfolio.
  protected readonly holdings = computed(() =>
    this.priceHoldings(this.simulationHoldings().get(this.selectedAccountId() ?? -1) ?? []),
  );

  protected readonly visibleAssets = computed(() =>
    this.holdings()
      .filter((holding) => holding.value !== 0)
      .sort((a, b) => a.symbol.localeCompare(b.symbol)),
  );

  // Only the symbols, so price ticks don't look like a change of holdings. Watched symbols
  // are included because the watch list shows the same daily chart as Assets.
  private readonly chartedSymbols = computed(() =>
    [
      ...new Set([
        ...this.accountStore.selectedHoldings().map((holding) => holding.symbol),
        ...this.watchlist.entries().map((entry) => entry.symbol),
      ]),
    ]
      .sort()
      .join(','),
  );

  // Value of each owned account's portfolio, keyed by account id.
  protected readonly portfolioValues = computed(() => {
    const values = new Map<number, number>();
    for (const [accountId, holdings] of this.simulationHoldings()) {
      values.set(accountId, totalValue(this.priceHoldings(holdings)));
    }
    return values;
  });

  // The latest 20 cash transfers and orders of any status, newest first. Orders after the
  // simulated clock are hidden, as they have not happened yet in the replay.
  protected readonly transactions = computed<ActivityItem[]>(() => {
    const cursor = this.marketTimeMillis();
    const catalogue = this.orderService.catalogue();
    const trades = this.orderService
      .orders()
      .filter((order) => {
        const at = Date.parse(orderDate(order));
        return Number.isFinite(at) && (cursor === null || at <= cursor);
      })
      .map((order) => orderActivity(order, catalogue));
    const cash = this.accountStore.cashTransactions().map(cashActivity);
    return [...cash, ...trades]
      .sort((a, b) => Date.parse(b.date) - Date.parse(a.date) || b.key.localeCompare(a.key))
      .slice(0, 20);
  });

  protected readonly positions = computed(() =>
    Object.fromEntries(this.holdings().map((holding) => [holding.symbol, holding.shares])),
  );

  // Replay changes the portfolio view, while orders spend the persisted balances.
  protected readonly tradingCashBalance = this.accountStore.cashBalance;
  protected readonly tradingPositions = computed(() =>
    Object.fromEntries(
      this.accountStore.selectedHoldings().map((holding) => [holding.symbol, holding.quantity]),
    ),
  );

  protected readonly marketTimeMillis = computed(() => {
    const time = Date.parse(this.currentMarketTimestamp());
    return Number.isNaN(time) ? null : time;
  });

  private readonly assetMinute = computed(() =>
    Math.floor((this.marketTimeMillis() ?? 0) / 60_000),
  );
  protected readonly assetCharts = computed<Record<string, PricePoint[]>>(() => {
    const candlesBySymbol = this.assetCandlePoints();
    const marketTime = this.marketTimeMillis();
    const prices = new Map<string, number>();
    for (const entry of this.watchedInstruments()) {
      if (entry.instrument) prices.set(entry.symbol, entry.instrument.price);
    }
    for (const holding of this.holdings()) prices.set(holding.symbol, holding.instrument.price);
    return Object.fromEntries(
      [...prices].map(([symbol, price]) => {
        const candles = candlesBySymbol.get(symbol);
        if (candles?.length) {
          if (marketTime !== null && marketTime < candles[candles.length - 1].time.getTime())
            return [symbol, candles];
          const points = [...candles];
          points[points.length - 1] = {
            time: new Date(marketTime ?? points[points.length - 1].time.getTime()),
            value: price,
          };
          return [symbol, points];
        }
        return [symbol, []];
      }),
    );
  });

  // The selected account's portfolio value.
  protected readonly portfolioValue = computed(() => totalValue(this.holdings()));
  protected readonly hasChartablePortfolioValue = computed(() => this.portfolioChart().length > 0);
  protected readonly portfolioChangePercent = computed(() => {
    // The range can begin before the first investment, with a synthetic zero baseline.
    const baseline = this.portfolioChart().find((point) => point.value > 0)?.value;
    return baseline && this.portfolioHistory.status() === 'ready'
      ? ((this.portfolioValue() - baseline) / baseline) * 100
      : null;
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

  protected readonly portfolioHistory = inject(PortfolioHistoryService);
  protected readonly portfolioChart = computed(() => {
    const points = this.portfolioHistory.points();
    const at = this.marketTimeMillis();
    if (at === null || !points.length) return points;
    return [
      ...points.filter((point) => point.time.getTime() < at),
      {
        time: new Date(at),
        value: this.portfolioValue(),
        transition: points.find((point) => point.time.getTime() === at)?.transition,
      },
    ];
  });
  protected readonly portfolioObservationInterval = computed(
    () =>
      ({ '1D': 60_000, '5D': 300_000, '1M': 3_600_000, '1Y': 86_400_000 })[
        this.portfolioTimeframe()
      ],
  );
  private readonly simulationMinute = computed(() => {
    const at = this.marketTimeMillis();
    return at === null ? null : Math.floor(at / 60_000);
  });
  private historyRefreshTimer?: ReturnType<typeof setInterval>;

  constructor() {
    // A pending order that fills moves cash and holdings on the backend without the user doing
    // anything, so reload them as a trade the user just made would.
    this.orderService.pendingFilled
      .pipe(takeUntilDestroyed())
      .subscribe((order) => this.refreshAfterFill(order.accountId ?? this.selectedAccountId()));
    effect(() => {
      const accountId = this.selectedAccountId();
      const timeframe = this.portfolioTimeframe();
      this.simulationClockRevision();
      const minute = this.simulationMinute();
      const sessionId = this.marketSessionId();
      const orders = this.orderService.orders();
      const catalogue = this.orderService.catalogue();
      const current = this.accountStore.holdingsByAccount().get(accountId ?? -1) ?? [];
      untracked(() =>
        this.portfolioHistory.select(
          accountId,
          timeframe,
          minute !== null && sessionId !== null && accountId !== null
            ? {
                accountId,
                at: Date.parse(this.currentMarketTimestamp()),
                sessionId,
                rangeSymbol: this.instruments()[0]?.symbol,
                quoteSymbols: this.instruments().map((instrument) => instrument.symbol),
                current,
                orders,
                catalogue,
              }
            : undefined,
        ),
      );
    });
    // Holdings arrive after the market snapshot and change with the selected account, so
    // load daily candles for any newly held symbol once there is a market session.
    effect(() => {
      this.chartedSymbols();
      this.assetMinute();
      this.marketData.revision?.();
      const sessionId = this.marketSessionId();
      if (sessionId !== null) {
        untracked(() => {
          this.clearAssetChartSubscriptions();
          this.loadAssetCharts(sessionId, this.marketGeneration);
        });
      }
    });
  }

  protected readonly watchlist = inject(WatchlistStore);

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.loadMarketSnapshot();
      this.watchlist.load(true).subscribe({ error: () => undefined });
      this.accountStore.load();
      this.loadRecentOrders();
      this.historyRefreshTimer = setInterval(() => this.portfolioHistory.refresh(), 60_000);
    }
  }

  ngOnDestroy(): void {
    this.recentOrderSubscriptions.unsubscribe();
    clearInterval(this.historyRefreshTimer);
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
    if (
      target instanceof Element &&
      target.closest('app-dashboard-header-dropdown, app-market-clock-control, app-account-control')
    ) {
      return;
    }
    this.openHeaderDropdown.set(null);
  }

  protected selectAccount(accountId: number): void {
    this.accountStore.selectAccount(accountId);
    this.openHeaderDropdown.set(null);
  }

  protected retryAccounts(): void {
    this.accountStore.load(true);
  }

  protected loadRecentOrders(): void {
    this.recentOrderSubscriptions.add(
      this.orderService.loadOrders().subscribe({ error: () => undefined }),
    );
    this.recentOrderSubscriptions.add(
      this.orderService.instruments().subscribe({ error: () => undefined }),
    );
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

  protected openHistory(dialog: 'transactions' | 'orders'): void {
    this.historyDialog.set(dialog);
  }

  protected closeHistory(): void {
    this.historyDialog.set(null);
  }

  // A row in a history table opens the order ticket for its stock, if the market lists it.
  protected openOrderForSymbol(symbol: string): void {
    const instrument = findInstrument(symbol, this.instruments());
    if (!instrument) return;
    this.closeHistory();
    this.openOrder(instrument);
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

  // The dialog owns the submission and stays open to show the outcome, so this only reacts
  // to what a trade changed. A rejection changed nothing, so there is nothing to reload.
  protected onOrderSubmitted(order: OrderResult): void {
    if (order.status !== 'FILLED') {
      return;
    }
    this.refreshAfterFill(this.accountStore.selectedAccountId());
  }

  private refreshAfterFill(accountId: number | null): void {
    if (accountId === null) {
      return;
    }
    this.accountStore.refreshAfterTrade(accountId).subscribe({
      next: () => this.portfolioHistory.afterTrade(accountId),
      error: () => this.portfolioHistory.afterTrade(accountId),
    });
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
    this.clock.applyMarketDateTime(
      value,
      (snapshot) => this.applySnapshot(snapshot),
      () => this.openHeaderDropdown.set(null),
    );
  }
  protected onClockSnapshot(snapshot: MarketSnapshot): void {
    this.applySnapshot(snapshot);
  }

  private loadMarketSnapshot(): void {
    this.recentOrderSubscriptions.add(
      this.marketData.snapshot().subscribe({
        next: (snapshot) => this.applySnapshot(snapshot),
        error: () => undefined,
      }),
    );
  }

  private applySnapshot(snapshot: MarketSnapshot): void {
    this.disconnectMarket?.();
    if (this.marketSessionId() !== snapshot.sessionId) this.assetCandlePoints.set(new Map());
    this.clearAssetChartSubscriptions();
    this.clearQueuedUpdates();
    this.marketGeneration++;
    this.simulationClockRevision.update((value) => value + 1);
    this.marketSessionId.set(snapshot.sessionId);
    this.currentMarketTimestamp.set(snapshot.marketTimestamp);
    this.clock.sync(snapshot);
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
    const symbols = new Set([
      ...this.holdings().map((holding) => holding.symbol),
      ...this.watchlist.entries().map((entry) => entry.symbol),
    ]);
    for (const symbol of symbols) {
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
  }

  private queueTickBatch(event: MarketTickEvent): void {
    if (this.document.hidden) {
      return;
    }
    this.zone.run(() => {
      this.currentMarketTimestamp.set(event.marketTimestamp);
      for (const tick of event.prices) this.applyTick(tick.symbol, tick.price);
    });
  }

  private applyTick(symbol: string, price: number): void {
    const previousPrice = this.instruments().find((stock) => stock.symbol === symbol)?.price;
    this.instruments.update((stocks) =>
      stocks.map((stock) => {
        if (stock.symbol !== symbol) return stock;
        const open = this.openingPrices.get(symbol) ?? price;
        const change = price - open;
        return { ...stock, price, change, changePercent: open ? (change / open) * 100 : 0 };
      }),
    );
    if (previousPrice !== undefined && previousPrice !== price) {
      this.animateTick(symbol, price > previousPrice ? 'gain' : 'loss');
    }
  }

  private clearQueuedUpdates(): void {
    this.tickAnimationTimers.forEach(clearTimeout);
    this.tickAnimationTimers.clear();
    this.tickAnimations.set(new Map());
  }

  private animateTick(symbol: string, direction: TickAnimation['direction']): void {
    const existingTimer = this.tickAnimationTimers.get(symbol);
    if (existingTimer) clearTimeout(existingTimer);
    const durationMs = 500 + Math.floor(Math.random() * 501);
    this.tickAnimations.update((animations) => {
      const next = new Map(animations);
      const revision = (next.get(symbol)?.revision ?? 0) + 1;
      next.set(symbol, { direction, durationMs, revision });
      return next;
    });
    const timer = setTimeout(() => {
      this.tickAnimationTimers.delete(symbol);
      this.tickAnimations.update((animations) => {
        const next = new Map(animations);
        next.delete(symbol);
        return next;
      });
    }, durationMs);
    this.tickAnimationTimers.set(symbol, timer);
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
