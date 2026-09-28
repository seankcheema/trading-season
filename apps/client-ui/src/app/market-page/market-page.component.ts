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
type InsightTab = 'overview' | 'news' | 'ai';
type ToolbarMenu = 'indicators' | 'chart-mode' | 'comparison';

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

  protected readonly symbol = signal('');
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
    this.routeSubscription?.unsubscribe();
    this.disconnectMarket?.();
  }

  protected retry(): void {
    this.loadSnapshot();
  }

  protected selectInstrument(instrument: Instrument): void {
    const compare = this.comparisonSymbol();
    void this.router.navigate(['/dashboard/markets', marketSymbolSlug(instrument.symbol)], {
      queryParams:
        compare && compare !== instrument.symbol ? { compare: marketSymbolSlug(compare) } : {},
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
    });
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
