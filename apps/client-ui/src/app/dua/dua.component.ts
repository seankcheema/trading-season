import { forkJoin, of, catchError, switchMap, Subscription } from 'rxjs';
import { MarketDataService, CandleSeries } from '../dashboard/market-data.service';
import { OrderService } from '../dashboard/orders/order.service';
import {
  activity,
  dailyPerformanceCard,
  dollars,
  moversCard,
  performance,
  periodDate,
  periodPerformanceCard,
  insightVersion,
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
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowUpRight,
  lucideArrowDownRight,
  lucideChartPie,
  lucideChevronLeft,
  lucideChevronRight,
  lucideExternalLink,
  lucideInfo,
  lucideNewspaper,
  lucideScanSearch,
  lucideX,
  lucideZap,
} from '@ng-icons/lucide';
import { AccountHolding } from '../dashboard/accounts/account.models';
import { AccountStore } from '../dashboard/accounts/account-store.service';
import { Instrument } from '../dashboard/mock-data';
import { MarketClockService } from '../dashboard/shared/market-clock.service';
import { DuaSession } from './dua-session.service';
import { WatchlistStore } from '../dashboard/watchlist/watchlist-store.service';
import { PlatformSignalsService } from '../market-page/risk-outlook/platform-signals.service';
import { readingFor } from '../market-page/risk-outlook/platform-signals';
import { PlatformTrendService } from '../market-page/trend-read/platform-trend.service';
import { trendReadingFor } from '../market-page/trend-read/platform-trend';
import {
  DuaCard,
  DuaChoice,
  insightTextParts,
  outlookForecastRecord,
  sparklinePoints,
  trendForecastRecord,
  watchlistPulse,
} from './dua-insights';
import { DuaCountUpDirective } from './dua-count-up.directive';
import { DuaFigureComponent, DuaMood } from './dua-figure.component';
import { duaGreeting, duaMarketNote } from './dua-greeting';
import { DuaSpeech } from './dua-speech.service';
import { DuaSpeechBubbleComponent } from './dua-speech-bubble.component';
import { SessionTimeoutService } from '../core/auth/session-timeout.service';

// Clicks on the launcher within this long that set off Dua's barrel roll.
const ROLL_CLICKS = 5;
const ROLL_WINDOW_MS = 1500;
const ROLL_MS = 900;
const WAKE_MS = 900;
export const IDLE_WARNING_LINE =
  "Still there? I'll sign you out in a minute to keep your account safe.";

const CHOICE_TITLES: Record<DuaChoice, string> = {
  daily: 'Daily Review',
  holdings: 'Portfolio Analysis',
  stock: 'This Stock',
  outlook: 'Volatility outlook',
  trending: "What's trending",
};

