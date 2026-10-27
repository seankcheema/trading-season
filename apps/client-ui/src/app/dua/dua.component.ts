import { forkJoin, of, catchError, switchMap, Observable, Subscription } from 'rxjs';
import { MarketDataService, CandleSeries } from '../dashboard/market-data.service';
import { OrderService } from '../dashboard/orders/order.service';
import { InstrumentRef, OrderResult } from '../dashboard/orders/order.models';
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
  afterNextRender,
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
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
  lucideCircleHelp,
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
  highlightParts,
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
import { ForecastConfidenceComponent } from './forecast-confidence.component';
import { SessionTimeoutService } from '../core/auth/session-timeout.service';

// Clicks on the launcher within this long that set off Dua's barrel roll.
const ROLL_CLICKS = 5;
const ROLL_WINDOW_MS = 1500;
const ROLL_MS = 900;
const WAKE_MS = 900;
// How long a stock page settles before Dua's forecast toast fades in.
const FORECAST_TOAST_DELAY_MS = 1500;
export const IDLE_WARNING_LINE =
  "Still there? I'll sign you out in a minute to keep your account safe.";

// An info popover's usual width, as a View Details popover's; beside its button it may be narrower.
const INFO_POP_WIDTH = 300;
// The narrowest window where the compact 360px panel, 16px from the edge, fits beside the centred
// order dialog (at most 896px wide, max-w-4xl) with a small gap.
const BESIDE_ORDER_DIALOG_MIN_WIDTH = 896 + 2 * (360 + 16 + 8);

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
    '[class.raised]': 'raised()',
  },
  imports: [
    DuaCountUpDirective,
    DuaFigureComponent,
    DuaSpeechBubbleComponent,
    ForecastConfidenceComponent,
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
      lucideCircleHelp,
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
    './dua-details-pop.css',
    './dua-forecast-toast.css',
    './dua-info-pop.css',
  ],
})
export class DuaComponent {
  protected readonly responseParts = insightTextParts;
  protected readonly highlightParts = highlightParts;
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
  // Loaded once Dua opens, or on a stock's page, where the forecast toast needs it.
  private readonly loadTrend = effect(() => {
    if ((!this.session.minimized() || this.symbol()) && this.trend.status() === 'idle') {
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
  // What Dua is saying beside the launcher, such as an order's outcome, and how it looks.
  protected readonly speech = inject(DuaSpeech);
  // Whether a forecast covers the open stock now: a plain flag, so the moving clock does not
  // restart what waits on it.
  protected readonly forecastReady = computed(
    () => !!this.symbol() && this.trending()?.kind === 'ready',
  );
  // The stock whose forecast the toast above the closed launcher is pointing out, else ''.
  protected readonly forecastToast = signal('');
  // Once a visit per stock, and only for a stock Dua has not been opened on, the toast fades in
  // after the page settles. Opening Dua, or Dua speaking, takes it away.
  private readonly nudgeForecast = effect((onCleanup) => {
    const symbol = this.symbol();
    const closed = this.session.minimized();
    const ready = closed && this.forecastReady() && !this.speech.line();
    untracked(() => {
      const seen = this.session.forecastSeen;
      if (symbol && !closed) {
        seen.add(symbol);
      }
      if (!ready || this.forecastToast() !== symbol) {
        this.forecastToast.set('');
      }
      if (!ready || seen.has(symbol)) {
        return;
      }
      const timer = setTimeout(() => {
        seen.add(symbol);
        this.forecastToast.set(symbol);
      }, FORECAST_TOAST_DELAY_MS);
      onCleanup(() => clearTimeout(timer));
    });
  });
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
  protected readonly faceVisible = computed(() => {
    const engaged = this.hasUpdates() || this.hovered() || this.focused();
    return !this.session.minimized() || engaged || !!this.speech.line() || this.waking();
  });
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
    const choice = this.choice();
    return choice ? CHOICE_TITLES[choice] : 'Dua';
  });
  protected readonly activeCard = signal(0);
  // The open info popover, such as a forecast's record or a takeaway's figures, by id, or null.
  protected readonly infoOpen = signal<string | null>(null);
  // The card whose View Details popover is open, by index, or null.
  protected readonly detailsOpen = signal<number | null>(null);
  protected readonly cards = signal<DuaCard[]>([]);
  protected readonly choice = signal<DuaChoice | null>(null);
  protected readonly loading = signal(false);
  protected readonly message = signal('');
  protected readonly asOf = signal('');
  protected readonly snapshotDate = signal('');
  protected readonly snapshotContext = signal('');
  protected readonly snapshotDisconnected = signal(false);
  private readonly launcher = viewChild<ElementRef<HTMLButtonElement>>('launcher');
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');
  private readonly injector = inject(Injector);
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
      const unsettled =
        this.account.status() !== 'ready' ||
        this.account.needsTermsAcceptance() ||
        this.clock.clockUpdating();
      if (accountId === null || sessionId === null || !this.marketDay() || unsettled) {
        return [];
      }
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
    if (!day || !this.asOf()) {
      return '';
    }
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
    const fields = ['insight', 'version', 'accountId', 'sessionId', 'symbol'] as const;
    return !!shown && this.contexts().some((c) => fields.every((f) => c[f] === shown[f]));
  });
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
    if (review && worst) {
      return {
        title: 'What to consider',
        forecast: { record: trendForecastRecord(review.reading) },
        takeaway: `Consider selling ${review.symbol}.`,
        text: `Your largest loss ${when} (${dollars(-worst.gain!)}), and its forecast points down.`,
        advice: 'Selling some shares limits further losses; avoid buying more until it turns up.',
        detail: `Selling is suggested only when a holding is both your largest loss for the period and its direction forecast points down for the next ${horizon} trading days; a loss alone is not a reason to sell.`,
      };
    }
    if (buy) {
      return {
        title: 'What to consider',
        forecast: { record: trendForecastRecord(buy.reading) },
        takeaway: `Consider buying ${buy.symbol}.`,
        text: `Its forecast points up, with the strongest momentum of the stocks forecast to rise.`,
        advice: `Start small and check its stock page first.${stormier ? ' Expect bigger price swings.' : ''}`,
        detail: `${buy.symbol}'s direction forecast points up for the next ${horizon} trading days, and it is ${this.momentumPhrase(buy.reading.momentum)}. Upward opportunities are ranked by recent momentum.`,
      };
    }
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
    const action = this.trendAction(symbol, trend, owned);
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
        forecast: trend?.kind === 'ready' ? { record: trendForecastRecord(trend) } : undefined,
        takeaway: action,
        text:
          trend?.kind !== 'ready'
            ? 'Wait for more forecast history.'
            : trend.call === null
              ? `${symbol}'s recent move is too small against its usual swings to call.`
              : `The next ${horizon} trading days lean ${trend.call === 'up' ? 'upward' : 'downward'}.`,
        detail: this.trendDetail(symbol, trend, horizon, trendChance),
      },
      {
        title: 'Recent activity',
        emphasizeText: true,
        emphasizeTakeaway: true,
        ...this.swingsPhrase(symbol, risk, swingHorizon),
        text:
          ratio === undefined
            ? `${volume.label}.`
            : Math.abs(ratio - 1) < 0.1
              ? 'Trading volume is about the same as usual.'
              : `Trading volume is ${Math.round(Math.abs(ratio - 1) * 100)}% ${ratio > 1 ? 'higher' : 'lower'} than usual.`,
        detail: `Swings compare ${symbol}'s typical daily move over the last ${swingHorizon} trading days with its usual size over the ${this.signals.signals()?.usualWindowDays ?? 40} trading days before. Volume compares the most recent full trading day with the average of the 20 days before it.`,
      },
      {
        title: 'Volatility outlook',
        highlight:
          risk?.kind === 'ready'
            ? risk.call === 'stormier'
              ? { text: 'bigger price swings', tone: 'more' }
              : { text: 'smaller price swings', tone: 'less' }
            : undefined,
        forecast: risk?.kind === 'ready' ? { record: outlookForecastRecord(risk) } : undefined,
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
      const historyReady = !this.historyLoading() && this.orders.historyStatus() === 'ready';
      if (this.openOutlook() && !this.legacyOpened && historyReady && this.contexts().length) {
        untracked(() => {
          this.legacyOpened = true;
          this.select('stock');
          this.activeCard.set(2);
          this.detailsOpen.set(2);
          this.session.minimized.set(false);
        });
      }
    });
    effect(() => {
      const active = this.activeCard();
      this.cards();
      untracked(() => {
        this.infoOpen.set(null);
        // A details popover belongs to its card: moving to another card closes it.
        if (this.detailsOpen() !== active) {
          this.detailsOpen.set(null);
        }
      });
    });
    effect(() => {
      const symbol = this.symbol();
      const raised = this.raised();
      if (symbol) {
        untracked(() => {
          this.legacyOpened = false;
          // The dashboard's order dialog, which Dua accompanies, opens it every time there is
          // room beside the dialog, so it never covers the dialog's controls. A stock page opens
          // it only the first time in a visit, so it does not keep covering the order ticket;
          // the launcher is always there to open it again.
          const fits =
            typeof window !== 'undefined' && window.innerWidth >= BESIDE_ORDER_DIALOG_MIN_WIDTH;
          if (raised ? fits : !this.session.marketOpened) {
            this.session.marketOpened ||= !raised;
            this.session.minimized.set(false);
          }
        });
      }
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
        if (!open && !symbol) {
          return;
        }
        this.historyRequest?.unsubscribe();
        this.history.set([]);
        this.historyLoading.set(false);
        if (!ready || accountId === null || sessionId === null || !day) {
          return;
        }
        this.historyLoading.set(true);
        this.historyRequest = forkJoin([this.orders.loadOrders(false), this.orders.instruments()])
          .pipe(
            switchMap(([orders, catalogue]) =>
              this.historySeries(orders, catalogue, accountId, sessionId, symbol),
            ),
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
      const shown = !this.loading() && this.cards().length > 0 && this.snapshotStillCurrent();
      const visible = typeof document !== 'undefined' && document.visibilityState === 'visible';
      if (snapshot && open && shown && visible) {
        untracked(() => {
          if (this.session.unread(snapshot)) {
            this.session.viewedSummary(snapshot);
          }
        });
      }
    });
    afterRenderEffect(() => {
      // Measure after Angular renders the destination view, then animate from the prior size.
      this.choice();
      this.activeCard();
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
        // Nothing to do when the line already matches the warning.
        if (warning === (this.idleLine !== null)) {
          return;
        }
        if (warning) {
          this.idleLine = this.speech.say(IDLE_WARNING_LINE, 'info', {
            duration: null,
            mood: 'sleepy',
          });
        } else {
          this.speech.dismiss(this.idleLine!);
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

  // A year of candles for every stock the account holds, has filled, or has open; null where a
  // stock's request fails.
  private historySeries(
    orders: OrderResult[],
    catalogue: InstrumentRef[],
    accountId: number,
    sessionId: number,
    open: string,
  ): Observable<(CandleSeries | null)[]> {
    const symbols = new Set(
      [...this.account.selectedHoldings().map((h) => h.symbol), open].filter(Boolean),
    );
    for (const order of orders) {
      if (order.accountId !== accountId || order.status !== 'FILLED') {
        continue;
      }
      const instrument = catalogue.find((i) => i.instrumentId === order.instrumentId);
      const symbol = instrument?.simulatedStockSymbol ?? instrument?.ticker;
      if (symbol) {
        symbols.add(symbol);
      }
    }
    if (!symbols.size) {
      return of([]);
    }
    return forkJoin(
      [...symbols].map((symbol) =>
        this.market.candles(sessionId, symbol, '1Y').pipe(catchError(() => of(null))),
      ),
    );
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

  /**
   * How much the stock has been swinging lately, as a short statement, with its typical daily
   * move over the last days beside its usual size, both from the volatility signal file, behind
   * an info button. Measured, not forecast.
   */
  private trendAction(
    symbol: string,
    trend: ReturnType<typeof trendReadingFor> | null,
    owned: boolean,
  ): string {
    if (trend?.kind !== 'ready') {
      return 'Not enough forecast history yet.';
    }
    if (trend.call === null) {
      return `No clear direction for ${symbol}.`;
    }
    if (trend.call === 'up') {
      return `Consider buying ${symbol}.`;
    }
    return owned ? `Consider selling ${symbol}.` : `Hold off on buying ${symbol}.`;
  }

  /** The trend card's View Details text; `chance` is the model's chance for the shown call. */
  private trendDetail(
    symbol: string,
    trend: ReturnType<typeof trendReadingFor> | null,
    horizon: number,
    chance: number,
  ): string {
    if (trend?.kind !== 'ready') {
      return `There is not enough price history for ${symbol} to make a forecast yet.`;
    }
    if (trend.call === null) {
      return `This forecast calls ${symbol}'s direction over the next ${horizon} trading days only when its recent move stands out from its usual swings. Right now it does not, so it makes no call.`;
    }
    const odds =
      chance >= 0.5
        ? ` It gives about a ${Math.round(chance * 100)}% chance the price will be ${trend.call === 'up' ? 'higher' : 'lower'}.`
        : '';
    return `This forecast estimates whether ${symbol}'s price will be higher or lower ${horizon} trading days from now, based on how it has been moving.${odds}`;
  }

  private swingsPhrase(
    symbol: string,
    risk: ReturnType<typeof readingFor> | null,
    days: number,
  ): Pick<DuaCard, 'takeaway' | 'highlight' | 'aside'> {
    if (risk?.kind !== 'ready' || !risk.usualVolatility) {
      return { takeaway: 'Not enough price history to measure its swings yet.' };
    }
    const pct = (value: number) => `${(value * 100).toFixed(1)}%`;
    const ratio = risk.recentVolatility / risk.usualVolatility;
    const aside = {
      label: 'How big the swings are',
      text: `A typical daily move of ${pct(risk.recentVolatility)} over the last ${days} trading days, against a usual ${pct(risk.usualVolatility)}.`,
    };
    if (ratio > 1.1) {
      return {
        takeaway: `${symbol} is swinging more than usual.`,
        highlight: { text: 'swinging more than usual', tone: 'more' },
        aside,
      };
    }
    if (ratio < 0.9) {
      return {
        takeaway: `${symbol} is calmer than usual.`,
        highlight: { text: 'calmer than usual', tone: 'less' },
        aside,
      };
    }
    return { takeaway: `${symbol}'s swings are about usual.`, aside };
  }

  protected toggleDetails(index: number): void {
    this.detailsOpen.set(this.detailsOpen() === index ? null : index);
  }

  /** Escape on a card closes its open popover first, and leaves Dua open. */
  protected closeCardPopover(event: Event): void {
    if (this.detailsOpen() === null) {
      return;
    }
    event.stopPropagation();
    this.detailsOpen.set(null);
    ((event.currentTarget as HTMLElement).querySelector('.explain-action') as HTMLElement)?.focus();
  }

  protected toggleInfo(id: string): void {
    const open = this.infoOpen() === id ? null : id;
    this.infoOpen.set(open);
    if (open === null) {
      return;
    }
    afterNextRender(() => this.placeInfo(open), { injector: this.injector });
  }

  /**
   * An info popover is a small card beside its info button: to its right, or to its left when
   * the card has more room there, as wide as that side allows up to its usual width. It floats
   * over the card so opening it never changes the card's size, and sits in the card, outside the
   * scrolling content, whose animated children would otherwise clip it; it is placed here.
   * Scrolling the content closes it, since it does not follow.
   */
  private placeInfo(id: string): void {
    const pop = this.panel()?.nativeElement.querySelector<HTMLElement>(`#${id}`);
    const card = pop?.closest<HTMLElement>('.insight-card');
    const button = card?.querySelector<HTMLElement>(`[aria-controls="${id}"]`);
    if (!pop || !card || !button) {
      return;
    }
    // Offsets against the card's padding box, where the popover is positioned.
    const cardBox = card.getBoundingClientRect();
    const origin = { x: cardBox.left + card.clientLeft, y: cardBox.top + card.clientTop };
    const buttonBox = button.getBoundingClientRect();
    const inset = 8;
    const gap = 8;
    const right = card.clientWidth - (buttonBox.right - origin.x) - gap - inset;
    const left = buttonBox.left - origin.x - gap - inset;
    const onLeft = left > right;
    const width = Math.min(INFO_POP_WIDTH, Math.max(onLeft ? left : right, 0));
    pop.style.width = `${width}px`;
    pop.style.left = `${onLeft ? buttonBox.left - origin.x - gap - width : buttonBox.right - origin.x + gap}px`;
    // Centred on the button, but not above the card's top edge.
    const middle = buttonBox.top + buttonBox.height / 2 - origin.y;
    pop.style.top = `${Math.max(middle - pop.offsetHeight / 2, inset)}px`;
    pop.style.visibility = 'visible';
  }

  /** Escape closes an open info popover first, returns focus to its button, and leaves Dua open. */
  protected closeInfo(event: Event): void {
    const id = this.infoOpen();
    if (id === null) {
      return;
    }
    event.stopPropagation();
    this.infoOpen.set(null);
    (event.currentTarget as HTMLElement)
      .closest('.insight-card')
      ?.querySelector<HTMLElement>(`[aria-controls="${id}"]`)
      ?.focus();
  }

  protected closeOnOutsideClick(event: MouseEvent): void {
    const path = event.composedPath();
    const inside = (name: string) =>
      path.some((el) => el instanceof Element && el.classList.contains(name));
    if (this.infoOpen() !== null && !inside('info-button') && !inside('info-pop')) {
      this.infoOpen.set(null);
    }
    if (this.detailsOpen() !== null && !inside('details-pop') && !inside('explain-action')) {
      this.detailsOpen.set(null);
    }
    if (this.session.minimized()) {
      return;
    }
    const own = [this.panel()?.nativeElement, this.launcher()?.nativeElement];
    const onDua = own.some((el) => !!el && path.includes(el));
    const opensDua = path.some((el) => el instanceof Element && el.hasAttribute('data-opens-dua'));
    if (onDua || inside('forecast-toast') || opensDua) {
      return;
    }
    // Leave focus on the control the user clicked, rather than returning to the launcher.
    this.minimize(false);
  }

  /** The forecast toast opens Dua on This Stock, whose first card is the forecast. */
  protected openForecastToast(): void {
    this.forecastToast.set('');
    this.openStock();
  }

  /** Whether Dua is open on This Stock, as the chart's Forecast button shows. */
  readonly stockOpen = computed(() => !this.session.minimized() && this.choice() === 'stock');

  /**
   * The chart's Forecast button: opens Dua on This Stock, whose first card is the forecast, or
   * closes Dua when This Stock already shows, leaving focus on the button.
   */
  toggleStock(): void {
    if (this.stockOpen()) {
      this.minimize(false);
      return;
    }
    this.openStock();
  }

  private openStock(): void {
    this.clearTimers();
    this.session.minimized.set(false);
    if (!this.historyLoading()) {
      this.select('stock');
    }
    this.timers.push(setTimeout(() => this.panel()?.nativeElement.focus()));
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
    this.detailsOpen.set(null);
    this.snapshotContext.set('');
    this.displayedContext.set(null);
  }

  protected backToPrevious(): void {
    this.back();
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
