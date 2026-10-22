import { forkJoin, of, catchError, switchMap, Subscription } from 'rxjs';
import { MarketDataService, CandleSeries } from '../dashboard/market-data.service';
import { OrderService } from '../dashboard/orders/order.service';
import { RiskOutlookComponent } from '../market-page/risk-outlook/risk-outlook.component';
import { TrendReadComponent } from '../market-page/trend-read/trend-read.component';
import {
  activity,
  performance,
  performanceCards,
  periodDate,
  insightVersion,
  signedDollars,
  InsightChoice,
} from './dua-guidance';
import { ReadContext } from './dua-session.service';
import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowUpRight,
  lucideArrowDownRight,
  lucideChartPie,
  lucideChevronLeft,
  lucideChevronRight,
  lucideCircleHelp,
  lucideExternalLink,
  lucideNewspaper,
  lucideRefreshCw,
  lucideScanSearch,
  lucideX,
  lucideZap,
} from '@ng-icons/lucide';
import { AccountHolding } from '../dashboard/accounts/account.models';
import { AccountStore } from '../dashboard/accounts/account-store.service';
import { Instrument } from '../dashboard/mock-data';
import { MarketClockService } from '../dashboard/shared/market-clock.service';
import { DuaSession } from './dua-session.service';
import { PlatformSignalsService } from '../market-page/risk-outlook/platform-signals.service';
import { readingFor } from '../market-page/risk-outlook/platform-signals';
import { PlatformTrendService } from '../market-page/trend-read/platform-trend.service';
import { trendReadingFor } from '../market-page/trend-read/platform-trend';
import {
  DuaCard,
  DuaChoice,
  dailyReview,
  insightTextParts,
  sparklinePoints,
  takeawayParts,
} from './dua-insights';

const CHOICE_TITLES: Record<DuaChoice, string> = {
  daily: 'Daily Review',
  holdings: 'My Holdings',
  stock: 'This Stock',
  outlook: 'Volatility outlook',
  trending: "What's trending",
};

