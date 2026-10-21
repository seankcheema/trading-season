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
} from '@ng-icons/lucide';
import { AccountHolding } from '../dashboard/accounts/account.models';
import { AccountStore } from '../dashboard/accounts/account-store.service';
import { Instrument } from '../dashboard/mock-data';
import { MarketClockService } from '../dashboard/shared/market-clock.service';
import { DuaSession } from './dua-session.service';
import {
  DuaCard,
  DuaChoice,
  dailyCard,
  dailyReview,
  holdingCards,
  stockPreviewCards,
  holdingsPreviewCards,
  dailyPreviewCards,
  DUA_EXPLANATIONS,
  insightTextParts,
  sparklinePoints,
  takeawayParts,
} from './dua-insights';

const CHOICE_TITLES: Record<DuaChoice, string> = {
  daily: 'Daily Review',
  holdings: 'My Holdings',
  stock: 'Stock Insights',
};

@Component({
  selector: 'app-dua',
  host: {
    '[hidden]': 'account.needsTermsAcceptance()',
    '(document:click)': 'closeOnOutsideClick($event)',
  },
  imports: [NgIcon, RouterLink],
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
  protected readonly hovered = signal(false);
  protected readonly focused = signal(false);
  protected readonly hasUpdates = signal(false);
  protected readonly explaining = signal(false);
  protected readonly explanations = computed(() => {
    const choice = this.choice();
    return choice ? DUA_EXPLANATIONS[choice] : [];
  });
  protected readonly faceVisible = computed(
    () => !this.session.minimized() || this.hasUpdates() || this.hovered() || this.focused(),
  );
  protected readonly title = computed(() => {
    if (this.explaining()) {
      return 'Explain these numbers';
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
      const accountId = this.account.selectedAccountId();
      const sessionId = this.clock.marketSessionId();
      const at = this.clock.currentMarketTimestamp();
      const symbol = this.symbol();
      const minimized = this.session.minimized();
      const quotes = this.quotes();
      const holdings = this.holdings();
      const accountUnavailable =
        this.account.needsTermsAcceptance() ||
        this.clock.clockUpdating() ||
        this.account.status() !== 'ready';
      const contextMissing =
        accountId === null ||
        sessionId === null ||
        !Number.isFinite(Date.parse(at)) ||
        !quotes.length;
      if (accountUnavailable || contextMissing) {
        this.hasUpdates.set(false);
        return;
      }
      // Compare rounded insight text, not raw ticks. This adds no requests or polling.
      const selected = quotes.find((q) => q.symbol === symbol);
      const date = new Intl.DateTimeFormat('en-CA', {
        timeZone: this.clock.marketCalendar().timezone,
      }).format(new Date(at));
      const fingerprint = JSON.stringify([
        date,
        dailyReview(holdings, quotes),
        holdingCards(holdings, quotes),
        selected ? dailyCard(selected) : null,
      ]);
      const context = `${accountId}:${sessionId}:${symbol}`;
      this.hasUpdates.set(this.session.hasNewInformation(context, fingerprint, !minimized));
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
      animation.onfinish = () => {
        if (this.resizeAnimation === animation) {
          this.resizeAnimation = undefined;
        }
      };
    });
    inject(DestroyRef).onDestroy(() => {
      this.resizeAnimation?.cancel();
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
    if (this.session.minimized() && this.hasUpdates()) {
      this.session.acknowledgeNotification();
      this.hasUpdates.set(false);
    }
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
  }

  protected backToPrevious(): void {
    if (this.explaining()) {
      this.explaining.set(false);
    } else {
      this.back();
    }
  }

  protected select(choice: DuaChoice): void {
    this.clearTimers();
    this.back();
    this.choice.set(choice);
    if (
      this.clock.clockUpdating() ||
      !Number.isFinite(Date.parse(this.clock.currentMarketTimestamp())) ||
      this.account.status() !== 'ready'
    ) {
      this.message.set('Account or market data is unavailable. Please try again.');
      return;
    }
    const at = this.clock.currentMarketTimestamp();
    this.snapshotContext.set(this.account.selectedAccount()?.name ?? 'No account selected');
    this.snapshotDisconnected.set(!this.connected());
    this.snapshotDate.set(
      new Intl.DateTimeFormat('en-US', {
        timeZone: this.clock.marketCalendar().timezone,
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
      }).format(new Date(at)),
    );
    this.asOf.set(
      new Intl.DateTimeFormat('en-US', {
        timeZone: this.clock.marketCalendar().timezone,
        hour: 'numeric',
        minute: '2-digit',
      }).format(new Date(at)),
    );
    this.cards.set(
      choice === 'daily'
        ? dailyPreviewCards()
        : choice === 'holdings'
          ? holdingsPreviewCards()
          : stockPreviewCards(),
    );
    this.asOf.set('');
    this.snapshotDisconnected.set(false);
  }
}
