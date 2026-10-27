import { OrderEditorComponent } from '../dashboard/shared/order-editor.component';
import { WatchlistStore } from '../dashboard/watchlist/watchlist-store.service';
import { WatchlistStarComponent } from '../dashboard/watchlist/watchlist-star.component';
import { DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AccountStore } from '../dashboard/accounts/account-store.service';
import { Account } from '../dashboard/accounts/account.models';
import { AccountDialogComponent } from '../dashboard/accounts/account-dialog.component';
import { cashAt, holdingsAt, executionTime } from '../dashboard/accounts/simulation-account';
import { OrderService } from '../dashboard/orders/order.service';
import { OrderResult } from '../dashboard/orders/order.models';
import { toOrderErrorMessage } from '../dashboard/orders/order-error';
import { DuaSpeech } from '../dua/dua-speech.service';
import { AuthService } from '../core/auth/auth.service';
import { ThemeToggleComponent } from '../core/theme/theme-toggle.component';
import { DashboardHeaderDropdownComponent } from '../dashboard/shared/dashboard-header-dropdown.component';
import { SettingsDialogComponent } from '../dashboard/settings-dialog/settings-dialog.component';
import { TermsDialogComponent } from '../dashboard/terms/terms-dialog.component';
import { AccountControlComponent } from '../dashboard/shared/account-control.component';
import { MarketClockControlComponent } from '../dashboard/shared/market-clock-control.component';
import { MarketClockService } from '../dashboard/shared/market-clock.service';

import { DuaComponent } from '../dua/dua.component';
import { ForecastPanelComponent } from './forecast-panel/forecast-panel.component';
import {
  ActivityItem,
  ActivityRowComponent,
  ActivityRowSkeletonComponent,
} from '../dashboard/shared/activity-row.component';
import { orderActivity } from '../dashboard/shared/activity';
import { TradeTicketDraft } from '../dashboard/shared/trade-ticket.component';
import {
  NgTemplateOutlet,
  CurrencyPipe,
  DecimalPipe,
  isPlatformBrowser,
  TitleCasePipe,
} from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  Injector,
  NgZone,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideActivity,
  lucideSettings,
  lucideLogOut,
  lucideChevronDown,
  lucideChevronLeft,
  lucideChevronRight,
  lucideChartArea,
  lucideChartBar,
  lucideChartCandlestick,
  lucideChartLine,
  lucideChartNoAxesColumn,
  lucideCrosshair,
  lucidePanelRightClose,
  lucidePanelRightOpen,
  lucideGitCompare,
  lucidePercent,
  lucideSlidersHorizontal,
  lucideUserRound,
  lucideX,
  lucideBell,
  lucideBotMessageSquare,
  lucideMessageSquareText,
  lucideSendHorizontal,
  lucideShieldCheck,
  lucideTrendingUp,
  lucideUsersRound,
} from '@ng-icons/lucide';
import { Subscription } from 'rxjs';
import { Instrument, Timeframe, findInstrument } from '../dashboard/mock-data';
import {
  MarketDataService,
  MarketSnapshot,
  MarketTickEvent,
} from '../dashboard/market-data.service';
import { InstrumentSearchComponent } from '../dashboard/shared/instrument-search.component';
import {
  applyLiveCandlePrice,
  ChartMode,
  closePricePoints,
  MarketCandlePoint,
  TECHNICAL_INDICATOR_PERIODS,
  TechnicalIndicator,
  marketCandlePoints,
  marketSymbolSlug,
  normalizeMarketSymbol,
} from '../dashboard/shared/market-chart.models';
import { PriceChartComponent } from '../dashboard/shared/price-chart.component';
import { SignedPercentPipe } from '../dashboard/shared/signed-percent.pipe';
import { TickAnimations } from '../dashboard/shared/tick-animations';
import { TimeframeToggleComponent } from '../dashboard/shared/timeframe-toggle.component';
import { TradeTicketComponent } from '../dashboard/shared/trade-ticket.component';
import { DuaEmptyComponent } from '../dua/dua-empty.component';

type PageStatus = 'loading' | 'ready' | 'not-found' | 'error';
type ChartStatus = 'loading' | 'ready' | 'empty' | 'error';

type InsightTab = 'trading' | 'recent-orders' | 'forecast';

type ToolbarMenu = 'indicators' | 'chart-mode' | 'comparison';

interface MarketStats {
  bid: number;
  ask: number;
  spread: number;
  open: number;
  low: number;
  high: number;
  trend: 'Uptrend' | 'Downtrend';
}