@Component({
  selector: 'app-dua',
  host: {
    '[hidden]': 'account.needsTermsAcceptance()',
    '(document:click)': 'closeOnOutsideClick($event)',
  },
  imports: [NgIcon, RouterLink, RiskOutlookComponent, TrendReadComponent],
  providers: [
    provideIcons({
      lucideArrowUpRight,
      lucideArrowDownRight,
      lucideChartPie,
      lucideChevronLeft,
      lucideChevronRight,
      lucideCircleHelp,
      lucideExternalLink,
      lucideNewspaper,
      lucideRefreshCw,
      lucideScanSearch,
      lucideX,
      lucideZap,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dua.component.html',
  styleUrl: './dua.component.css',
})
export class DuaComponent {
  protected readonly takeawayParts = takeawayParts;
  protected readonly responseParts = insightTextParts;
  protected readonly chartPoints = sparklinePoints;
  readonly holdings = input<readonly AccountHolding[]>([]);
  readonly quotes = input<readonly Instrument[]>([]);
  readonly symbol = input('');
  readonly connected = input(false);
  protected readonly session = inject(DuaSession);
  protected readonly account = inject(AccountStore);
  protected readonly clock = inject(MarketClockService);
  protected readonly signals = inject(PlatformSignalsService);
  // The stock the outlook choice is about: the open instrument, else the first holding.
  protected readonly outlookSymbol = computed(
    () => this.symbol() || this.holdings()[0]?.symbol || '',
  );
  protected readonly outlook = computed(() => {
    const signals = this.signals.signals();
    const at = this.clock.currentMarketTimestamp();
    const symbol = this.outlookSymbol();
    return signals && symbol && Number.isFinite(Date.parse(at))
      ? readingFor(signals, symbol, at)
      : null;
  });
  private readonly loadOutlook = effect(() => {
    if (!this.session.minimized() && this.signals.status() === 'idle') {
      this.signals.load().subscribe({ error: () => undefined });
    }
  });
  protected readonly trend = inject(PlatformTrendService);
  protected readonly trending = computed(() => {
    const trend = this.trend.trend();
    const at = this.clock.currentMarketTimestamp();
    const symbol = this.outlookSymbol();
    return trend && symbol && Number.isFinite(Date.parse(at))
      ? trendReadingFor(trend, symbol, at)
      : null;
  });
  private readonly loadTrend = effect(() => {
    if (!this.session.minimized() && this.trend.status() === 'idle') {
      this.trend.load().subscribe({ error: () => undefined });
    }
  });
  protected readonly hovered = signal(false);
  protected readonly focused = signal(false);
  protected readonly hasUpdates = computed(() => this.unreadCount() > 0);
  protected readonly explaining = signal(false);
  protected readonly faceVisible = computed(
    () => !this.session.minimized() || this.hasUpdates() || this.hovered() || this.focused(),
  );
  protected readonly title = computed(() => {
    if (this.explaining()) {
      return 'View Details';
    }
    const choice = this.choice();
    return choice ? CHOICE_TITLES[choice] : 'Dua';
  });
  protected readonly imagesFailed = signal(false);
  protected readonly activeCard = signal(0);
  protected readonly cards = signal<DuaCard[]>([]);
  protected readonly explainedCard = computed(() => this.cards()[this.activeCard()]);
  protected readonly choice = signal<DuaChoice | null>(null);
  protected readonly loading = signal(false);
  protected readonly message = signal('');
  protected readonly asOf = signal('');
  protected readonly snapshotDate = signal('');
  protected readonly snapshotContext = signal('');
  protected readonly snapshotDisconnected = signal(false);
  private readonly launcher = viewChild<ElementRef<HTMLButtonElement>>('launcher');
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');
  private timers: ReturnType<typeof setTimeout>[] = [];
  private lastTime = '';
  private resizeAnimation?: Animation;
  private panelSize?: { height: number; width: number };

  readonly openOutlook = input(false);
  protected readonly period = signal<'week' | 'month'>('week');
  protected readonly snapshotAt = signal('');
  protected readonly displayedContext = signal<ReadContext | null>(null);
  private readonly market = inject(MarketDataService);
  private readonly orders = inject(OrderService);
  private historyRequest?: Subscription;
  private readonly history = signal<CandleSeries[]>([]);
  protected readonly historyLoading = signal(false);
  private readonly marketDay = computed(() => {
    const at = this.clock.currentMarketTimestamp();
    return Number.isFinite(Date.parse(at))
      ? new Intl.DateTimeFormat('en-CA', { timeZone: this.clock.marketCalendar().timezone }).format(
          new Date(at),
        )
      : '';
  });
  private readonly fillSignature = computed(() =>
    JSON.stringify(
      this.orders
        .orders()
        .filter(
          (o) =>
            o.accountId === this.account.selectedAccountId() &&
            o.status === 'FILLED' &&
            Date.parse(o.evaluatedAt ?? o.simulatedAt ?? o.resolvedAt ?? '') <=
              Date.parse(this.clock.currentMarketTimestamp()),
        )
        .map((o) => [o.orderId, o.executionPrice, o.quantity]),
    ),
  );
  protected readonly contexts = computed<ReadContext[]>(
    () => {
      const accountId = this.account.selectedAccountId();
      const sessionId = this.clock.marketSessionId();
      if (
        accountId === null ||
        sessionId === null ||
        !this.marketDay() ||
        this.account.status() !== 'ready' ||
        this.account.needsTermsAcceptance() ||
        this.clock.clockUpdating()
      )
        return [];
      const trend = this.trending();
      const risk = this.outlook();
      const summary = this.suggestion('week');
      return (this.symbol() ? ['stock', 'daily', 'holdings'] : ['daily', 'holdings']).map(
        (insight) => ({
          accountId,
          sessionId,
          insight,
          symbol: insight === 'stock' ? this.symbol() : '',
          version: insightVersion([
            2,
            this.marketDay(),
            this.fillSignature(),
            insight !== 'daily'
              ? [
                  summary.takeaway,
                  this.suggestion('month').takeaway,
                  this.trend.trend() &&
                    this.quotes().map((q) => {
                      const r = trendReadingFor(
                        this.trend.trend()!,
                        q.symbol,
                        this.clock.currentMarketTimestamp(),
                      );
                      return r.kind === 'ready'
                        ? [q.symbol, r.asOf, r.call, r.source]
                        : [q.symbol, r.kind];
                    }),
                ]
              : '',
            insight === 'stock'
              ? [
                  trend?.kind === 'ready' ? [trend.asOf, trend.call, trend.source] : null,
                  risk?.kind === 'ready' ? [risk.asOf, risk.call, risk.source] : null,
                  activity(
                    this.history().find((s) => s.symbol === this.symbol()),
                    this.clock.currentMarketTimestamp(),
                  ).label,
                ]
              : null,
          ]),
        }),
      );
    },
    { equal: (a, b) => JSON.stringify(a) === JSON.stringify(b) },
  );
  protected readonly unreadCount = computed(
    () => this.contexts().filter((c) => this.session.unread(c)).length,
  );
  protected isUnread(insight: string): boolean {
    const c = this.contexts().find((c) => c.insight === insight);
    return !!c && this.session.unread(c);
  }
  protected readonly snapshotStillCurrent = computed(() => {
    const shown = this.displayedContext();
    return (
      !!shown &&
      this.contexts().some(
        (c) =>
          c.insight === shown.insight &&
          c.version === shown.version &&
          c.accountId === shown.accountId &&
          c.sessionId === shown.sessionId &&
          c.symbol === shown.symbol,
      )
    );
  });
  protected setPeriod(period: 'week' | 'month'): void {
    this.period.set(period);
    this.select('holdings');
  }
  protected showDetails(): void {
    this.savedScroll =
      this.panel()?.nativeElement.querySelector('.insight-card:not(.inactive) .card-content')
        ?.scrollTop ?? 0;
    this.explaining.set(true);
  }
  private savedScroll = 0;
  private legacyOpened = false;
  private rows(period: 'daily' | 'week' | 'month') {
    return performance(
      this.account.selectedHoldings(),
      this.orders.orders(),
      this.orders.catalogue(),
      this.account.selectedAccountId()!,
      this.clock.currentMarketTimestamp(),
      periodDate(this.clock.currentMarketTimestamp(), period),
      this.history(),
      this.quotes(),
      period === 'daily',
    );
  }
  private suggestion(period: 'week' | 'month' = this.period()): DuaCard {
    const at = this.clock.currentMarketTimestamp();
    const trend = this.trend.trend();
    const rows = this.rows(period);
    const held = new Set(this.holdings().map((h) => h.symbol));
    const candidates = this.quotes().map((q) => ({
      symbol: q.symbol,
      reading: trend ? trendReadingFor(trend, q.symbol, at) : null,
    }));
    const worst = rows
      .filter((r) => r.gain !== null && r.gain < 0 && held.has(r.symbol))
      .sort((a, b) => a.gain! - b.gain!)[0];
    const review =
      worst &&
      candidates.find(
        (c) =>
          c.symbol === worst.symbol && c.reading?.kind === 'ready' && c.reading.call === 'down',
      );
    const buy = candidates
      .filter((c) => c.reading?.kind === 'ready' && c.reading.call === 'up')
      .sort(
        (a, b) =>
          (b.reading?.kind === 'ready' ? b.reading.momentum : 0) -
          (a.reading?.kind === 'ready' ? a.reading.momentum : 0),
      )[0];
    const risk =
      buy && this.signals.signals() ? readingFor(this.signals.signals()!, buy.symbol, at) : null;
    return {
      title: 'What to consider',
      takeaway: review
        ? `Review your ${review.symbol} position.`
        : buy
          ? `Consider buying ${buy.symbol}.`
          : 'No clear opportunity right now.',
      text: review
        ? 'Your weakest contributor also has a downward forecast.'
        : buy
          ? `Momentum supports an upward forecast.${risk?.kind === 'ready' && risk.call === 'stormier' ? ' Larger price swings are likely.' : ''}`
          : 'Wait for a clearer forecast.',
      detail:
        review && buy
          ? `Also consider ${buy.symbol}: its forecast points upward. Review the stock details before trading.`
          : 'Suggestions use existing direction readings and recent momentum, not purchase losses alone.',
    };
  }
  private buildCards(choice: InsightChoice): DuaCard[] {
    if (choice !== 'stock') {
      const period = choice === 'daily' ? 'daily' : this.period();
      const cards = performanceCards(
        this.rows(period),
        period === 'daily' ? 'Today' : period === 'week' ? 'This week' : 'This month',
      );
      if (choice === 'holdings') return [...cards, this.suggestion()];
      const market = dailyReview(this.holdings(), this.quotes())[0];
      const up = Number(market.metrics?.[0]?.value ?? 0);
      const down = Number(market.metrics?.[1]?.value ?? 0);
      return [
        ...cards,
        {
          ...market,
          takeaway: !market.metrics?.length
            ? 'Market direction is unavailable.'
            : up > down
              ? 'Tracked stocks are mostly rising.'
              : down > up
                ? 'Tracked stocks are mostly falling.'
                : 'Tracked stocks are mixed.',
          metrics: market.metrics?.slice(0, 2),
          text: 'Direction of tracked stocks since session open.',
        },
      ];
    }
    const symbol = this.symbol();
    const trend = this.trending();
    const risk = this.outlook();
    const owned = this.holdings().some((h) => h.symbol === symbol && h.quantity > 0);
    const volume = activity(
      this.history().find((s) => s.symbol === symbol),
      this.clock.currentMarketTimestamp(),
    );
    const action =
      trend?.kind !== 'ready'
        ? 'Not enough forecast history yet.'
        : trend.call === 'up'
          ? `Consider buying ${symbol}.`
          : owned
            ? `Review your ${symbol} position.`
            : `Consider waiting on ${symbol}.`;
    const swing =
      risk?.kind === 'ready'
        ? `Expect ${risk.call === 'stormier' ? 'bigger' : 'smaller'} price swings.`
        : 'Volatility forecast unavailable.';
    const position = this.holdings().find((h) => h.symbol === symbol && h.quantity > 0);
    const price = this.quotes().find((q) => q.symbol === symbol)?.price;
    const unrealized =
      position && price && price > 0 && position.averageCost > 0
        ? (price - position.averageCost) * position.quantity
        : null;
    const positionMetrics: NonNullable<DuaCard['metrics']> = position
      ? [{ label: 'Your shares', value: String(position.quantity) }]
      : [];
    if (unrealized !== null)
      positionMetrics.push({
        label: 'Unrealized since purchase',
        value: signedDollars(unrealized),
        tone: unrealized < 0 ? 'loss' : 'gain',
      });
    const horizon = this.trend.trend()?.horizonDays ?? 5;
    return [
      {
        title: 'Buying context',
        metrics: positionMetrics,
        takeaway: action,
        text:
          trend?.kind === 'ready'
            ? `The next ${horizon} trading days lean ${trend.call === 'up' ? 'upward' : 'downward'}.`
            : 'Wait for more forecast history.',
        note: `${volume.label}. ${swing}`,
        detail:
          trend?.kind === 'ready'
            ? `Selected source: ${trend.source}. Reading: ${trend.asOf}. Model probability: ${Math.round(trend.probability * 100)}%. Model record: ${trend.modelHits}/${trend.modelDays}; pattern: ${trend.ruleHits}/${trend.ruleDays}.`
            : 'No eligible direction reading at this simulation time.',
      },
      {
        title: 'Trending activity',
        takeaway:
          trend?.kind === 'ready'
            ? `${symbol} is ${trend.momentum > 0 ? 'gaining' : 'losing'} momentum.`
            : 'Not enough trend history yet.',
        text: `${volume.label}.`,
        metrics:
          volume.ratio === undefined
            ? []
            : [{ label: 'Volume versus usual', value: `${volume.ratio.toFixed(1)}×` }],
        detail:
          'Latest completed session volume compared with the preceding 20 completed sessions. This describes market activity, not social popularity.',
      },
      {
        title: 'Volatility outlook',
        takeaway: swing,
        text: 'Swing size can increase in either direction.',
        detail:
          risk?.kind === 'ready'
            ? `Selected source: ${risk.source}. Reading: ${risk.asOf}. Model probability of bigger swings: ${Math.round(risk.probability * 100)}%.`
            : 'Not enough forecast history yet.',
      },
    ];
  }

  constructor() {
    effect(() => {
      // Track context changes, but not normal live ticks: displayed results are snapshots.
      this.account.selectedAccountId();
      this.symbol();
      this.clock.marketSessionId();
      this.clock.clockUpdating();
      this.account.status();
      this.account.needsTermsAcceptance();
      untracked(() => this.back());
    });
    effect(() => {
      const time = this.clock.currentMarketTimestamp();
      if (time < this.lastTime) {
        untracked(() => this.back());
      }
      this.lastTime = time;
    });
    effect(() => {
      if (
        this.openOutlook() &&
        !this.legacyOpened &&
        !this.historyLoading() &&
        this.orders.historyStatus() === 'ready' &&
        this.contexts().length
      )
        untracked(() => {
          this.legacyOpened = true;
          this.select('stock');
          this.activeCard.set(2);
          this.showDetails();
          this.session.minimized.set(false);
        });
    });
    effect(() => {
      const symbol = this.symbol();
      if (symbol)
        untracked(() => {
          this.legacyOpened = false;
          this.session.minimized.set(false);
        });
    });
    effect(() => {
      const ready =
        this.account.status() === 'ready' &&
        !this.account.needsTermsAcceptance() &&
        !this.clock.clockUpdating();
      const accountId = this.account.selectedAccountId();
      const sessionId = this.clock.marketSessionId();
      const day = this.marketDay();
      // Refresh completed-session volume once at the close, not on each price tick.
      this.clock.marketOpen();
      const fills = this.fillSignature();
      const symbol = this.symbol();
      const open = symbol ? true : !this.session.minimized();
      untracked(() => {
        if (!open && !symbol) return;
        this.historyRequest?.unsubscribe();
        this.history.set([]);
        this.historyLoading.set(false);
        if (!ready || accountId === null || sessionId === null || !day) return;
        this.historyLoading.set(true);
        this.historyRequest = forkJoin([this.orders.loadOrders(false), this.orders.instruments()])
          .pipe(
            switchMap(([orders, catalogue]) => {
              const symbols = new Set(
                [...this.account.selectedHoldings().map((h) => h.symbol), symbol].filter(Boolean),
              );
              orders
                .filter((o) => o.accountId === accountId && o.status === 'FILLED')
                .forEach((o) => {
                  const i = catalogue.find((i) => i.instrumentId === o.instrumentId);
                  const symbol = i?.simulatedStockSymbol ?? i?.ticker;
                  if (symbol) symbols.add(symbol);
                });
              return symbols.size
                ? forkJoin(
                    [...symbols].map((symbol) =>
                      this.market.candles(sessionId, symbol, '1Y').pipe(catchError(() => of(null))),
                    ),
                  )
                : of([]);
            }),
          )
          .subscribe({
            next: (series) => {
              this.history.set(series.filter((s): s is CandleSeries => !!s));
              this.historyLoading.set(false);
            },
            error: () => this.historyLoading.set(false),
          });
      });
    });
    effect(() => {
      const contexts = this.contexts();
      untracked(() => this.session.query(contexts));
    });
    afterRenderEffect(() => {
      const snapshot = this.displayedContext();
      const open = !this.session.minimized();
      if (
        snapshot &&
        open &&
        !this.loading() &&
        this.cards().length &&
        !this.explaining() &&
        this.snapshotStillCurrent() &&
        typeof document !== 'undefined' &&
        document.visibilityState === 'visible'
      ) {
        untracked(() => {
          if (this.session.unread(snapshot)) this.session.viewedSummary(snapshot);
        });
      }
    });
    afterRenderEffect(() => {
      // Measure after Angular renders the destination view, then animate from the prior size.
      this.choice();
      this.activeCard();
      this.explaining();
      this.cards();
      const minimized = this.session.minimized();
      const panel = this.panel()?.nativeElement;
      if (!panel) {
        return;
      }
      const interruptedHeight = this.resizeAnimation
        ? panel.getBoundingClientRect().height
        : undefined;
      this.resizeAnimation?.cancel();
      this.resizeAnimation = undefined;
      panel.classList.remove('resizing');
      const bounds = panel.getBoundingClientRect();
      const previous = this.panelSize;
      this.panelSize = minimized ? undefined : { height: bounds.height, width: bounds.width };
      const reducedMotion =
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const cannotAnimate = minimized || reducedMotion || typeof panel.animate !== 'function';
      if (!previous || cannotAnimate || Math.abs(previous.width - bounds.width) > 1) {
        return;
      }
      const from = interruptedHeight ?? previous.height;
      if (Math.abs(from - bounds.height) < 1) {
        return;
      }
      const animation = panel.animate([{ height: `${from}px` }, { height: `${bounds.height}px` }], {
        duration: 380,
        easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
      });
      this.resizeAnimation = animation;
      panel.classList.add('resizing');
      const finish = () => {
        if (this.resizeAnimation === animation) {
          this.resizeAnimation = undefined;
          panel.classList.remove('resizing');
        }
      };
      animation.onfinish = finish;
      animation.oncancel = finish;
    });
    inject(DestroyRef).onDestroy(() => {
      this.resizeAnimation?.cancel();
      this.historyRequest?.unsubscribe();
      this.clearTimers();
    });
  }

  protected imageFailed(): void {
    this.clearTimers();
    this.imagesFailed.set(true);
  }
  private clearTimers(): void {
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }

  protected toggle(): void {
    this.clearTimers();
    this.session.minimized.update((value) => !value);
    if (!this.session.minimized()) {
      this.timers.push(setTimeout(() => this.panel()?.nativeElement.focus()));
    }
  }

  protected closeOnOutsideClick(event: MouseEvent): void {
    if (this.session.minimized()) {
      return;
    }
    const path = event.composedPath();
    const panel = this.panel()?.nativeElement;
    const launcher = this.launcher()?.nativeElement;
    if ((panel && path.includes(panel)) || (launcher && path.includes(launcher))) {
      return;
    }
    // Leave focus on the control the user clicked, rather than returning to the launcher.
    this.minimize(false);
  }

  protected minimize(restoreFocus = true): void {
    this.clearTimers();
    this.session.minimized.set(true);
    this.focused.set(false);
    if (restoreFocus) {
      this.launcher()?.nativeElement.focus();
    }
  }

  protected back(): void {
    this.activeCard.set(0);
    this.choice.set(null);
    this.cards.set([]);
    this.message.set('');
    this.asOf.set('');
    this.snapshotDate.set('');
    this.snapshotDisconnected.set(false);
    this.loading.set(false);
    this.explaining.set(false);
    this.snapshotContext.set('');
    this.displayedContext.set(null);
  }

  protected backToPrevious(): void {
    if (this.explaining()) {
      this.explaining.set(false);
      setTimeout(() => {
        const content = this.panel()?.nativeElement.querySelector(
          '.insight-card:not(.inactive) .card-content',
        );
        if (content) content.scrollTop = this.savedScroll;
      });
    } else {
      this.back();
    }
  }

  protected select(choice: DuaChoice): void {
    const selected: InsightChoice =
      choice === 'outlook' || choice === 'trending' ? 'stock' : choice;
    this.clearTimers();
    this.back();
    this.choice.set(selected);
    if (
      !this.contexts().length ||
      this.historyLoading() ||
      this.orders.historyStatus() !== 'ready'
    ) {
      this.message.set('Account or market data is unavailable. Please try again.');
      return;
    }
    this.snapshotAt.set(this.clock.currentMarketTimestamp());
    this.snapshotContext.set(this.account.selectedAccount()?.name ?? '');
    this.asOf.set(
      new Intl.DateTimeFormat('en-US', {
        timeZone: this.clock.marketCalendar().timezone,
        hour: 'numeric',
        minute: '2-digit',
      }).format(new Date(this.snapshotAt())),
    );
    this.snapshotDate.set(this.marketDay());
    this.snapshotDisconnected.set(!this.connected());
    this.cards.set(this.buildCards(selected));
    this.displayedContext.set(this.contexts().find((c) => c.insight === selected) ?? null);
  }
}
