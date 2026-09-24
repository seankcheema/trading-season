import { CurrencyPipe, DecimalPipe, TitleCasePipe, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
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
  lucideBell,
  lucideArrowLeft,
  lucideChartNoAxesCombined,
  lucideGitCompare,
  lucideRadio,
  lucideSlidersHorizontal,
  lucideUserRound,
} from '@ng-icons/lucide';
import { Subscription } from 'rxjs';
import { Instrument, PricePoint, Timeframe, findInstrument } from '../dashboard/mock-data';
import {
  MarketDataService,
  MarketSnapshot,
  MarketTickEvent,
} from '../dashboard/market-data.service';
import { InstrumentSearchComponent } from '../dashboard/shared/instrument-search.component';
import {
  applyLivePrice,
  candlePricePoints,
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
      lucideBell,
      lucideArrowLeft,
      lucideChartNoAxesCombined,
      lucideGitCompare,
      lucideRadio,
      lucideSlidersHorizontal,
      lucideUserRound,
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
  private openingPrice = 0;

  protected readonly symbol = signal('');
  protected readonly instruments = signal<Instrument[]>([]);
  protected readonly instrument = computed(
    () => findInstrument(this.symbol(), this.instruments()) ?? null,
  );
  protected readonly sessionId = signal<number | null>(null);
  protected readonly marketTimestamp = signal('');
  protected readonly connected = signal(false);
  protected readonly pageStatus = signal<PageStatus>('loading');
  protected readonly chartStatus = signal<ChartStatus>('loading');
  protected readonly timeframe = signal<Timeframe>('1D');
  protected readonly insightTab = signal<InsightTab>('overview');
  protected readonly candleRevision = signal(0);
  private readonly candles = signal<PricePoint[]>([]);
  protected readonly chartPoints = computed(() => {
    const instrument = this.instrument();
    return instrument
      ? applyLivePrice(this.candles(), instrument.price, this.marketTimestamp())
      : [];
  });
  protected readonly rangeVolume = computed(() =>
    this.candles().reduce((total, point) => total + (point.volume ?? 0), 0),
  );
  protected readonly mockDetails = computed(() => {
    const instrument = this.instrument();
    const price = instrument?.price ?? 0;
    return {
      marketCap: '$3.42T',
      peRatio: '33.80',
      weekRange: '$164 – $237',
      beta: '1.08',
      dividendYield: '0.44%',
      score: 78,
      targetPrice: price * 1.085,
      upside: 8.5,
      buy: 81,
      hold: 14,
      sell: 5,
      thesis:
        'Demo consensus remains bullish as price momentum and resilient demand offset near-term volatility.',
      orders: [
        { side: 'BUY', shares: 10, price: price * 0.994, status: 'Filled', time: '10:42 AM' },
        { side: 'SELL', shares: 5, price: price * 1.001, status: 'Filled', time: 'Yesterday' },
        { side: 'BUY', shares: 15, price: price * 0.982, status: 'Filled', time: 'Oct 24' },
      ],
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
        const points = candlePricePoints(series.points);
        this.candles.set(points);
        this.chartStatus.set(points.length ? 'ready' : 'empty');
      },
      error: () => this.chartStatus.set('error'),
    });
    onCleanup(() => subscription.unsubscribe());
  });

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.routeSubscription = this.route.paramMap.subscribe((params) => {
      const rawSymbol = params.get('symbol') ?? '';
      const symbol = normalizeMarketSymbol(rawSymbol);
      const canonicalSlug = marketSymbolSlug(symbol);
      if (rawSymbol !== canonicalSlug) {
        void this.router.navigate(['/dashboard/markets', canonicalSlug], { replaceUrl: true });
        return;
      }
      this.symbol.set(symbol);
      this.timeframe.set('1D');
      this.loadSnapshot();
    });
  }

  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();
    this.disconnectMarket?.();
  }

  protected retry(): void {
    this.loadSnapshot();
  }

  protected selectInstrument(instrument: Instrument): void {
    void this.router.navigate(['/dashboard/markets', marketSymbolSlug(instrument.symbol)]);
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
    this.openingPrice = selected.price - selected.change;
    this.sessionId.set(snapshot.sessionId);
    this.marketTimestamp.set(snapshot.marketTimestamp);
    this.candleRevision.update((revision) => revision + 1);
    this.pageStatus.set('ready');
    this.disconnectMarket = this.marketData.connect(snapshot.sessionId, {
      tick: (event) => this.onTick(event),
      status: (connected) => this.zone.run(() => this.connected.set(connected)),
      resync: () => this.loadSnapshot(),
    });
  }

  private onTick(event: MarketTickEvent): void {
    const tick = event.prices.find((price) => price.symbol === this.symbol());
    if (!tick) return;
    this.zone.run(() => {
      this.marketTimestamp.set(event.marketTimestamp);
      this.instruments.update((instruments) =>
        instruments.map((instrument) => {
          if (instrument.symbol !== this.symbol()) return instrument;
          const change = tick.price - this.openingPrice;
          return {
            ...instrument,
            price: tick.price,
            change,
            changePercent: this.openingPrice ? (change / this.openingPrice) * 100 : 0,
          };
        }),
      );
    });
  }
}