@Component({
  selector: 'app-market-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DuaEmptyComponent,
    ThemeToggleComponent,
    DuaComponent,
    ForecastPanelComponent,
    TitleCasePipe,
    NgTemplateOutlet,
    OrderEditorComponent,
    WatchlistStarComponent,
    DashboardHeaderDropdownComponent,
    SettingsDialogComponent,
    AccountControlComponent,

    AccountDialogComponent,

    MarketClockControlComponent,

    ActivityRowComponent,
    ActivityRowSkeletonComponent,

    CurrencyPipe,
    DecimalPipe,
    InstrumentSearchComponent,
    NgIcon,
    PriceChartComponent,
    RouterLink,
    SignedPercentPipe,
    TimeframeToggleComponent,
    TradeTicketComponent,
    TermsDialogComponent,
  ],
  providers: [
    MarketClockService,

    provideIcons({
      lucideActivity,
      lucideSettings,
      lucideLogOut,
      lucideChevronDown,
      lucideChevronLeft,
      lucideChevronRight,
      lucideChartArea,
      lucideChartBar,
      lucideChartCandlestick,
      lucideChartLine,
      lucideChartNoAxesColumn,
      lucideCrosshair,
      lucidePanelRightClose,
      lucidePanelRightOpen,
      lucideGitCompare,
      lucidePercent,
      lucideSlidersHorizontal,
      lucideUserRound,
      lucideX,
      lucideBell,
      lucideBotMessageSquare,
      lucideMessageSquareText,
      lucideSendHorizontal,
      lucideShieldCheck,
      lucideTrendingUp,
      lucideUsersRound,
    }),
  ],
  templateUrl: './market-page.component.html',
  styleUrl: './market-page.component.css',
})
export class MarketPageComponent implements OnInit, OnDestroy {
  private readonly marketData = inject(MarketDataService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly zone = inject(NgZone);
  private readonly platformId = inject(PLATFORM_ID);
  private routeSubscription?: Subscription;
  private disconnectMarket?: () => void;
  private readonly openingPrices = new Map<string, number>();
  private readonly tickAnimator = new TickAnimations();
  protected readonly accountStore = inject(AccountStore);

  protected readonly orders = inject(OrderService);
  protected readonly clock = inject(MarketClockService);

  // Dua says each order's outcome in its speech bubble.
  private readonly speech = inject(DuaSpeech);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly openHeaderDropdown = signal<'account' | 'profile' | null>(null);
  protected readonly profileInitials = this.accountStore.initials;
  protected readonly settingsOpen = signal(false);

  protected onSettings(): void {
    this.openHeaderDropdown.set(null);
    this.settingsOpen.set(true);
  }

  protected onSignOut(): void {
    this.openHeaderDropdown.set(null);
    this.authService.logout().subscribe(() => void this.router.navigateByUrl('/login'));
  }
  protected readonly accountDialog = signal<{ account: Account | null } | null>(null);

  // This page has its own order ticket, so it asks for the platform terms exactly as the
  // dashboard does: the page is inert behind the terms dialog until they are accepted.
  protected readonly termsRequired = this.accountStore.needsTermsAcceptance;
  protected readonly termsSignatureName = this.accountStore.fullName;
  // The profile can arrive after the user has already opened something; nothing may stay open
  // beside the terms dialog.
  private readonly closeDialogsForTerms = effect(() => {
    if (!this.termsRequired()) {
      return;
    }
    untracked(() => {
      this.openHeaderDropdown.set(null);
      this.settingsOpen.set(false);
      this.accountDialog.set(null);
    });
  });

  protected readonly submitting = signal(false);
  protected readonly refreshing = signal(false);

  private readonly coolingDown = signal(false);
  private cooldownTimer?: ReturnType<typeof setTimeout>;

  protected readonly orderMessage = signal('');
  protected readonly orderError = signal('');

  protected readonly refreshAccountId = signal<number | null>(null);
  protected readonly catalogueStatus = signal<'loading' | 'ready' | 'error'>('loading');

  // Balances are on their way: the account box shows placeholders, not a dash.
  protected readonly accountsLoading = computed(
    () => this.accountStore.status() === 'idle' || this.accountStore.status() === 'loading',
  );
  // How many placeholder rows a list shows while it loads.
  protected readonly skeletonRows = [1, 2, 3, 4, 5] as const;

  protected readonly busy = computed(
    () => this.submitting() || this.coolingDown() || this.refreshing(),
  );

  private readonly dataReady = computed(
    () =>
      this.accountStore.status() === 'ready' &&
      this.orders.historyStatus() === 'ready' &&
      this.catalogueStatus() === 'ready' &&
      this.pageStatus() === 'ready',
  );

  protected readonly tradeReady = computed(
    () =>
      this.dataReady() &&
      this.accountStore.selectedAccountId() !== null &&
      !this.clock.clockUpdating() &&
      this.refreshAccountId() === null,
  );

  private readonly simulationTime = computed(() => {
    const at = Date.parse(this.marketTimestamp());
    return Number.isFinite(at) ? at : null;
  });

  protected readonly simulationHoldings = computed(
    () =>
      new Map(
        [...this.accountStore.holdingsByAccount()].map(([id, current]) => [
          id,
          this.simulationTime() === null
            ? current
            : holdingsAt(
                current,
                this.orders.orders(),
                this.orders.catalogue(),
                id,
                this.simulationTime()!,
              ),
        ]),
      ),
  );

  protected readonly cashBalance = computed(() =>
    this.simulationTime() === null
      ? this.accountStore.cashBalance()
      : cashAt(this.accountStore.cashBalance(), this.orders.orders(), this.simulationTime()!),
  );

  // Trading balances include every completed fill, regardless of the replay cursor.
  protected readonly tradingCashBalance = this.accountStore.spendableFunds;
  private readonly tradeTicket = viewChild(TradeTicketComponent);
  protected readonly availableCash = computed(() => {
    const draft = this.tradeTicket()?.draft();
    return draft?.side === 'buy'
      ? Math.max(
          0,
          this.cashBalance() -
            (draft.reservationPrice
              ? draft.quantity * draft.reservationPrice
              : draft.estimatedValue),
        )
      : this.cashBalance();
  });
  protected readonly heldShares = computed(() =>
    ((holding) => holding?.availableQuantity ?? holding?.quantity ?? 0)(
      this.accountStore.selectedHoldings().find((h) => h.symbol === this.symbol()),
    ),
  );

  protected readonly portfolioValues = computed(
    () =>
      new Map(
        [...this.simulationHoldings()].map(([id, holdings]) => [
          id,
          holdings.reduce(
            (sum, h) =>
              sum +
              h.quantity * (findInstrument(h.symbol, this.instruments())?.price ?? h.averageCost),
            0,
          ),
        ]),
      ),
  );

  protected readonly recentOrders = computed<ActivityItem[]>(() =>
    this.orders
      .orders()

      .filter((order) => order.accountId === this.accountStore.selectedAccountId())

      .map((order) => ({
        order,
        at: Number.isFinite(executionTime(order))
          ? executionTime(order)
          : Date.parse(order.submittedAt),
      }))

      .filter(
        ({ at }) =>
          Number.isFinite(at) && (this.simulationTime() === null || at <= this.simulationTime()!),
      )

      .sort((a, b) => b.at - a.at || b.order.orderId - a.order.orderId)
      .slice(0, 20)

      .map(({ order, at }) => ({
        ...orderActivity(order, this.orders.catalogue()),
        date: new Date(at).toISOString(),
      })),
  );

  private readonly resetOutcome = effect(() => {
    this.symbol();
    this.accountStore.selectedAccountId();
    this.orderMessage.set('');
    this.orderError.set('');
  });

  protected loadTradingData(): void {
    this.orders
      .loadOrders()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ error: () => undefined });

