import { HttpClient } from '@angular/common/http';
import { OrderService } from '../dashboard/orders/order.service';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { AccountStore } from '../dashboard/accounts/account-store.service';
import { MarketDataService } from '../dashboard/market-data.service';
import { MarketClockService } from '../dashboard/shared/market-clock.service';
import { DuaComponent } from './dua.component';
import { DuaSession } from './dua-session.service';
import { TokenStorageService } from '../core/auth/token-storage.service';
import { PlatformSignalsService } from '../market-page/risk-outlook/platform-signals.service';
import { PlatformTrendService } from '../market-page/trend-read/platform-trend.service';
import { WatchlistStore } from '../dashboard/watchlist/watchlist-store.service';
import { SessionTimeoutService } from '../core/auth/session-timeout.service';
import { DuaSpeech } from './dua-speech.service';

describe('Dua panel', () => {
  let session: DuaSession;
  const account = {
    selectedAccount: signal({ accountId: 1, name: 'Investing' }),
    selectedAccountId: signal<number | null>(1),
    needsTermsAcceptance: signal(false),
    status: signal('ready'),
    selectedHoldings: signal([{ symbol: 'AAPL', quantity: 2, averageCost: 100 }]),
    profile: signal({ firstName: 'Sean' }),
  };
  const clock = {
    marketSessionId: signal(1),
    marketOpen: signal(true),
    clockUpdating: signal(false),
    currentMarketTimestamp: signal('2026-01-05T15:05:00Z'),
    marketCalendar: signal({ timezone: 'America/Chicago', tradingDates: ['2026-01-05'] }),
  };
  const idle = { warning: signal(false) };
  const market = { candles: vi.fn() };
  // Thirty readings for AAPL before the clock, as the signal file carries them: over any twenty
  // in a row the model is right 15 times and the rule 12 (outcomes all stormier).
  const outlookDays = Array.from({ length: 30 }, (_, i) => ({
    date: `2025-12-${String(i + 1).padStart(2, '0')}`,
    probability: 0.62,
    call: i % 20 < 15 ? 'stormier' : 'calmer',
    usualVolatility: 0.011,
    recentVolatility: i % 20 < 12 ? 0.02 : 0.009,
    modelHits: 0,
    modelDays: 0,
    ruleHits: 0,
    ruleDays: 0,
    outcome: 'stormier',
  }));
  // Thirty trend readings for AAPL before the clock: over any twenty in a row the model is right
  // 15 times and the momentum pattern 12 (outcomes all up). The strong-trend read makes no call
  // on every fourth day and a wrong "down" call on days 0, 10 and 20: 16 right of its last 19 calls.
  const trendDays = Array.from({ length: 30 }, (_, i) => ({
    date: `2025-12-${String(i + 1).padStart(2, '0')}`,
    probability: 0.64,
    call: i % 20 < 15 ? 'up' : 'down',
    momentum: i % 20 < 12 ? 0.05 : -0.03,
    modelHits: 0,
    modelDays: 0,
    ruleHits: 0,
    ruleDays: 0,
    strength: i % 4 === 3 ? 0.3 : 1.2,
    signal: i % 4 === 3 ? null : i % 10 === 0 ? 'down' : 'up',
    signalHits: 0,
    signalDays: 0,
    outcome: 'up',
    move: 0.021,
  }));
  const trend = {
    trend: signal({
      generatedAt: '2025-12-31T00:00:00Z',
      question: 'q',
      horizonDays: 5,
      momentumDays: 10,
      model: 'm',
      rule: 'r',
      signalRule: 's',
      signalDays: 5,
      signalCutoffs: {},
      notice: 'n',
      symbols: { AAPL: { firstDay: '2025-12-01', lastDay: '2025-12-30', days: trendDays } },
    }),
    status: signal('ready'),
    load: vi.fn(() => of(null)),
  };
  const signals = {
    signals: signal({
      generatedAt: '2025-12-31T00:00:00Z',
      question: 'q',
      horizonDays: 5,
      usualWindowDays: 40,
      model: 'm',
      rule: 'r',
      symbols: { AAPL: { firstDay: '2025-12-01', lastDay: '2025-12-30', days: outlookDays } },
    }),
    status: signal('ready'),
    load: vi.fn(() => of(null)),
  };
  beforeEach(() => {
    idle.warning.set(false);
    clock.marketOpen.set(true);
    account.needsTermsAcceptance.set(false);
    account.selectedAccountId.set(1);
    account.status.set('ready');
    clock.clockUpdating.set(false);
    clock.currentMarketTimestamp.set('2026-01-05T15:05:00Z');
    market.candles.mockReturnValue(
      of({ marketTimestamp: clock.currentMarketTimestamp(), points: [] }),
    );
    TestBed.configureTestingModule({
      imports: [DuaComponent],
      providers: [
        provideRouter([]),
        { provide: HttpClient, useValue: { post: () => of([]), put: () => of(null) } },
        {
          provide: OrderService,
          useValue: {
            orders: signal([]),
            catalogue: signal([]),
            historyStatus: signal('ready'),
            loadOrders: () => of([]),
            instruments: () => of([]),
          },
        },
        { provide: AccountStore, useValue: account },
        { provide: TokenStorageService, useValue: { onIdentityChange: () => {} } },
        { provide: SessionTimeoutService, useValue: idle },
        { provide: MarketClockService, useValue: clock },
        { provide: MarketDataService, useValue: market },
        { provide: PlatformSignalsService, useValue: signals },
        { provide: PlatformTrendService, useValue: trend },
        {
          provide: WatchlistStore,
          useValue: {
            entries: signal([{ symbol: 'AAPL', createdAt: '2026-01-02T00:00:00Z' }]),
            status: signal('ready'),
          },
        },
      ],
    });
    session = TestBed.inject(DuaSession);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  function setup() {
    const fixture = TestBed.createComponent(DuaComponent);
    fixture.componentRef.setInput('holdings', [{ symbol: 'AAPL', quantity: 2, averageCost: 100 }]);
    fixture.componentRef.setInput('quotes', [
      { symbol: 'AAPL', name: 'Apple', price: 110, change: 10, changePercent: 10 },
    ]);
    fixture.detectChanges();
    const click = (name: string) => {
      if (name !== 'Dua insights' && session.minimized()) {
        fixture.nativeElement.querySelector('.dua-launcher').click();
        fixture.detectChanges();
      }
      const button = [...fixture.nativeElement.querySelectorAll('button')].find((b: unknown) => {
        const el = b as HTMLButtonElement;
        return el.textContent?.trim().startsWith(name) || el.getAttribute('aria-label') === name;
      }) as HTMLButtonElement;
      button.click();
      fixture.detectChanges();
    };
    return { fixture, click, text: () => fixture.nativeElement.textContent as string };
  }
  it('keeps menu refresh free of a standalone skeleton block', () => {
    const { fixture, click } = setup();
    click('Dua insights');
    fixture.componentInstance['historyLoading'].set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.greeting + .skeleton')).toBeNull();
    expect(fixture.nativeElement.querySelector('.dua-body > .skeleton')).toBeNull();
  });
  it('places metadata immediately below the title and details row', () => {
    const { fixture, click } = setup();
    click('Daily Review');
    const card = fixture.nativeElement.querySelector('.insight-card:not(.inactive)');
    expect(
      card.querySelector('.card-heading').nextElementSibling.classList.contains('card-meta'),
    ).toBe(true);
    expect(
      card.querySelector('.card-meta').nextElementSibling.classList.contains('card-content'),
    ).toBe(true);
  });
  it('keeps the dashboard closed and offers only account insights', () => {
    const { fixture, click } = setup();
    expect(session.minimized()).toBe(true);
    click('Dua insights');
    const choices = [...fixture.nativeElement.querySelectorAll('.choices button')].map((b: any) =>
      b.getAttribute('aria-label'),
    );
    expect(choices).toEqual(['Daily Review', 'Portfolio Analysis']);
  });
  it('opens on a market symbol, with This Stock first, without clearing unread choices', () => {
    const { fixture } = setup();
    fixture.componentRef.setInput('symbol', 'AAPL');
    fixture.detectChanges();
    expect(session.minimized()).toBe(false);
    expect(fixture.nativeElement.querySelector('.choices button').getAttribute('aria-label')).toBe(
      'This Stock',
    );
    expect(fixture.nativeElement.querySelectorAll('.choices button.unread')).toHaveLength(3);
  });
  it('rises over a dialog it accompanies and keeps Escape from also closing that dialog', () => {
    const { fixture } = setup();
    fixture.componentRef.setInput('symbol', 'AAPL');
    fixture.componentRef.setInput('raised', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.style.zIndex).toBe('60');
    const documentEscape = vi.fn();
    document.addEventListener('keydown', documentEscape);
    fixture.nativeElement
      .querySelector('.dua-panel')
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    document.removeEventListener('keydown', documentEscape);
    fixture.detectChanges();
    expect(session.minimized()).toBe(true);
    expect(documentEscape).not.toHaveBeenCalled();
  });
  it('uses forecasts and provides inline details instead of demo figures', () => {
    const { fixture, click, text } = setup();
    fixture.componentRef.setInput('symbol', 'AAPL');
    fixture.detectChanges();
    click('This Stock');
    expect(text()).toContain('Consider buying AAPL');
    expect(text()).not.toContain('+24.8%');
    const active = () => fixture.nativeElement.querySelector('.insight-card:not(.inactive)');
    expect(active().querySelector('h3').textContent.trim()).toBe('AAPL Analysis');
    // A buy or sell suggestion and the trend, without the user's own position.
    expect(active().textContent).toContain('The next 5 trading days lean upward.');
    expect(active().querySelector('.overview-metrics')).toBeNull();
    expect(active().textContent).not.toMatch(/shares|unrealized|\$/i);
    expect(text()).not.toContain('Open the full');
    click('View Details');
    const details = fixture.nativeElement.querySelector('.insight-explanation').textContent;
    expect(details).toContain('higher or lower 5 trading days from now');
    expect(details).toContain('about a 64% chance the price will be higher');
    expect(details).not.toMatch(/source|probability|been right/i);
    expect(fixture.nativeElement.querySelector('app-trend-read')).toBeNull();
    click('Back to results');
    expect(text()).toContain('Consider buying AAPL');
    click('Next insight');
    expect(active().textContent).toContain(
      'AAPL is gaining momentum, up 5.1% over the last 10 trading days.',
    );
    click('Next insight');
    expect(active().textContent).toContain(
      "About a 62% chance AAPL's price moves more than usual over the next 5 trading days",
    );
    expect(active().querySelector('.swing-meter-track').getAttribute('aria-label')).toBe(
      'Model estimate: 62% chance of bigger swings',
    );
    click('View Details');
    expect(fixture.nativeElement.querySelector('app-risk-outlook')).toBeNull();
    expect(fixture.nativeElement.querySelector('.insight-explanation').textContent).toContain(
      'It does not say whether the price will go up or down.',
    );
  });
  it('says there is no clear direction when the trend read makes no call', () => {
    const forecasts = trend.trend();
    const days = forecasts.symbols.AAPL.days;
    trend.trend.set({
      ...forecasts,
      symbols: {
        AAPL: {
          ...forecasts.symbols.AAPL,
          days: [...days.slice(0, -1), { ...days[days.length - 1], signal: null, strength: 0.3 }],
        },
      },
    } as never);
    try {
      const { fixture, click, text } = setup();
      fixture.componentRef.setInput('symbol', 'AAPL');
      fixture.detectChanges();
      click('This Stock');
      expect(text()).toContain('No clear direction for AAPL.');
      expect(text()).not.toMatch(/Consider (buying|selling) AAPL|Hold off on buying AAPL/);
      const active = fixture.nativeElement.querySelector('.insight-card:not(.inactive)');
      expect(active.textContent).toContain(
        "AAPL's recent move is too small against its usual swings to call.",
      );
      click('View Details');
      const details = fixture.nativeElement.querySelector('.insight-explanation').textContent;
      expect(details).toContain('Right now it does not, so it makes no call.');
      expect(details).not.toContain('chance the price will be');
    } finally {
      trend.trend.set(forecasts);
    }
  });
  it('does not reopen a dismissed menu when quotes change', () => {
    const { fixture, click } = setup();
    fixture.componentRef.setInput('symbol', 'AAPL');
    fixture.detectChanges();
    click('Minimize Dua');
    fixture.componentRef.setInput('quotes', [{ symbol: 'AAPL', price: 112, change: 12 }]);
    fixture.detectChanges();
    expect(session.minimized()).toBe(true);
  });
  it('uses unavailable performance instead of purchase-cost prices', () => {
    const { fixture, click, text } = setup();
    click('Portfolio Analysis');
    expect(text()).toContain('Performance is unavailable.');
    expect(text()).not.toContain('+12.4%');
    expect(fixture.nativeElement.querySelector('.period-switch')).toBeNull();
  });
  it('keeps the suggestion to one reason and one action', () => {
    const { fixture, click } = setup();
    click('Portfolio Analysis');
    click('Next insight');
    click('Next insight');
    const card = fixture.nativeElement.querySelector('.insight-card:not(.inactive)');
    expect(card.querySelector('h3').textContent.trim()).toBe('What to consider');
    expect(card.querySelector('.guidance-headline').textContent.trim()).toBe(
      'Consider buying AAPL.',
    );
    expect(card.querySelector('.guidance-description').textContent.trim()).toBe(
      'Its forecast points up, with the strongest momentum of the stocks forecast to rise.',
    );
    expect(card.querySelector('.guidance-advice').textContent.trim()).toBe(
      'Start small and check its stock page first. Expect bigger price swings.',
    );
  });
  it('suggests holding when no forecast is available', () => {
    const forecasts = trend.trend();
    trend.trend.set(null as never);
    try {
      const { fixture, click } = setup();
      click('Portfolio Analysis');
      click('Next insight');
      click('Next insight');
      const card = fixture.nativeElement.querySelector('.insight-card:not(.inactive)');
      expect(card.querySelector('.guidance-headline').textContent.trim()).toBe(
        'Hold your current positions.',
      );
    } finally {
      trend.trend.set(forecasts);
    }
  });
  it('labels the account, snapshot day and page, with an icon-only details action', () => {
    const { fixture, click, text } = setup();
    click('Daily Review');
    const panel = fixture.nativeElement as HTMLElement;
    expect(panel.querySelector('.header-account')?.textContent).toContain('Account: Investing');
    const meta = panel.querySelector('.insight-card:not(.inactive) .card-meta')!.textContent!;
    expect(meta).toMatch(/As of today, 9:05\sAM/);
    expect(meta).toContain('Page 1 of 3');
    const details = panel.querySelector('.insight-card:not(.inactive) .explain-action')!;
    expect(details.getAttribute('aria-label')).toBe('View Details');
    expect(details.textContent!.trim()).toBe('');
    expect(panel.querySelector('[aria-label="Refresh"]')).toBeNull();
    clock.currentMarketTimestamp.set('2026-01-06T15:05:00Z');
    fixture.detectChanges();
    expect(panel.querySelector('.insight-card:not(.inactive) .card-meta')!.textContent).toMatch(
      /As of yesterday/,
    );
    expect(text()).toContain('Your watchlist since the open');
  });
  it('hides for terms and blocks unavailable account data', () => {
    const { fixture, click, text } = setup();
    account.needsTermsAcceptance.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.hidden).toBe(true);
    account.needsTermsAcceptance.set(false);
    account.status.set('error');
    fixture.detectChanges();
    click('Daily Review');
    expect(text()).toContain('Account or market data is unavailable');
  });
  it('greets the user by name and says where the market is in its day', () => {
    const { fixture, click } = setup();
    click('Dua insights');
    // 15:05 UTC is 9:05 in Chicago.
    expect(fixture.nativeElement.querySelector('.greeting').textContent.trim()).toBe(
      'Morning, Sean! What should we review?',
    );
    expect(fixture.nativeElement.querySelector('.market-note').textContent.trim()).toBe(
      'Market closes in 5h 55m',
    );
  });
  it('says lines in a bubble and announces them in the matching live region', () => {
    vi.useFakeTimers();
    const { fixture } = setup();
    const speech = TestBed.inject(DuaSpeech);
    const element = fixture.nativeElement as HTMLElement;
    const bubble = () => element.querySelector('[data-testid="dua-bubble"]');
    const polite = () => element.querySelector('[data-testid="dua-says"]')!.textContent!.trim();
    const alert = () => element.querySelector('[data-testid="dua-warns"]')!.textContent!.trim();

    speech.say('Filled 1 AAPL at $110.00.');
    fixture.detectChanges();
    expect(bubble()?.textContent?.trim()).toBe('Filled 1 AAPL at $110.00.');
    expect(bubble()?.closest('[role="status"]')).not.toBeNull();
    expect(bubble()?.classList).toContain('tone-success');
    expect(polite()).toBe('Filled 1 AAPL at $110.00.');
    expect(element.querySelector('app-dua-figure[data-mood="happy"].wiggle')).not.toBeNull();
    expect(element.querySelector('.launcher-art.face-visible')).not.toBeNull();

    speech.say('Rejected: Not enough cash.', 'error');
    fixture.detectChanges();
    expect(alert()).toBe('Rejected: Not enough cash.');
    expect(polite()).toBe('');
    expect(element.querySelector('.launcher-art app-dua-figure')!.getAttribute('data-mood')).toBe(
      'worried',
    );

    vi.advanceTimersByTime(8000);
    fixture.detectChanges();
    expect(bubble()).toBeNull();
    expect(alert()).toBe('');
  });
  it('celebrates with rising bubbles', () => {
    const { fixture } = setup();
    TestBed.inject(DuaSpeech).say('Your first order is in.', 'celebrate');
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelectorAll('.dua-burst span')).toHaveLength(7);
    expect(element.querySelector('.launcher-art app-dua-figure')!.getAttribute('data-mood')).toBe(
      'excited',
    );
  });
  it('dozes outside market hours and wakes with a stretch at the open', () => {
    vi.useFakeTimers();
    clock.marketOpen.set(false);
    const { fixture } = setup();
    const element = fixture.nativeElement as HTMLElement;
    const launcher = element.querySelector('.dua-launcher') as HTMLElement;
    expect(element.querySelector('.dua-zzz')).not.toBeNull();
    expect(element.querySelector('.launcher-art app-dua-figure')!.getAttribute('data-mood')).toBe(
      'sleepy',
    );
    expect(launcher.classList).not.toContain('waking');

    clock.marketOpen.set(true);
    fixture.detectChanges();
    expect(element.querySelector('.dua-zzz')).toBeNull();
    expect(launcher.classList).toContain('waking');
    vi.advanceTimersByTime(900);
    fixture.detectChanges();
    expect(launcher.classList).not.toContain('waking');
  });
  it('asks whether the user is still there before an idle sign-out', () => {
    const { fixture } = setup();
    const speech = TestBed.inject(DuaSpeech);
    idle.warning.set(true);
    fixture.detectChanges();
    expect(speech.line()?.text).toBe(
      "Still there? I'll sign you out in a minute to keep your account safe.",
    );
    expect(speech.line()?.duration).toBeNull();

    idle.warning.set(false);
    fixture.detectChanges();
    expect(speech.line()).toBeNull();
  });
  it('does a barrel roll after five quick clicks', () => {
    vi.useFakeTimers();
    const { fixture } = setup();
    const launcher = fixture.nativeElement.querySelector('.dua-launcher') as HTMLButtonElement;
    for (let i = 0; i < 4; i++) {
      launcher.click();
      vi.advanceTimersByTime(200);
    }
    fixture.detectChanges();
    expect(launcher.classList).not.toContain('rolling');

    launcher.click();
    fixture.detectChanges();
    expect(launcher.classList).toContain('rolling');
    expect(TestBed.inject(DuaSpeech).line()?.text).toBe('Wheee!');
    vi.advanceTimersByTime(900);
    fixture.detectChanges();
    expect(launcher.classList).not.toContain('rolling');
  });
});
