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
    // The showing card's View Details popover: opens it, and returns its text.
    const details = () => {
      const card = fixture.nativeElement.querySelector(
        '.insight-card:not(.inactive)',
      ) as HTMLElement;
      (card.querySelector('.explain-action') as HTMLButtonElement).click();
      fixture.detectChanges();
      return card.querySelector('.details-pop')?.textContent ?? '';
    };
    return {
      fixture,
      click,
      details,
      text: () => fixture.nativeElement.textContent as string,
    };
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
  it('opens by itself on the first stock page of a visit only, but for the order dialog every time', () => {
    const { fixture, click } = setup();
    fixture.componentRef.setInput('symbol', 'AAPL');
    fixture.detectChanges();
    expect(session.minimized()).toBe(false);
    click('Minimize Dua');
    expect(session.minimized()).toBe(true);

    fixture.componentRef.setInput('symbol', 'MSFT');
    fixture.detectChanges();
    expect(session.minimized()).toBe(true);

    fixture.componentRef.setInput('raised', true);
    fixture.componentRef.setInput('symbol', 'AAPL');
    fixture.detectChanges();
    expect(session.minimized()).toBe(false);
  });
  it('labels the closed launcher Ask Dua on the dashboard, but not on a stock page or while open', () => {
    const { fixture, click } = setup();
    const pill = () => fixture.nativeElement.querySelector('.launcher-pill') as HTMLElement | null;
    expect(session.minimized()).toBe(true);
    expect(pill()?.textContent?.trim()).toBe('Ask Dua');
    expect(pill()?.getAttribute('aria-hidden')).toBe('true');
    expect(fixture.nativeElement.querySelector('.dua-launcher').classList).toContain('has-pill');
    // New insights are counted by the red badge, as on a stock page, not in the label.
    expect(fixture.nativeElement.querySelector('.notification-count')?.textContent?.trim()).toBe(
      '2',
    );

    click('Dua insights');
    expect(pill()).toBeNull();
    click('Minimize Dua');
    expect(pill()).not.toBeNull();

    fixture.componentRef.setInput('symbol', 'AAPL');
    fixture.detectChanges();
    click('Minimize Dua');
    expect(pill()).toBeNull();
  });
  it('keeps a fixed size, with no resize grip', () => {
    const { fixture, click } = setup();
    click('Dua insights');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.resize-grip')).toBeNull();
    expect((el.querySelector('.dua-panel') as HTMLElement).getAttribute('style')).toBeNull();
  });
  it('opens on This Stock from the chart Forecast button, and closes when it shows already', () => {
    const { fixture } = setup();
    fixture.componentRef.setInput('symbol', 'AAPL');
    fixture.detectChanges();
    const dua = fixture.componentInstance;
    const el = fixture.nativeElement as HTMLElement;
    session.minimized.set(true);
    fixture.detectChanges();
    expect(dua.stockOpen()).toBe(false);

    // The button sits outside Dua; its click is not taken for one that closes Dua.
    const opener = document.createElement('button');
    opener.setAttribute('data-opens-dua', '');
    document.body.append(opener);
    onTestFinished(() => opener.remove());
    opener.addEventListener('click', () => dua.toggleStock());
    opener.click();
    fixture.detectChanges();
    expect(session.minimized()).toBe(false);
    expect(dua.stockOpen()).toBe(true);
    expect(el.querySelector('.dua-header h2')?.textContent?.trim()).toBe('This Stock');
    expect(el.querySelector('.insight-card:not(.inactive)')!.classList).toContain('forecast-card');

    opener.click();
    fixture.detectChanges();
    expect(session.minimized()).toBe(true);
    expect(dua.stockOpen()).toBe(false);
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
    const { fixture, click, details, text } = setup();
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
    const shown = details();
    expect(shown).toContain('higher or lower 5 trading days from now');
    expect(shown).toContain('about a 64% chance the price will be higher');
    expect(shown).not.toMatch(/source|probability|been right/i);
    expect(fixture.nativeElement.querySelector('app-trend-read')).toBeNull();
    // A popover over the card, not a page: the card stays, and the info button closes it.
    expect(text()).toContain('Consider buying AAPL');
    const info = active().querySelector('.explain-action') as HTMLButtonElement;
    expect(info.getAttribute('aria-expanded')).toBe('true');
    info.click();
    fixture.detectChanges();
    expect(active().querySelector('.details-pop')).toBeNull();
    // Escape closes the popover only; Dua stays open.
    details();
    active().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(active().querySelector('.details-pop')).toBeNull();
    expect(session.minimized()).toBe(false);
    click('Next insight');
    // A short, larger statement; the figures behind it open from an info button at its end.
    const headline = active().querySelector('.guidance-headline') as HTMLElement;
    expect(headline.textContent!.replace(/\s+/g, ' ').trim()).toBe(
      'AAPL is swinging more than usual.',
    );
    expect(headline.classList).toContain('prominent');
    expect(active().querySelector('.swing-word.swing-more')?.textContent).toBe(
      'swinging more than usual',
    );
    const figures = headline.querySelector('.info-button') as HTMLButtonElement;
    expect(figures.getAttribute('aria-label')).toBe('How big the swings are');
    expect(active().querySelector('.info-pop')).toBeNull();
    figures.click();
    fixture.detectChanges();
    const aside = active().querySelector('.info-pop') as HTMLElement;
    expect(aside.textContent!.trim()).toBe(
      'A typical daily move of 2.0% over the last 5 trading days, against a usual 1.1%.',
    );
    expect(aside.closest('.card-content')).toBeNull();
    expect(figures.getAttribute('aria-expanded')).toBe('true');
    figures.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(active().querySelector('.info-pop')).toBeNull();
    expect(session.minimized()).toBe(false);
    click('Next insight');
    expect(active().textContent).toContain(
      "About a 62% chance AAPL's price moves more than usual over the next 5 trading days",
    );
    expect(active().querySelector('.swing-meter-track').getAttribute('aria-label')).toBe(
      'Model estimate: 62% chance of bigger swings',
    );
    expect(active().querySelector('.swing-word.swing-more')?.textContent).toBe(
      'bigger price swings',
    );
    expect(details()).toContain('It does not say whether the price will go up or down.');
    expect(fixture.nativeElement.querySelector('app-risk-outlook')).toBeNull();
  });
  it('marks forecast cards with a badge, a glowing edge and their record', () => {
    const { fixture, click } = setup();
    fixture.componentRef.setInput('symbol', 'AAPL');
    fixture.detectChanges();
    click('This Stock');
    const active = () =>
      fixture.nativeElement.querySelector('.insight-card:not(.inactive)') as HTMLElement;
    const record = () => active().querySelector('.forecast-record')?.textContent?.trim() ?? '';

    expect(active().classList).toContain('forecast-card');
    expect(active().querySelector('.forecast-chip')?.textContent?.trim()).toBe('Model forecast');
    expect(record()).toBe('84% confidence');
    expect(
      active().querySelector('app-forecast-confidence .fill')!.getAttribute('style'),
    ).toContain('width: 84%');

    click('Next insight');
    // Momentum is measured, not forecast.
    expect(active().classList).not.toContain('forecast-card');
    expect(active().querySelector('.forecast-chip')).toBeNull();

    click('Next insight');
    expect(active().classList).toContain('forecast-card');
    expect(record()).toMatch(/^\d+% confidence$/);
  });
  it('points out a stock forecast once a visit with a toast above the closed launcher', () => {
    vi.useFakeTimers();
    // A later stock page in the visit: Dua stays closed.
    session.marketOpened = true;
    const { fixture } = setup();
    fixture.componentRef.setInput('symbol', 'AAPL');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const toast = () => el.querySelector('.forecast-toast');
    expect(session.minimized()).toBe(true);
    expect(toast()).toBeNull();

    vi.advanceTimersByTime(1500);
    fixture.detectChanges();
    expect(toast()!.closest('[role=status]')).not.toBeNull();
    expect(toast()!.textContent!.replace(/\s+/g, ' ').trim()).toBe(
      "Forecast ready Ask Dua about AAPL's next 5 trading days",
    );

    // It fades out by itself and does not come back for the same stock this visit.
    toast()!.dispatchEvent(new Event('animationend'));
    fixture.detectChanges();
    expect(toast()).toBeNull();
    vi.advanceTimersByTime(5000);
    fixture.detectChanges();
    expect(toast()).toBeNull();
  });
  it('opens Dua on This Stock from the forecast toast', () => {
    vi.useFakeTimers();
    session.marketOpened = true;
    const { fixture } = setup();
    fixture.componentRef.setInput('symbol', 'AAPL');
    fixture.detectChanges();
    vi.advanceTimersByTime(1500);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    (el.querySelector('.forecast-toast-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(session.minimized()).toBe(false);
    expect(el.querySelector('.forecast-toast')).toBeNull();
    expect(el.querySelector('.insight-card:not(.inactive)')!.classList).toContain('forecast-card');
  });
  it('leaves out the forecast toast for a stock Dua opened on, and waits while Dua speaks', () => {
    vi.useFakeTimers();
    const { fixture } = setup();
    const el = fixture.nativeElement as HTMLElement;
    // The visit's first stock page opens Dua, so closing it brings no toast.
    fixture.componentRef.setInput('symbol', 'AAPL');
    fixture.detectChanges();
    expect(session.minimized()).toBe(false);
    session.minimized.set(true);
    fixture.detectChanges();
    vi.advanceTimersByTime(3000);
    fixture.detectChanges();
    expect(el.querySelector('.forecast-toast')).toBeNull();

    session.forecastSeen.clear();
    const speech = TestBed.inject(DuaSpeech);
    const line = speech.say('Order placed.', 'info', { duration: null });
    fixture.detectChanges();
    vi.advanceTimersByTime(3000);
    fixture.detectChanges();
    expect(el.querySelector('.forecast-toast')).toBeNull();
    speech.dismiss(line);
    fixture.detectChanges();
    vi.advanceTimersByTime(1500);
    fixture.detectChanges();
    expect(el.querySelector('.forecast-toast')).not.toBeNull();
  });
  it('says in its menu when a model forecast covers the stock', () => {
    const { fixture, click } = setup();
    fixture.componentRef.setInput('symbol', 'AAPL');
    fixture.detectChanges();
    click('Dua insights');
    const el = fixture.nativeElement as HTMLElement;
    const stock = el.querySelector('.choices button') as HTMLButtonElement;
    expect(stock.getAttribute('aria-label')).toBe('This Stock');
    expect(stock.querySelector('small')!.textContent!.replace(/\s+/g, ' ').trim()).toBe(
      'Forecast What to consider next',
    );
    expect(stock.getAttribute('aria-description')).toBe('Includes a model forecast');

    fixture.componentRef.setInput('symbol', 'ZZZZ');
    fixture.detectChanges();
    const other = el.querySelector('.choices button') as HTMLButtonElement;
    expect(other.querySelector('.choice-forecast')).toBeNull();
    expect(other.hasAttribute('aria-description')).toBe(false);
  });
  it('opens the forecast details in a small card above the info button by its record', () => {
    const { fixture, click } = setup();
    fixture.componentRef.setInput('symbol', 'AAPL');
    fixture.detectChanges();
    click('This Stock');
    const el = fixture.nativeElement as HTMLElement;
    const toggle = () =>
      el.querySelector(
        '.insight-card:not(.inactive) .forecast-record .info-button',
      ) as HTMLButtonElement;
    const pop = () => el.querySelector('.insight-card:not(.inactive) .info-pop');
    expect(el.querySelector('.forecast-link')).toBeNull();
    expect(pop()).toBeNull();
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    expect(toggle().getAttribute('aria-label')).toBe('About this confidence');
    expect(toggle().querySelector('ng-icon')?.getAttribute('name')).toBe('lucideInfo');

    toggle().click();
    fixture.detectChanges();
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
    // It floats over the card, outside the scrolling content that would clip it, so the card
    // keeps its size; once placed, it shows.
    expect(getComputedStyle(pop()!).position).toBe('absolute');
    expect(pop()!.closest('.card-content')).toBeNull();
    expect((pop() as HTMLElement).style.visibility).toBe('visible');
    const text = pop()!.textContent!.replace(/\s+/g, ' ');
    // Short: the frequency behind the score and one caveat.
    expect(text.trim()).toBe(
      'Right on 16 of its last 19 calls. Closed weeks only. It can be wrong.',
    );

    // Escape closes the popover only; Dua stays open.
    pop()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(pop()).toBeNull();
    expect(session.minimized()).toBe(false);

    // A click elsewhere closes it, and so does moving to another card.
    toggle().click();
    fixture.detectChanges();
    (el.querySelector('.insight-card:not(.inactive) h3') as HTMLElement).click();
    fixture.detectChanges();
    expect(pop()).toBeNull();
    toggle().click();
    fixture.detectChanges();
    click('Next insight');
    click('Previous insight');
    expect(pop()).toBeNull();

    // It does not scroll with the card's content, so scrolling closes it.
    toggle().click();
    fixture.detectChanges();
    el.querySelector('.insight-card:not(.inactive) .card-content')!.dispatchEvent(
      new Event('scroll'),
    );
    fixture.detectChanges();
    expect(pop()).toBeNull();
  });
  it('marks the buy or sell suggestion as a forecast with its record', () => {
    const { fixture, click } = setup();
    click('Portfolio Analysis');
    click('Next insight');
    click('Next insight');
    const card = fixture.nativeElement.querySelector('.insight-card:not(.inactive)') as HTMLElement;
    expect(card.querySelector('.guidance-headline')?.textContent?.trim()).toBe(
      'Consider buying AAPL.',
    );
    expect(card.classList).toContain('forecast-card');
    expect(card.querySelector('.forecast-record')?.textContent?.trim()).toBe('84% confidence');
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
      const { fixture, click, details, text } = setup();
      fixture.componentRef.setInput('symbol', 'AAPL');
      fixture.detectChanges();
      click('This Stock');
      expect(text()).toContain('No clear direction for AAPL.');
      expect(text()).not.toMatch(/Consider (buying|selling) AAPL|Hold off on buying AAPL/);
      const active = fixture.nativeElement.querySelector('.insight-card:not(.inactive)');
      expect(active.textContent).toContain(
        "AAPL's recent move is too small against its usual swings to call.",
      );
      const shown = details();
      expect(shown).toContain('Right now it does not, so it makes no call.');
      expect(shown).not.toContain('chance the price will be');
    } finally {
      trend.trend.set(forecasts);
    }
  });
  it('describes recent swings, measured from the volatility file, instead of momentum', () => {
    const files = signals.signals();
    const days = files.symbols.AAPL.days;
    signals.signals.set({
      ...files,
      symbols: {
        AAPL: {
          ...files.symbols.AAPL,
          days: [...days.slice(0, -1), { ...days[days.length - 1], recentVolatility: 0.005 }],
        },
      },
    } as never);
    try {
      const { fixture, click } = setup();
      fixture.componentRef.setInput('symbol', 'AAPL');
      fixture.detectChanges();
      click('This Stock');
      click('Next insight');
      const card = fixture.nativeElement.querySelector(
        '.insight-card:not(.inactive)',
      ) as HTMLElement;
      expect(card.querySelector('h3')!.textContent!.trim()).toBe('Recent activity');
      expect(card.textContent).toContain('AAPL is calmer than usual.');
      expect(card.textContent).not.toContain('typical daily move');
      expect(card.textContent).not.toMatch(/momentum/i);
      expect(card.querySelector('.swing-word.swing-less')?.textContent).toBe('calmer than usual');
    } finally {
      signals.signals.set(files);
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
  it('labels the account, snapshot day and page, with an icon-only help action for details', () => {
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
    expect(details.querySelector('ng-icon')?.getAttribute('name')).toBe('lucideCircleHelp');
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