    this.catalogueStatus.set('loading');

    this.orders
      .instruments()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.catalogueStatus.set('ready'),
        error: () => this.catalogueStatus.set('error'),
      });
  }

  // The store keeps the choice for the dashboard and this tab; the URL never carries it.
  protected selectAccount(id: number): void {
    if (this.accountStore.selectAccount(id)) {
      this.openHeaderDropdown.set(null);
    }
  }

  protected openCreateAccount(): void {
    this.openHeaderDropdown.set(null);
    this.accountDialog.set({ account: null });
  }

  protected openRenameAccount(account: Account): void {
    if (this.accountStore.isOwnedAccount(account.accountId)) {
      this.openHeaderDropdown.set(null);
      this.accountDialog.set({ account });
    }
  }

  protected onAccountSaved(account: Account): void {
    this.accountDialog.set(null);
    this.selectAccount(this.accountStore.selectedAccountId() ?? account.accountId);
  }
  protected onClockSnapshot(snapshot: MarketSnapshot): void {
    this.disconnectMarket?.();
    this.clearTickAnimations();
    this.applySnapshot(snapshot);
  }

  protected submitOrder(draft: TradeTicketDraft): void {
    const accountId = Number(draft.accountId);

    const validDraft =
      Number.isInteger(draft.quantity) && draft.quantity > 0 && draft.symbol === this.symbol();
    if (
      !this.tradeReady() ||
      this.busy() ||
      !this.accountStore.isOwnedAccount(accountId) ||
      !validDraft
    ) {
      return;
    }

    const price = this.instrument()?.price ?? 0;

    const maximum =
      draft.side === 'buy'
        ? Math.floor(this.tradingCashBalance() / (draft.reservationPrice ?? price))
        : Math.floor(this.heldShares());

    if (!Number.isFinite(price) || price <= 0 || draft.quantity > maximum) {
      return;
    }

    const simulated = this.marketTimestamp();

    this.submitting.set(true);
    this.coolingDown.set(true);

    this.cooldownTimer = setTimeout(() => this.coolingDown.set(false), 1000);

    this.orderMessage.set('');
    this.orderError.set('');

    this.orders
      .submitOrder({
        accountId,
        symbol: draft.symbol,
        orderType: draft.side === 'buy' ? 'BUY' : 'SELL',
        executionType: draft.executionType,
        limitPrice: draft.limitPrice,
        stopPrice: draft.stopPrice,
        ...(draft.sessionId !== null ? { sessionId: draft.sessionId } : {}),
        quantity: draft.quantity,
        indicativePrice: price,
        simulatedAt: Number.isFinite(Date.parse(simulated))
          ? new Date(simulated).toISOString()
          : undefined,
      })

      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result: OrderResult) => {
          this.submitting.set(false);

          if (result.status === 'FILLED') {
            const message = `Filled ${result.quantity} ${draft.symbol} at ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(result.executionPrice ?? result.indicativePrice)}.`;

            this.speech.say(message);
            this.refreshBalances(accountId);
          } else if (result.status === 'REJECTED') {
            const message = `Rejected: ${result.rejectionReason ?? 'The order was rejected.'}`;
            this.orderError.set(message);
            this.speech.say(message, 'error');
          } else {
            this.refreshBalances(accountId);
            const type = (draft.executionType ?? 'MARKET').replaceAll('_', '-').toLowerCase();
            this.speech.say(
              `${type.charAt(0).toUpperCase() + type.slice(1)} ${draft.side} order placed for ${result.quantity} ${draft.symbol}.`,
            );
          }
        },
        error: (error: unknown) => {
          this.submitting.set(false);
          const message = toOrderErrorMessage(error);
          this.orderError.set(message);
          this.speech.say(message, 'error');
        },
      });
  }

  protected retryBalances(): void {
    const id = this.refreshAccountId();
    if (id !== null) {
      this.refreshBalances(id);
    }
  }

  private refreshBalances(id: number): void {
    this.refreshing.set(true);

    this.accountStore
      .refreshAfterTrade(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.refreshing.set(false);
          this.refreshAccountId.set(null);
          this.orderError.set('');
        },
        error: () => {
          this.refreshing.set(false);
          this.refreshAccountId.set(id);
          this.orderError.set('Order filled, but balances could not be refreshed.');
        },
      });
  }

  protected readonly symbol = signal('');
  protected readonly tickAnimations = this.tickAnimator.current;
  protected readonly instruments = signal<Instrument[]>([]);
  protected readonly instrument = computed(
    () => findInstrument(this.symbol(), this.instruments()) ?? null,
  );
  protected readonly comparisonSymbol = signal('');
  protected readonly comparisonInstrument = computed(
    () => findInstrument(this.comparisonSymbol(), this.instruments()) ?? null,
  );
  protected readonly comparisonInstruments = computed(() =>
    this.instruments().filter((instrument) => instrument.symbol !== this.symbol()),
  );
  protected readonly sessionId = signal<number | null>(null);
  protected readonly marketTimestamp = signal('');
  protected readonly connected = signal(false);
  protected readonly pageStatus = signal<PageStatus>('loading');
  protected readonly chartStatus = signal<ChartStatus>('loading');
  protected readonly comparisonChartStatus = signal<ChartStatus>('loading');
  protected readonly timeframe = signal<Timeframe>('1D');
  protected readonly chartMode = signal<ChartMode>('area');
  protected readonly chartModes = [
    { value: 'line', label: 'Line', icon: 'lucideChartLine' },
    { value: 'area', label: 'Area', icon: 'lucideChartArea' },
    { value: 'candles', label: 'Candles', icon: 'lucideChartCandlestick' },
    { value: 'ohlc', label: 'OHLC', icon: 'lucideChartBar' },
    { value: 'volume', label: 'Volume', icon: 'lucideChartNoAxesColumn' },
    { value: 'percent', label: 'Percent', icon: 'lucidePercent' },
  ] as const satisfies readonly { value: ChartMode; label: string; icon: string }[];
  protected readonly selectedChartMode = computed(
    () => this.chartModes.find((option) => option.value === this.chartMode()) ?? this.chartModes[0],
  );
  protected readonly liveTailing = signal(true);
  protected readonly duaOutlook = signal(false);
  protected readonly insightTab = signal<InsightTab>('trading');
  protected readonly toolsCollapsed = signal(false);
  // The market tools' Forecast tab, chosen there, by the chart's Forecast button or by
  // ?forecast=open. The button reads as pressed while the tab shows; pressed again, it returns to
  // the tab before, and hides the tools again if opening the forecast had to show them.
  protected readonly forecastOpen = computed(
    () => this.insightTab() === 'forecast' && !this.toolsCollapsed(),
  );
  private forecastFromLink = false;
  private tabBeforeForecast: InsightTab = 'trading';
  private forecastShowedTools = false;
  protected readonly openToolbarMenu = signal<ToolbarMenu | null>(null);
  protected readonly enabledIndicators = signal<readonly TechnicalIndicator[]>([]);
  protected readonly indicatorOptions = [
    { value: 'sma', label: 'SMA', period: TECHNICAL_INDICATOR_PERIODS.sma, detail: '' },
    { value: 'ema', label: 'EMA', period: TECHNICAL_INDICATOR_PERIODS.ema, detail: '' },
    {
      value: 'bollinger',
      label: 'Bollinger Bands',
      period: TECHNICAL_INDICATOR_PERIODS.bollinger,
      detail: ' · 2σ',
    },
    { value: 'rsi', label: 'RSI', period: TECHNICAL_INDICATOR_PERIODS.rsi, detail: '' },
  ] as const satisfies readonly {
    value: TechnicalIndicator;
    label: string;
    period: number;
    detail: string;
  }[];
  protected readonly indicatorPickerOpen = computed(() => this.openToolbarMenu() === 'indicators');
  protected readonly rsiEnabled = computed(() => this.enabledIndicators().includes('rsi'));
  protected readonly comparisonPickerOpen = computed(() => this.openToolbarMenu() === 'comparison');
  protected readonly chartModePickerOpen = computed(() => this.openToolbarMenu() === 'chart-mode');
  protected readonly candleRevision = signal(0);
  private readonly candles = signal<MarketCandlePoint[]>([]);
  private readonly comparisonCandles = signal<MarketCandlePoint[]>([]);
  protected readonly chartCandles = computed(() => {
    const instrument = this.instrument();
    if ((this.candles().at(-1)?.time.getTime() ?? -Infinity) > Date.parse(this.marketTimestamp())) {
      return this.candles();
    }
    return instrument
      ? applyLiveCandlePrice(this.candles(), instrument.price, this.marketTimestamp())
      : [];
  });
  protected readonly chartPoints = computed(() => closePricePoints(this.chartCandles()));
  protected readonly rangeVolume = computed(() =>
    this.candles().reduce((total, point) => total + (point.volume ?? 0), 0),
  );
  protected readonly comparisonRangeVolume = computed(() =>
    this.comparisonCandles().reduce((total, point) => total + (point.volume ?? 0), 0),
  );
  protected readonly marketStats = computed(() =>
    this.calculateMarketStats(this.instrument(), this.candles()),
  );
  protected readonly comparisonMarketStats = computed(() =>
    this.calculateMarketStats(this.comparisonInstrument(), this.comparisonCandles()),
  );
  protected readonly comparisonChartCandles = computed(() => {
    const instrument = this.comparisonInstrument();
    if (
      (this.comparisonCandles().at(-1)?.time.getTime() ?? -Infinity) >
      Date.parse(this.marketTimestamp())
    ) {
      return this.comparisonCandles();
    }
    return instrument
      ? applyLiveCandlePrice(this.comparisonCandles(), instrument.price, this.marketTimestamp())
      : [];
  });
  protected readonly comparisonChartPoints = computed(() =>
    closePricePoints(this.comparisonChartCandles()),
  );
  protected readonly mockDetails = computed(() => {
    return {
      marketCap: '$3.42T',
    } as const;
  });
  protected readonly chartRefreshing = signal(false);
  protected readonly chartRefreshError = signal('');
  protected readonly chartTimeframe = signal<Timeframe>('1D');
  protected readonly comparisonTimeframe = signal<Timeframe>('1D');
  private chartContext = '';
  private comparisonContext = '';
  private readonly candleMinute = computed(() => this.marketTimestamp().slice(0, 16));
  private readonly candleLoader = effect((onCleanup) => {
    const sessionId = this.sessionId();
    const symbol = this.symbol();
    const timeframe = this.timeframe();
    this.candleRevision();
    this.candleMinute();
    this.marketData.revision?.();
    if (sessionId === null || !symbol || this.pageStatus() !== 'ready') {
      return;
    }
    const context = `${sessionId}:${symbol}`;
    if (context !== this.chartContext) {
      this.candles.set([]);
      this.chartContext = context;
      this.chartStatus.set('loading');
    }
    this.chartRefreshing.set(true);
    this.chartRefreshError.set('');
    const subscription = this.marketData.candles(sessionId, symbol, timeframe).subscribe({
      next: (series) => {
        const points = marketCandlePoints(series.points);
        this.candles.set(points);
        this.chartTimeframe.set(timeframe);
        this.chartRefreshing.set(false);
        this.chartStatus.set(points.length ? 'ready' : 'empty');
      },
      error: () => {
        this.chartRefreshing.set(false);
        this.chartRefreshError.set('Chart data could not refresh.');
        if (!this.candles().length) {
          this.chartStatus.set('error');
        }
      },
    });
    onCleanup(() => subscription.unsubscribe());
  });
  private readonly comparisonCandleLoader = effect((onCleanup) => {
    const sessionId = this.sessionId();
    const symbol = this.comparisonSymbol();
    const timeframe = this.timeframe();
    this.candleRevision();
    this.candleMinute();
    this.marketData.revision?.();
    if (sessionId === null || !symbol || this.pageStatus() !== 'ready') {
      this.comparisonCandles.set([]);
      this.comparisonChartStatus.set('loading');
      return;
    }
    const context = `${sessionId}:${symbol}`;
    if (context !== this.comparisonContext) {
      this.comparisonCandles.set([]);
      this.comparisonContext = context;
      this.comparisonChartStatus.set('loading');
    }
    const subscription = this.marketData.candles(sessionId, symbol, timeframe).subscribe({
      next: (series) => {
        const points = marketCandlePoints(series.points);
        this.comparisonCandles.set(points);
        this.comparisonTimeframe.set(timeframe);
        this.comparisonChartStatus.set(points.length ? 'ready' : 'empty');
      },
      error: () => {
        this.chartRefreshError.set('Comparison chart could not refresh.');
        if (!this.comparisonCandles().length) {
          this.comparisonChartStatus.set('error');
        }
      },
    });
    onCleanup(() => subscription.unsubscribe());
  });

  protected readonly watchlist = inject(WatchlistStore);

  ngOnInit(): void {
    this.orders.pendingResolved.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((order) => {
      const accountId = order.accountId ?? this.accountStore.selectedAccountId();
      if (accountId !== null) {
        this.refreshBalances(accountId);
      }
      if (order.status === 'REJECTED') {
        this.speech.say(order.rejectionReason ?? 'Order rejected.', 'error');
      }
    });
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.watchlist.load(true).subscribe({ error: () => undefined });
    this.accountStore.load();

    this.loadTradingData();

    this.routeSubscription = new Subscription();
    this.routeSubscription.add(
      this.route.paramMap.subscribe((params) => {
        const rawSymbol = params.get('symbol') ?? '';
        const symbol = normalizeMarketSymbol(rawSymbol);
        const canonicalSlug = marketSymbolSlug(symbol);
        if (rawSymbol !== canonicalSlug) {
          void this.router.navigate(['/dashboard/markets', canonicalSlug], {
            queryParamsHandling: 'preserve',
            replaceUrl: true,
          });
          return;
        }
        this.symbol.set(symbol);
        this.timeframe.set('1D');
        this.loadSnapshot();
      }),
    );
    this.routeSubscription.add(
      this.route.queryParamMap.subscribe((params) => {
        // A tab name in the query opens that tool, so a link can land on the Outlook card.
        if (params.get('tab') === 'outlook') {
          this.duaOutlook.set(true);
        }
        if (params.get('forecast') === 'open') {
          this.forecastFromLink = true;
          this.openForecast();
        }
        const rawSymbol = params.get('compare') ?? '';
        const symbol = normalizeMarketSymbol(rawSymbol);
        this.comparisonSymbol.set(symbol);
        this.openToolbarMenu.set(null);
        if (rawSymbol && rawSymbol !== marketSymbolSlug(symbol)) {
          this.updateComparisonQuery(symbol, true);
          return;
        }
        if (this.pageStatus() === 'ready') {
          this.validateComparison();
        }
      }),
    );
  }

  ngOnDestroy(): void {
    clearTimeout(this.cooldownTimer);

    this.routeSubscription?.unsubscribe();
    this.disconnectMarket?.();
    this.clearTickAnimations();
  }

  protected retry(): void {
    this.loadSnapshot();
  }

  protected selectInstrument(instrument: Instrument): void {
    const compare = this.comparisonSymbol();
    void this.router.navigate(['/dashboard/markets', marketSymbolSlug(instrument.symbol)], {
      queryParams: {
        compare: compare && compare !== instrument.symbol ? marketSymbolSlug(compare) : null,
        accountId: this.accountStore.selectedAccountId(),
      },
      queryParamsHandling: 'merge',
    });
  }

  protected selectComparison(instrument: Instrument): void {
    if (
      instrument.symbol === this.symbol() ||
      !findInstrument(instrument.symbol, this.comparisonInstruments())
    ) {
      return;
    }
    this.openToolbarMenu.set(null);
    this.updateComparisonQuery(instrument.symbol);
  }

  protected removeComparison(): void {
    this.openToolbarMenu.set(null);
    this.updateComparisonQuery('');
  }

  protected selectChartMode(mode: ChartMode): void {
    this.chartMode.set(mode);
    this.openToolbarMenu.set(null);
  }

  private readonly menuHost = inject(ElementRef<HTMLElement>);

  private readonly injector = inject(Injector);

  protected selectTab(tab: InsightTab): void {
    const current = this.insightTab();
    if (tab === current) {
      return;
    }
    if (tab === 'forecast') {
      this.tabBeforeForecast = current;
    } else if (current === 'forecast') {
      this.leaveForecast();
    }
    this.insightTab.set(tab);
  }

  protected toggleForecast(): void {
    if (!this.forecastOpen()) {
      this.openForecast();
      return;
    }
    const hideTools = this.forecastShowedTools;
    this.selectTab(this.tabBeforeForecast);
    if (hideTools) {
      this.toolsCollapsed.set(true);
    }
  }

  private openForecast(): void {
    this.forecastShowedTools = this.toolsCollapsed();
    this.toolsCollapsed.set(false);
    this.selectTab('forecast');
    // Where the tools stack under the chart on smaller screens, the tab is brought into view.
    afterNextRender(
      () =>
        this.menuHost.nativeElement
          .querySelector('.insight-panel')
          ?.scrollIntoView?.({ block: 'nearest' }),
      { injector: this.injector },
    );
  }

  // Leaving the Forecast tab drops ?forecast=open, so the same link can open it again later.
  private leaveForecast(): void {
    this.forecastShowedTools = false;
    if (!this.forecastFromLink) {
      return;
    }
    this.forecastFromLink = false;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { forecast: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
  protected readonly toolbarMenuPosition = signal({ left: 0, top: 0 });

  @HostListener('window:resize')
  protected positionToolbarMenu(): void {
    const menu = this.openToolbarMenu();
    let id: string;
    if (menu === 'indicators') {
      id = 'indicator-picker';
    } else if (menu === 'chart-mode') {
      id = 'chart-mode-picker';
    } else {
      id = 'comparison-picker';
    }
    const toolbar = this.menuHost.nativeElement.querySelector('.chart-toolbar');
    const trigger = toolbar?.querySelector(`[aria-controls="${id}"]`);
    if (!menu || !toolbar || !trigger) {
      return;
    }
    const frame = toolbar.getBoundingClientRect();
    const button = trigger.getBoundingClientRect();
    this.toolbarMenuPosition.set({
      left: Math.max(0, button.left - frame.left),
      top: button.bottom - frame.top + 8,
    });
  }

  protected toggleToolbarMenu(menu: ToolbarMenu): void {
    this.openToolbarMenu.update((open) => (open === menu ? null : menu));
    this.positionToolbarMenu();
  }

  protected toggleIndicator(indicator: TechnicalIndicator): void {
    this.enabledIndicators.update((enabled) =>
      enabled.includes(indicator)
        ? enabled.filter((candidate) => candidate !== indicator)
        : [...enabled, indicator],
    );
  }

  @HostListener('document:click', ['$event'])
  protected closeComparisonPickerOnDocumentClick(event: MouseEvent): void {
    const target = event.target;
    if (
      target instanceof Element &&
      (target.closest('.comparison-dropdown') ||
        target.closest('.chart-mode-dropdown') ||
        target.closest('.indicator-dropdown'))
    ) {
      return;
    }
    this.openToolbarMenu.set(null);

    if (!(
      target instanceof Element &&
      target.closest('app-dashboard-header-dropdown, app-account-control')
    )) {
      this.openHeaderDropdown.set(null);
    }
  }

  private loadSnapshot(): void {
    this.disconnectMarket?.();
    this.disconnectMarket = undefined;
    this.connected.set(false);
    if (!findInstrument(this.symbol(), this.instruments())) {
      this.pageStatus.set('loading');
    }
    this.marketData
      .snapshot()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (snapshot) => this.applySnapshot(snapshot),
        error: () => {
          if (this.pageStatus() !== 'ready') {
            this.pageStatus.set('error');
          } else {
            this.chartRefreshError.set('Market snapshot could not refresh.');
          }
        },
      });
  }

  private applySnapshot(snapshot: MarketSnapshot): void {
    // Cached snapshots and their revalidation each emit; retire the previous stream.
    this.disconnectMarket?.();
    this.disconnectMarket = undefined;
    const instruments = snapshot.stocks.map((stock) => ({
      symbol: stock.symbol,
      name: stock.companyName,
      price: stock.price,
      change: stock.change,
      changePercent: stock.changePercent,
    }));
    this.instruments.set(instruments);
    const selected = findInstrument(this.symbol(), instruments);
    if (!selected) {
      this.pageStatus.set('not-found');
      return;
    }
    this.openingPrices.clear();
    for (const instrument of instruments) {
      this.openingPrices.set(instrument.symbol, instrument.price - instrument.change);
    }
    this.sessionId.set(snapshot.sessionId);
    this.marketTimestamp.set(snapshot.marketTimestamp);

    this.clock.sync(snapshot);

    this.candleRevision.update((revision) => revision + 1);
    this.pageStatus.set('ready');
    this.validateComparison();
    this.disconnectMarket = this.marketData.connect(snapshot.sessionId, {
      tick: (event) => this.onTick(event),
      status: (connected) => this.zone.run(() => this.connected.set(connected)),
      resync: () => this.loadSnapshot(),
    });
  }

  private onTick(event: MarketTickEvent): void {
    const prices = new Map(event.prices.map((price) => [price.symbol, price.price]));
    this.zone.run(() => {
      this.marketTimestamp.set(event.marketTimestamp);

      this.clock.currentMarketTimestamp.set(event.marketTimestamp);

      const previousPrices = new Map(
        this.instruments().map((instrument) => [instrument.symbol, instrument.price]),
      );
      this.instruments.update((instruments) =>
        instruments.map((instrument) => {
          const price = prices.get(instrument.symbol);
          if (price === undefined) {
            return instrument;
          }
          const openingPrice = this.openingPrices.get(instrument.symbol) ?? price;
          const change = price - openingPrice;
          return {
            ...instrument,
            price,
            change,
            changePercent: openingPrice ? (change / openingPrice) * 100 : 0,
          };
        }),
      );
      for (const [symbol, price] of prices) {
        const previousPrice = previousPrices.get(symbol);
        if (previousPrice !== undefined && previousPrice !== price) {
          this.tickAnimator.start(symbol, price > previousPrice ? 'gain' : 'loss');
        }
      }
    });
  }

  private clearTickAnimations(): void {
    this.tickAnimator.clear();
  }

  private calculateMarketStats(
    instrument: Instrument | null,
    candles: MarketCandlePoint[],
  ): MarketStats {
    const price = instrument?.price ?? 0;
    const spread = Math.max(0.01, price * 0.0004);
    const lows = candles.map((point) => point.low);
    const highs = candles.map((point) => point.high);
    return {
      bid: price - spread / 2,
      ask: price + spread / 2,
      spread,
      open: candles[0]?.open ?? price - (instrument?.change ?? 0),
      low: lows.length ? Math.min(...lows) : price,
      high: highs.length ? Math.max(...highs) : price,
      trend: (instrument?.change ?? 0) >= 0 ? 'Uptrend' : 'Downtrend',
    };
  }

  private validateComparison(): void {
    const comparison = this.comparisonSymbol();
    if (!comparison) {
      return;
    }
    if (comparison === this.symbol() || !findInstrument(comparison, this.instruments())) {
      this.comparisonSymbol.set('');
      this.updateComparisonQuery('', true);
    }
  }

  private updateComparisonQuery(symbol: string, replaceUrl = false): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { compare: symbol ? marketSymbolSlug(symbol) : null },
      queryParamsHandling: 'merge',
      replaceUrl,
    });
  }
}
