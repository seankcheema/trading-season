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

describe('Dua panel', () => {
  let session: DuaSession;
  const account = {
    selectedAccount: signal({ accountId: 1, name: 'Investing' }),
    selectedAccountId: signal<number | null>(1),
    needsTermsAcceptance: signal(false),
    status: signal('ready'),
    selectedHoldings: signal([{ symbol: 'AAPL', quantity: 2, averageCost: 100 }]),
  };
  const clock = {
    marketSessionId: signal(1),
    marketOpen: signal(true),
    clockUpdating: signal(false),
    currentMarketTimestamp: signal('2026-01-05T15:05:00Z'),
    marketCalendar: signal({ timezone: 'America/Chicago' }),
  };
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
  // 15 times and the momentum pattern 12 (outcomes all up).
  const trendDays = Array.from({ length: 30 }, (_, i) => ({
    date: `2025-12-${String(i + 1).padStart(2, '0')}`,
    probability: 0.64,
    call: i % 20 < 15 ? 'up' : 'down',
    momentum: i % 20 < 12 ? 0.05 : -0.03,
    modelHits: 0,
    modelDays: 0,
    ruleHits: 0,
    ruleDays: 0,
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
        { provide: MarketClockService, useValue: clock },
        { provide: MarketDataService, useValue: market },
        { provide: PlatformSignalsService, useValue: signals },
        { provide: PlatformTrendService, useValue: trend },
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
    expect(choices).toEqual(['Daily Review', 'My Holdings']);
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
  it('uses forecasts and provides inline details instead of demo figures', () => {
    const { fixture, click, text } = setup();
    fixture.componentRef.setInput('symbol', 'AAPL');
    fixture.detectChanges();
    click('This Stock');
    expect(text()).toContain('Consider buying AAPL');
    expect(text()).not.toContain('+24.8%');
    expect(text()).not.toContain('Open the full');
    click('View Details');
    expect(fixture.nativeElement.querySelector('app-trend-read')).not.toBeNull();
    click('Back to results');
    expect(text()).toContain('Consider buying AAPL');
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
    const { click, text } = setup();
    click('My Holdings');
    expect(text()).toContain('Some performance data is unavailable');
    expect(text()).not.toContain('+12.4%');
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
});