@Component({
  selector: 'app-dua',
  host: {
    '[hidden]': 'account.needsTermsAcceptance()',
    '(document:click)': 'closeOnOutsideClick($event)',
    // Above dialog backdrops (z-50) while a dialog Dua belongs to is open, below the tour.
    '[style.z-index]': 'raised() ? 60 : null',
  },
  imports: [
    DuaCountUpDirective,
    DuaFigureComponent,
    DuaSpeechBubbleComponent,
    NgIcon,
    NgTemplateOutlet,
    RouterLink,
  ],
  providers: [
    provideIcons({
      lucideArrowUpRight,
      lucideArrowDownRight,
      lucideChartPie,
      lucideChevronLeft,
      lucideChevronRight,
      lucideExternalLink,
      lucideInfo,
      lucideNewspaper,
      lucideScanSearch,
      lucideX,
      lucideZap,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dua.component.html',
  styleUrls: [
    './dua.component.css',
    './dua-motion.css',
    './dua-forecast.css',
    './dua-launcher-pill.css',
  ],
})
export class DuaComponent {
  protected readonly responseParts = insightTextParts;
  protected readonly chartPoints = sparklinePoints;
  readonly holdings = input<readonly AccountHolding[]>([]);
  readonly quotes = input<readonly Instrument[]>([]);
  readonly symbol = input('');
  readonly connected = input(false);
  /** Lifts Dua over an open dialog it accompanies, such as the dashboard order ticket. */
  readonly raised = input(false);
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
  // The Ask Dua label beside the closed launcher. Not on a stock's page, where it would sit on
  // the order ticket, and not while Dua is speaking, whose bubble takes the same place.
  protected readonly showPill = computed(
    () => this.session.minimized() && !this.symbol() && !this.speech.line(),
  );
  protected readonly explaining = signal(false);
  // What Dua is saying beside the launcher, such as an order's outcome, and how it looks.
  protected readonly speech = inject(DuaSpeech);
  private readonly idle = inject(SessionTimeoutService);
  // Dua dozes while the simulated market is outside regular hours, unless it has something to
  // say, and wakes with a stretch when the market opens.
  protected readonly sleeping = computed(() => !this.clock.marketOpen() && !this.speech.line());
  protected readonly waking = signal(false);
  protected readonly rolling = signal(false);
  protected readonly mood = computed<DuaMood>(
    () => this.speech.line()?.mood ?? (this.sleeping() ? 'sleepy' : 'happy'),
  );
  protected readonly wiggling = computed(() => {
    const line = this.speech.line();
    return this.hovered() || (!!line && line.tone !== 'error');
  });
  protected readonly faceVisible = computed(
    () =>
      !this.session.minimized() ||
      this.hasUpdates() ||
      this.hovered() ||
      this.focused() ||
      !!this.speech.line() ||
      this.waking(),
  );
  protected readonly greeting = computed(() =>
    duaGreeting(
      this.clock.currentMarketTimestamp(),
      this.clock.marketCalendar().timezone,
      this.account.profile()?.firstName ?? '',
    ),
  );
  protected readonly marketNote = computed(() =>
    duaMarketNote(
      this.clock.currentMarketTimestamp(),
      this.clock.marketCalendar().timezone,
      this.clock.marketCalendar().tradingDates ?? [],
    ),
  );
  protected readonly title = computed(() => {
    if (this.explaining()) {
      return 'View Details';
    }
    const choice = this.choice();
    return choice ? CHOICE_TITLES[choice] : 'Dua';
  });
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
  // Kept apart from the panel's timers, which opening and closing the panel clear.
  private moveTimers: ReturnType<typeof setTimeout>[] = [];
  private rollClicks: number[] = [];
  private idleLine: number | null = null;
  private lastTime = '';
  private resizeAnimation?: Animation;
  private panelSize?: { height: number; width: number };

  readonly openOutlook = input(false);
  protected readonly snapshotAt = signal('');
  protected readonly displayedContext = signal<ReadContext | null>(null);
  private readonly market = inject(MarketDataService);
  private readonly orders = inject(OrderService);
  private readonly watchlist = inject(WatchlistStore);
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
                      return r.kind === 'ready' ? [q.symbol, r.asOf, r.call] : [q.symbol, r.kind];
                    }),
                ]
              : '',
            insight === 'stock'
              ? [
                  trend?.kind === 'ready' ? [trend.asOf, trend.call] : null,
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
  // Relative to the simulation day, since that is the day the snapshot describes.
  protected readonly asOfLabel = computed(() => {
    const day = this.snapshotDate();
    if (!day || !this.asOf()) return '';
    const today = this.marketDay();
    const yesterday = today ? new Date(`${today}T12:00:00Z`) : null;
    yesterday?.setUTCDate(yesterday.getUTCDate() - 1);
    const date =
      day === today
        ? 'today'
        : day === yesterday?.toISOString().slice(0, 10)
          ? 'yesterday'
          : new Intl.DateTimeFormat('en-US', {
              timeZone: 'UTC',
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            }).format(new Date(`${day}T12:00:00Z`));
    return `As of ${date}, ${this.asOf()}`;
  });
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
  /** Momentum is a log return; this phrases it as a plain percentage move. */
  private momentumPhrase(momentum: number): string {
    const days = this.trend.trend()?.momentumDays ?? 10;
    return `${momentum > 0 ? 'up' : 'down'} ${Math.abs(Math.expm1(momentum) * 100).toFixed(1)}% over the last ${days} trading days`;
  }
  /** The recent-calls dots in words, for screen readers. */
  protected forecastDotsLabel(dots: readonly boolean[]): string {
    return `${dots.filter(Boolean).length} of the last ${dots.length} calls were right`;
  }

  private suggestion(period: 'week' | 'month' = 'week'): DuaCard {
    const at = this.clock.currentMarketTimestamp();
    const trend = this.trend.trend();
    const horizon = trend?.horizonDays ?? 5;
    const when = period === 'week' ? 'this week' : 'this month';
    const rows = this.rows(period);
    const held = new Set(this.holdings().map((h) => h.symbol));
    const candidates = this.quotes().flatMap((q) => {
      const reading = trend ? trendReadingFor(trend, q.symbol, at) : null;
      return reading?.kind === 'ready' ? [{ symbol: q.symbol, reading }] : [];
    });
    const worst = rows
      .filter((r) => r.gain !== null && r.gain < 0 && held.has(r.symbol))
      .sort((a, b) => a.gain! - b.gain!)[0];
    const review =
      worst && candidates.find((c) => c.symbol === worst.symbol && c.reading.call === 'down');
    const buy = candidates
      .filter((c) => c.reading.call === 'up')
      .sort((a, b) => b.reading.momentum - a.reading.momentum)[0];
    const risk =
      buy && this.signals.signals() ? readingFor(this.signals.signals()!, buy.symbol, at) : null;
    const stormier = risk?.kind === 'ready' && risk.call === 'stormier';
    // One reason and one action per suggestion; the evidence is in the details.
    if (review && worst)
      return {
        title: 'What to consider',
        forecast: { record: trendForecastRecord(review.reading), symbol: review.symbol },
        takeaway: `Consider selling ${review.symbol}.`,
        text: `Your largest loss ${when} (${dollars(-worst.gain!)}), and its forecast points down.`,
        advice: 'Selling some shares limits further losses; avoid buying more until it turns up.',
        detail: `Selling is suggested only when a holding is both your largest loss for the period and its direction forecast points down for the next ${horizon} trading days; a loss alone is not a reason to sell.`,
      };
    if (buy)
      return {
        title: 'What to consider',
        forecast: { record: trendForecastRecord(buy.reading), symbol: buy.symbol },
        takeaway: `Consider buying ${buy.symbol}.`,
        text: `Its forecast points up, with the strongest momentum of the stocks forecast to rise.`,
        advice: `Start small and check its stock page first.${stormier ? ' Expect bigger price swings.' : ''}`,
        detail: `${buy.symbol}'s direction forecast points up for the next ${horizon} trading days, and it is ${this.momentumPhrase(buy.reading.momentum)}. Upward opportunities are ranked by recent momentum.`,
      };
    return {
      title: 'What to consider',
      takeaway: 'Hold your current positions.',
      text: 'No forecast is clear enough to buy or sell on.',
      advice: 'Check back after the next session.',
      detail: 'Suggestions use direction forecasts and recent momentum, not purchase losses alone.',
    };
  }
  private buildCards(choice: InsightChoice): DuaCard[] {
    if (choice === 'daily') {
      const rows = this.rows('daily');
      return [
        dailyPerformanceCard(rows),
        moversCard([{ rows }], 3),
        watchlistPulse(
          this.watchlist.status() === 'ready'
            ? this.watchlist.entries().map((e) => e.symbol)
            : null,
          this.quotes(),
        ),
      ];
    }
    if (choice === 'holdings') {
      const week = this.rows('week');
      const month = this.rows('month');
      return [
        periodPerformanceCard(week, month),
        moversCard(
          [
            { rows: week, heading: 'This week' },
            { rows: month, heading: 'This month' },
          ],
          1,
        ),
        this.suggestion(),
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
    // The trend call is null on a week whose move is too small against the stock's usual
    // swings to call; Dua says so instead of turning it into a buy, sell or hold.
    const action =
      trend?.kind !== 'ready'
        ? 'Not enough forecast history yet.'
        : trend.call === null
          ? `No clear direction for ${symbol}.`
          : trend.call === 'up'
            ? `Consider buying ${symbol}.`
            : owned
              ? `Consider selling ${symbol}.`
              : `Hold off on buying ${symbol}.`;
    const swing =
      risk?.kind === 'ready'
        ? `Expect ${risk.call === 'stormier' ? 'bigger' : 'smaller'} price swings.`
        : 'Volatility forecast unavailable.';
    const ratio = volume.ratio;
    const horizon = this.trend.trend()?.horizonDays ?? 5;
    const swingHorizon = this.signals.signals()?.horizonDays ?? 5;
    const percent = (p: number) => `${Math.round(p * 100)}%`;
    // The shown call can come from the recent pattern rather than the model, so a model
    // chance is quoted only when it agrees with the call.
    const trendChance =
      trend?.kind === 'ready' && trend.call !== null
        ? trend.call === 'up'
          ? trend.probability
          : 1 - trend.probability
        : 0;
    const swingChance =
      risk?.kind === 'ready'
        ? risk.call === 'stormier'
          ? risk.probability
          : 1 - risk.probability
        : 0;
    return [
      {
        title: `${symbol} Analysis`,
        emphasizeText: true,
        forecast:
          trend?.kind === 'ready' ? { record: trendForecastRecord(trend), symbol } : undefined,
        takeaway: action,
        text:
          trend?.kind !== 'ready'
            ? 'Wait for more forecast history.'
            : trend.call === null
              ? `${symbol}'s recent move is too small against its usual swings to call.`
              : `The next ${horizon} trading days lean ${trend.call === 'up' ? 'upward' : 'downward'}.`,
        detail:
          trend?.kind === 'ready' && trend.call === null
            ? `This forecast calls ${symbol}'s direction over the next ${horizon} trading days only when its recent move stands out from its usual swings. Right now it does not, so it makes no call.`
            : trend?.kind === 'ready'
              ? `This forecast estimates whether ${symbol}'s price will be higher or lower ${horizon} trading days from now, based on how it has been moving.${
                  trendChance >= 0.5
                    ? ` It gives about a ${percent(trendChance)} chance the price will be ${trend.call === 'up' ? 'higher' : 'lower'}.`
                    : ''
                }`
              : `There is not enough price history for ${symbol} to make a forecast yet.`,
      },
      {
        title: 'Trending activity',
        emphasizeText: true,
        takeaway:
          trend?.kind === 'ready'
            ? `${symbol} is ${trend.momentum > 0 ? 'gaining' : 'losing'} momentum, ${this.momentumPhrase(trend.momentum)}.`
            : 'Not enough trend history yet.',
        text:
          ratio === undefined
            ? `${volume.label}.`
            : Math.abs(ratio - 1) < 0.1
              ? 'Trading volume is about the same as usual.'
              : `Trading volume is ${Math.round(Math.abs(ratio - 1) * 100)}% ${ratio > 1 ? 'higher' : 'lower'} than usual.`,
        detail: `Momentum is how much ${symbol}'s price has changed over the last ${this.trend.trend()?.momentumDays ?? 10} trading days. Volume compares the most recent full trading day with the average of the 20 days before it.`,
      },
      {
        title: 'Volatility outlook',
        forecast:
          risk?.kind === 'ready' ? { record: outlookForecastRecord(risk), symbol } : undefined,
        takeaway: swing,
        text:
          swingChance >= 0.5
            ? `About a ${percent(swingChance)} chance ${symbol}'s price moves ${risk?.kind === 'ready' && risk.call === 'stormier' ? 'more' : 'less'} than usual over the next ${swingHorizon} trading days, up or down.`
            : 'Swing size can change in either direction.',
        meter:
          risk?.kind === 'ready'
            ? {
                value: risk.probability,
                left: 'Smaller swings',
                right: 'Bigger swings',
                label: `Model estimate: ${percent(risk.probability)} chance of bigger swings`,
              }
            : undefined,
        detail:
          risk?.kind === 'ready'
            ? `This estimates whether ${symbol}'s price will move around more or less than usual over the next ${swingHorizon} trading days. It does not say whether the price will go up or down.`
            : 'There is not enough price history to estimate price swings yet.',
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
      // Layout sizes, not bounding boxes, so the panel's scale-in on opening does not skew them.
      const interruptedHeight = this.resizeAnimation ? panel.offsetHeight : undefined;
      this.resizeAnimation?.cancel();
      this.resizeAnimation = undefined;
      panel.classList.remove('resizing');
      const bounds = { height: panel.offsetHeight, width: panel.offsetWidth };
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
    let wasOpen: boolean | null = null;
    effect(() => {
      const open = this.clock.marketOpen();
      untracked(() => {
        if (wasOpen === false && open) {
          this.playMove(this.waking, WAKE_MS);
        }
        wasOpen = open;
      });
    });
    effect(() => {
      const warning = this.idle.warning();
      untracked(() => {
        if (warning && this.idleLine === null) {
          this.idleLine = this.speech.say(IDLE_WARNING_LINE, 'info', {
            duration: null,
            mood: 'sleepy',
          });
        } else if (!warning && this.idleLine !== null) {
          this.speech.dismiss(this.idleLine);
          this.idleLine = null;
        }
      });
    });
    inject(DestroyRef).onDestroy(() => {
      this.resizeAnimation?.cancel();
      this.historyRequest?.unsubscribe();
      this.clearTimers();
      this.moveTimers.forEach(clearTimeout);
      if (this.idleLine !== null) {
        this.speech.dismiss(this.idleLine);
      }
    });
  }

  // Sets a move's class for as long as its animation runs.
  private playMove(move: ReturnType<typeof signal<boolean>>, duration: number): void {
    move.set(true);
    this.moveTimers.push(setTimeout(() => move.set(false), duration));
  }

  // Five quick clicks on the launcher, and Dua does a barrel roll.
  private countRollClick(): void {
    const now = Date.now();
    this.rollClicks = [...this.rollClicks.filter((at) => now - at < ROLL_WINDOW_MS), now];
    if (this.rollClicks.length >= ROLL_CLICKS && !this.rolling()) {
      this.rollClicks = [];
      this.playMove(this.rolling, ROLL_MS);
      this.speech.say('Wheee!', 'info', { duration: 1500, mood: 'excited' });
    }
  }

  private clearTimers(): void {
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }

  protected toggle(): void {
    this.countRollClick();
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
