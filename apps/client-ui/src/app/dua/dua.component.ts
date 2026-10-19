import {
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
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AccountHolding } from '../dashboard/accounts/account.models';
import { AccountStore } from '../dashboard/accounts/account-store.service';
import { MarketDataService } from '../dashboard/market-data.service';
import { Instrument } from '../dashboard/mock-data';
import { MarketClockService } from '../dashboard/shared/market-clock.service';
import { DuaSession } from './dua-session.service';
import {
  DuaCard,
  DuaChoice,
  dailyCard,
  dailyReview,
  directionCard,
  holdingCards,
  percentChange,
} from './dua-insights';

@Component({
  selector: 'app-dua',
  host: { '[hidden]': 'account.needsTermsAcceptance()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dua.component.html',
  styleUrl: './dua.component.css',
})
export class DuaComponent {
  readonly holdings = input<readonly AccountHolding[]>([]);
  readonly quotes = input<readonly Instrument[]>([]);
  readonly symbol = input('');
  readonly connected = input(false);
  protected readonly session = inject(DuaSession);
  protected readonly account = inject(AccountStore);
  protected readonly clock = inject(MarketClockService);
  private readonly market = inject(MarketDataService);
  private readonly router = inject(Router);
  protected readonly hovered = signal(false);
  protected readonly focused = signal(false);
  protected readonly hoverAcknowledged = signal(false);
  protected readonly hasUpdates = signal(false);
  protected readonly stage = computed(() =>
    !this.session.minimized()
      ? 1
      : this.hasUpdates()
        ? 2
        : !this.hoverAcknowledged() && (this.hovered() || this.focused())
          ? 1
          : 0,
  );
  protected readonly imagesFailed = signal(false);
  protected readonly cards = signal<DuaCard[]>([]);
  protected readonly choice = signal<DuaChoice | null>(null);
  protected readonly loading = signal(false);
  protected readonly message = signal('');
  protected readonly asOf = signal('');
  protected readonly snapshotDisconnected = signal(false);
  private readonly launcher = viewChild<ElementRef<HTMLButtonElement>>('launcher');
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');
  private request?: Subscription;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private lastTime = '';

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
      if (time < this.lastTime) untracked(() => this.back());
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
      if (
        this.account.needsTermsAcceptance() ||
        this.clock.clockUpdating() ||
        this.account.status() !== 'ready' ||
        accountId === null ||
        sessionId === null ||
        !Number.isFinite(Date.parse(at)) ||
        !quotes.length
      ) {
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
    inject(DestroyRef).onDestroy(() => {
      this.request?.unsubscribe();
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
    this.hoverAcknowledged.set(false);
    this.session.minimized.update((value) => !value);
    if (!this.session.minimized()) {
      this.timers.push(setTimeout(() => this.panel()?.nativeElement.focus()));
    }
  }

  protected minimize(): void {
    this.clearTimers();
    this.session.minimized.set(true);
    // Programmatic focus restoration should not leave a closed shark peeking.
    this.focused.set(false);
    this.launcher()?.nativeElement.focus();
    this.hoverAcknowledged.set(true);
  }

  protected back(): void {
    this.request?.unsubscribe();
    this.choice.set(null);
    this.cards.set([]);
    this.message.set('');
    this.asOf.set('');
    this.snapshotDisconnected.set(false);
    this.loading.set(false);
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
    this.snapshotDisconnected.set(!this.connected());
    this.asOf.set(
      new Intl.DateTimeFormat('en-US', {
        timeZone: this.clock.marketCalendar().timezone,
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short',
      }).format(new Date(at)),
    );
    const holdings = this.holdings();
    const quotes = this.quotes();
    if (choice !== 'stock') {
      if (!holdings.some((h) => h.quantity > 0)) {
        this.message.set('No holdings in this account to review yet.');
        return;
      }
      this.cards.set(
        choice === 'daily' ? dailyReview(holdings, quotes) : holdingCards(holdings, quotes),
      );
      const missing = holdings.some(
        (h) =>
          h.quantity > 0 &&
          !quotes.some(
            (q) =>
              q.symbol === h.symbol &&
              percentChange(q.price, choice === 'daily' ? q.price - q.change : h.averageCost) !==
                null,
          ),
      );
      this.message.set(
        missing
          ? 'Some holdings have unavailable market prices or baselines and are omitted.'
          : this.cards().length
            ? ''
            : choice === 'daily'
              ? 'No positive or negative moves with a valid baseline are available.'
              : 'Position performance is unavailable without a valid average purchase cost.',
      );
      return;
    }
    const symbol = this.symbol();
    const quote = quotes.find((q) => q.symbol === symbol);
    const daily = quote ? dailyCard(quote) : null;
    this.cards.set(daily ? [daily] : []);
    if (!daily) this.message.set('Movement since open is unavailable for this stock.');
    const sessionId = this.clock.marketSessionId();
    if (sessionId === null) {
      this.message.set('Market history is unavailable.');
      return;
    }
    this.loading.set(true);
    this.request = this.market.candles(sessionId, symbol, '1D').subscribe({
      next: (series) => {
        // Retained cache entries may belong to a different replay cursor.
        if (
          Math.floor(Date.parse(series.marketTimestamp) / 60_000) !==
          Math.floor(Date.parse(at) / 60_000)
        )
          return;
        this.cards.set([
          ...(daily ? [daily] : []),
          directionCard(symbol, series.points, at, this.clock.marketCalendar().timezone),
        ]);
      },
      error: () => {
        this.loading.set(false);
        this.message.set('Recent price history is unavailable. Please retry.');
      },
      complete: () => {
        this.loading.set(false);
        if (this.cards().length === (daily ? 1 : 0))
          this.message.set(
            'Recent price history is unavailable for this market time. Please retry.',
          );
      },
    });
  }

  protected viewStock(symbol: string): void {
    this.session.minimized.set(true);
    void this.router.navigate(['/dashboard/markets', symbol.toLowerCase()], {
      queryParams: { accountId: this.account.selectedAccountId() },
    });
  }
}
