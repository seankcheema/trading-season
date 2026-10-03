import { ActivityItem, ActivityRowComponent } from './shared/activity-row.component';
import { AccountControlComponent } from './shared/account-control.component';
import { MarketClockControlComponent } from './shared/market-clock-control.component';
import { MarketClockService } from './shared/market-clock.service';
import { cashAt, executionTime, holdingsAt } from './accounts/simulation-account';
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
  lucideBriefcaseBusiness,
  lucideCalendarClock,
  lucideCheck,
  lucideChevronDown,
  lucideLogOut,
  lucidePencil,
  lucidePiggyBank,
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
  PricePoint,
  Timeframe,
  findInstrument,
  mockPriceSeries,
} from './mock-data';
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

// User-wide cash movements and successful executions across the caller's owned accounts.
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
    MarketClockService,
    PortfolioHistoryService,
    OrderService,
    provideIcons({
      lucideBriefcaseBusiness,
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
  protected readonly instruments = signal<Instrument[]>([...MOCK_INSTRUMENTS]);
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
    this.holdings().filter((holding) => holding.value !== 0),
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
    for (const [accountId, holdings] of this.simulationHoldings()) {
      values.set(accountId, totalValue(this.priceHoldings(holdings)));
    }
    return values;
  });

  protected readonly transactions = computed<ActivityItem[]>(() => {
    const cash: ActivityItem[] = this.accountStore.cashTransactions().map((transaction) => ({
      kind: 'cash' as const,
      key: `cash-${transaction.cashTransactionId}`,
      date: transaction.createdAt,
      reason: transaction.reason,
      value: transaction.amount,
      label: 'Cash',
      detail: 'Cash transfer',
      positive: transaction.reason === 'DEPOSIT',
    }));
    const catalogue = new Map(
      this.orderService.catalogue().map((instrument) => [instrument.instrumentId, instrument]),
    );
    const trades: ActivityItem[] = this.orderService
      .orders()
      .filter(
        (order) =>
          order.status === 'FILLED' &&
          order.resolvedAt !== null &&
          (this.marketTimeMillis() === null || executionTime(order) <= this.marketTimeMillis()!),
      )
      .map((order) => {
        const instrument =
          order.instrumentId === undefined ? undefined : catalogue.get(order.instrumentId);
        return {
          kind: 'trade',
          key: `order-${order.orderId}`,
          date:
            order.simulatedAt && Number.isFinite(Date.parse(order.simulatedAt))
              ? order.simulatedAt
              : order.resolvedAt!,
          reason: order.orderType,
          value: order.quantity * order.indicativePrice,
          label:
            instrument?.simulatedStockSymbol ?? instrument?.ticker ?? `Order #${order.orderId}`,
          detail: `${order.quantity} ${order.quantity === 1 ? 'share' : 'shares'} · Filled`,
          positive: order.orderType === 'SELL',
        };
      });
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
          mockPriceSeries(holding.symbol, '1D', holding.instrument.price, marketTime ?? undefined),
        ];
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
    this.accountStore.load();
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
    const accountId = this.accountStore.selectedAccountId();
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
