import { DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AccountStore } from '../dashboard/accounts/account-store.service';
import { Account } from '../dashboard/accounts/account.models';
import { AccountDialogComponent } from '../dashboard/accounts/account-dialog.component';
import { cashAt, holdingsAt, executionTime } from '../dashboard/accounts/simulation-account';
import { OrderService } from '../dashboard/orders/order.service';
import { OrderResult } from '../dashboard/orders/order.models';
import { toOrderErrorMessage } from '../dashboard/orders/order-error';
import { ToastService } from '../notifications/toast.service';
import { AccountControlComponent } from '../dashboard/shared/account-control.component';
import { MarketClockControlComponent } from '../dashboard/shared/market-clock-control.component';
import { MarketClockService } from '../dashboard/shared/market-clock.service';
import { ActivityItem, ActivityRowComponent } from '../dashboard/shared/activity-row.component';
import { TradeTicketDraft } from '../dashboard/shared/trade-ticket.component';
import { CurrencyPipe, DecimalPipe, TitleCasePipe, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  NgZone,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideActivity,
  lucideBell,
  lucideChevronDown,
  lucideChevronLeft,
  lucideChevronRight,
  lucideChartArea,
  lucideChartBar,
  lucideChartCandlestick,
  lucideChartLine,
  lucideChartNoAxesColumn,
  lucideCrosshair,
  lucideBotMessageSquare,
  lucideMessageSquareText,
  lucidePanelRightClose,
  lucidePanelRightOpen,
  lucideGitCompare,
  lucidePercent,
  lucideSendHorizontal,
  lucideShieldCheck,
  lucideSlidersHorizontal,
  lucideTrendingUp,
  lucideUserRound,
  lucideUsersRound,
  lucideX,
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
import { TimeframeToggleComponent } from '../dashboard/shared/timeframe-toggle.component';
import { TradeTicketComponent } from '../dashboard/shared/trade-ticket.component';

type PageStatus = 'loading' | 'ready' | 'not-found' | 'error';
type ChartStatus = 'loading' | 'ready' | 'empty' | 'error';

type InsightTab = 'overview' | 'news' | 'ai' | 'recent-orders';

type ToolbarMenu = 'indicators' | 'chart-mode' | 'comparison';
type TickAnimation = {
  direction: 'gain' | 'loss';
  durationMs: number;
  revision: number;
};

interface AiMessage {
  role: 'user' | 'assistant';
  text: string;
}

interface DemoNewsStory {
  age: string;
  category: string;
  title: string;
  includeSymbol?: boolean;
}

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
    AccountControlComponent,

    AccountDialogComponent,

    MarketClockControlComponent,

    ActivityRowComponent,

    CurrencyPipe,
    DecimalPipe,
    InstrumentSearchComponent,
    NgIcon,
    PriceChartComponent,
    RouterLink,
    SignedPercentPipe,
    TitleCasePipe,
    TimeframeToggleComponent,
    TradeTicketComponent,
  ],
  providers: [
    AccountStore,
    OrderService,
    MarketClockService,

    provideIcons({
      lucideActivity,
      lucideBell,
      lucideChevronDown,
      lucideChevronLeft,
      lucideChevronRight,
      lucideChartArea,
      lucideChartBar,
      lucideChartCandlestick,
      lucideChartLine,
      lucideChartNoAxesColumn,
      lucideCrosshair,
      lucideBotMessageSquare,
      lucideMessageSquareText,
      lucidePanelRightClose,
      lucidePanelRightOpen,
      lucideGitCompare,
      lucidePercent,
      lucideSendHorizontal,
      lucideShieldCheck,
      lucideSlidersHorizontal,
      lucideTrendingUp,
      lucideUserRound,
      lucideUsersRound,
      lucideX,
    }),
  ],
  templateUrl: './market-page.component.html',
  styleUrl: './market-page.component.css',
})
export class MarketPageComponent implements OnInit, OnDestroy {
  private readonly marketData = inject(MarketDataService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly zone = inject(NgZone);
  private readonly platformId = inject(PLATFORM_ID);
  private routeSubscription?: Subscription;
  private disconnectMarket?: () => void;
  private readonly openingPrices = new Map<string, number>();
  private readonly tickAnimationTimers = new Map<string, ReturnType<typeof setTimeout>>();
  protected readonly accountStore = inject(AccountStore);

  protected readonly orders = inject(OrderService);
  protected readonly clock = inject(MarketClockService);

  private readonly toasts = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly openHeaderDropdown = signal<'account' | 'market-clock' | null>(null);
  protected readonly accountDialog = signal<{ account: Account | null } | null>(null);

  private readonly requestedAccountId = signal<number | null>(null);
  private appliedAccountId: number | null = null;
  private readonly selectRequestedAccount = effect(() => {
    const id = this.requestedAccountId();

    if (this.accountStore.status() === 'ready' && id !== null && id !== this.appliedAccountId) {
      this.appliedAccountId = id;
      this.accountStore.selectAccount(id);
    }
  });

  protected readonly submitting = signal(false);
  protected readonly refreshing = signal(false);

  private readonly coolingDown = signal(false);
  private cooldownTimer?: ReturnType<typeof setTimeout>;

  protected readonly orderMessage = signal('');
  protected readonly orderError = signal('');

  protected readonly refreshAccountId = signal<number | null>(null);
  protected readonly catalogueStatus = signal<'loading' | 'ready' | 'error'>('loading');

  protected readonly busy = computed(
    () => this.submitting() || this.coolingDown() || this.refreshing(),
  );

  protected readonly tradeReady = computed(
    () =>
      this.accountStore.status() === 'ready' &&
      this.accountStore.selectedAccountId() !== null &&
      this.orders.historyStatus() === 'ready' &&
      this.catalogueStatus() === 'ready' &&
      this.pageStatus() === 'ready' &&
      !this.clock.clockUpdating() &&
      this.refreshAccountId() === null,
  );

  private readonly simulationTime = computed(() => {
    const at = Date.parse(this.marketTimestamp());
    return Number.isFinite(at) ? at : null;
  });

  private readonly simulationHoldings = computed(
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
  protected readonly tradingCashBalance = this.accountStore.cashBalance;
  private readonly tradeTicket = viewChild(TradeTicketComponent);
  protected readonly availableCash = computed(() => {
    const draft = this.tradeTicket()?.draft();
    return draft?.side === 'buy'
      ? Math.max(0, this.cashBalance() - draft.estimatedValue)
      : this.cashBalance();
  });
  protected readonly heldShares = computed(
    () =>
      this.accountStore.selectedHoldings().find((h) => h.symbol === this.symbol())?.quantity ?? 0,
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

      .map(({ order, at }) => {
        const ref = this.orders.catalogue().find((ref) => ref.instrumentId === order.instrumentId);
        return {
          kind: 'trade',
          key: `order-${order.orderId}`,
          date: new Date(at).toISOString(),
          reason: order.orderType,

          value: order.quantity * order.indicativePrice,
          label: ref?.simulatedStockSymbol ?? ref?.ticker ?? `Order #${order.orderId}`,

          detail: `${order.quantity} ${order.quantity === 1 ? 'share' : 'shares'} · ${order.status === 'FILLED' ? 'Filled' : order.status === 'REJECTED' ? 'Rejected' : 'Pending'}`,

          positive: order.orderType === 'SELL',
          status: order.status,
          rejectionReason: order.rejectionReason,
        };
      }),
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

  protected selectAccount(id: number): void {
    if (!this.accountStore.selectAccount(id)) return;

    this.requestedAccountId.set(id);

    this.openHeaderDropdown.set(null);

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { accountId: id },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
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

    if (
      !this.tradeReady() ||
      this.busy() ||
      !this.accountStore.isOwnedAccount(accountId) ||
      !Number.isInteger(draft.quantity) ||
      draft.quantity <= 0 ||
      draft.symbol !== this.symbol()
    )
      return;

    const price = this.instrument()?.price ?? 0;

    const maximum =
      draft.side === 'buy'
        ? Math.floor(this.tradingCashBalance() / price)
        : Math.floor(this.heldShares());

    if (!Number.isFinite(price) || price <= 0 || draft.quantity > maximum) return;

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
            const message = `Filled ${result.quantity} ${draft.symbol} at ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(result.indicativePrice)}.`;

            this.orderMessage.set(message);
            this.toasts.show(message, 'success');
            this.refreshBalances(accountId);
          } else if (result.status === 'REJECTED') {
            const message = `Rejected: ${result.rejectionReason ?? 'The order was rejected.'}`;
            this.orderError.set(message);
            this.toasts.show(message, 'error');
          } else this.orderMessage.set('Order pending.');
        },
        error: (error: unknown) => {
          this.submitting.set(false);
          const message = toOrderErrorMessage(error);
          this.orderError.set(message);
          this.toasts.show(message, 'error');
        },
      });
  }

  protected retryBalances(): void {
    const id = this.refreshAccountId();
    if (id !== null) this.refreshBalances(id);
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
  protected readonly tickAnimations = signal(new Map<string, TickAnimation>());
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
  protected readonly chartMode = signal<ChartMode>('line');
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
  protected readonly insightTab = signal<InsightTab>('overview');
  protected readonly demoNews: readonly DemoNewsStory[] = [
    {
      age: '12 min ago',
      category: 'Market update',
      title: 'holds near its session high as trading activity increases.',
      includeSymbol: true,
    },
    {
      age: '48 min ago',
      category: 'Sector watch',
      title: 'Large-cap peers trade higher as investors favor established companies.',
    },
    {
      age: '2 hr ago',
      category: 'Company outlook',
      title: 'Analysts continue to focus on demand, margins, and the next earnings update.',
    },
    {
      age: '4 hr ago',
      category: 'Macroeconomy',
      title: 'Treasury yields ease as markets assess latest economic data.',
    },
    {
      age: '5 hr ago',
      category: 'Earnings',
      title: 'Tech stocks extend gains ahead of key earnings reports this week.',
    },
  ];
  protected readonly aiDraft = signal('');
  protected readonly aiMessages = signal<AiMessage[]>([]);
  protected readonly toolsCollapsed = signal(false);
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
  private readonly candleLoader = effect((onCleanup) => {
    const sessionId = this.sessionId();
    const symbol = this.symbol();
    const timeframe = this.timeframe();
    this.candleRevision();
    if (sessionId === null || !symbol || this.pageStatus() !== 'ready') {
      return;
    }
    this.chartStatus.set('loading');
    this.candles.set([]);
    const subscription = this.marketData.candles(sessionId, symbol, timeframe).subscribe({
      next: (series) => {
        const points = marketCandlePoints(series.points);
        this.candles.set(points);
        this.chartStatus.set(points.length ? 'ready' : 'empty');
      },
      error: () => this.chartStatus.set('error'),
    });
    onCleanup(() => subscription.unsubscribe());
  });
  private readonly comparisonCandleLoader = effect((onCleanup) => {
    const sessionId = this.sessionId();
    const symbol = this.comparisonSymbol();
    const timeframe = this.timeframe();
    this.candleRevision();
    if (sessionId === null || !symbol || this.pageStatus() !== 'ready') {
      this.comparisonCandles.set([]);
      this.comparisonChartStatus.set('loading');
      return;
    }
    this.comparisonChartStatus.set('loading');
    this.comparisonCandles.set([]);
    const subscription = this.marketData.candles(sessionId, symbol, timeframe).subscribe({
      next: (series) => {
        const points = marketCandlePoints(series.points);
        this.comparisonCandles.set(points);
        this.comparisonChartStatus.set(points.length ? 'ready' : 'empty');
      },
      error: () => this.comparisonChartStatus.set('error'),
    });
    onCleanup(() => subscription.unsubscribe());
  });

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

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
        const accountId = Number(params.get('accountId'));

        this.requestedAccountId.set(
          Number.isInteger(accountId) && accountId > 0 ? accountId : null,
        );

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

  protected toggleToolbarMenu(menu: ToolbarMenu): void {
    this.openToolbarMenu.update((open) => (open === menu ? null : menu));
  }

  protected toggleIndicator(indicator: TechnicalIndicator): void {
    this.enabledIndicators.update((enabled) =>
      enabled.includes(indicator)
        ? enabled.filter((candidate) => candidate !== indicator)
        : [...enabled, indicator],
    );
  }

  protected submitAiPrompt(event: Event, symbol: string): void {
    event.preventDefault();
    const prompt = this.aiDraft().trim();
    if (!prompt) return;
    this.aiMessages.update((messages) => [
      ...messages,
      { role: 'user', text: prompt },
      {
        role: 'assistant',
        text: `${symbol} is in a simulated session. I can help explain its price, range, volume, and chart in plain language.`,
      },
    ]);
    this.aiDraft.set('');
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
      target.closest('app-dashboard-header-dropdown, app-market-clock-control, app-account-control')
    ))
      this.openHeaderDropdown.set(null);
  }

  private loadSnapshot(): void {
    this.disconnectMarket?.();
    this.disconnectMarket = undefined;
    this.connected.set(false);
    this.pageStatus.set('loading');
    this.marketData.snapshot().subscribe({
      next: (snapshot) => this.applySnapshot(snapshot),
      error: () => this.pageStatus.set('error'),
    });
  }

  private applySnapshot(snapshot: MarketSnapshot): void {
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
          if (price === undefined) return instrument;
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
          this.animateTick(symbol, price > previousPrice ? 'gain' : 'loss');
        }
      }
    });
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

  private clearTickAnimations(): void {
    this.tickAnimationTimers.forEach(clearTimeout);
    this.tickAnimationTimers.clear();
    this.tickAnimations.set(new Map());
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
    if (!comparison) return;
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
