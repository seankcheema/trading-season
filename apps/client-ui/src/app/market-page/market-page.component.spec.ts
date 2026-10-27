import { signal } from '@angular/core';
import { DuaSession } from '../dua/dua-session.service';
import { PlatformSignalsService } from './risk-outlook/platform-signals.service';
import { PlatformTrendService } from './trend-read/platform-trend.service';
import { SELECTED_ACCOUNT_STORAGE_KEY } from '../dashboard/accounts/account-store.service';
import { ExecutionSettingsService } from '../dashboard/settings-dialog/execution-settings.service';
import { of as savedExecutionPreference } from 'rxjs';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { OrderResult } from '../dashboard/orders/order.models';
import { PLATFORM_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError, Subject } from 'rxjs';
import { vi } from 'vitest';
import {
  MarketDataService,
  MarketSnapshot,
  MarketStreamHandlers,
  CandleSeries,
} from '../dashboard/market-data.service';
import { Timeframe } from '../dashboard/mock-data';
import { PriceChartComponent } from '../dashboard/shared/price-chart.component';
import { MarketPageComponent } from './market-page.component';
import { TradeTicketComponent } from '../dashboard/shared/trade-ticket.component';
import { AuthService } from '../core/auth/auth.service';
import { DuaSpeech } from '../dua/dua-speech.service';
import { OrderService } from '../dashboard/orders/order.service';

const SNAPSHOT: MarketSnapshot = {
  sessionId: 7,
  status: 'OPEN',
  marketTimestamp: '2026-01-05T15:01:00Z',
  serverTimestamp: '2026-01-05T15:01:00Z',
  calendar: {
    timezone: 'America/Chicago',
    firstTimestamp: '2026-01-05T14:30:00Z',
    lastTimestamp: '2026-01-05T21:00:00Z',
    tradingDates: ['2026-01-05'],
  },
  stocks: [
    {
      symbol: 'AAPL',
      companyName: 'Apple Inc.',
      price: 225.8,
      change: 2.04,
      changePercent: 0.91,
      timestamp: '2026-01-05T15:01:00Z',
    },
    {
      symbol: 'MSFT',
      companyName: 'Microsoft Corporation',
      price: 420.5,
      change: -3.5,
      changePercent: -0.83,
      timestamp: '2026-01-05T15:01:00Z',
    },
  ],
};

describe('MarketPageComponent', () => {
  const disconnect = vi.fn();
  let navigate: ReturnType<typeof vi.spyOn>;
  const marketData = {
    snapshot: vi.fn(() => of(SNAPSHOT)),
    setClock: vi.fn(() => of(SNAPSHOT)),
    candles: vi.fn((_sessionId: number, symbol: string, timeframe: Timeframe) =>
      of({
        sessionId: 7,
        symbol,
        timeframe,
        marketTimestamp: SNAPSHOT.marketTimestamp,
        points: [
          {
            timestamp: '2026-01-05T15:00:00Z',
            open: symbol === 'AAPL' ? 224 : 424,
            high: symbol === 'AAPL' ? 226 : 426,
            low: symbol === 'AAPL' ? 223 : 419,
            close: symbol === 'AAPL' ? 225 : 420,
            volume: symbol === 'AAPL' ? 1000 : 2000,
          },
        ],
      }),
    ),
    connect: vi.fn((_sessionId: number, _handlers: MarketStreamHandlers) => disconnect),
  };

  async function setup(
    symbol = 'aapl',
    compare = '',
    accountId = '',
    orders: OrderResult[] = [],
    profile: { termsAccepted?: boolean } = {},
    tab = '',
    query: Record<string, string> = {},
  ): Promise<ComponentFixture<MarketPageComponent>> {
    // The account this tab chose earlier, as AccountStore keeps it; never a URL parameter.
    if (accountId) {
      sessionStorage.setItem(SELECTED_ACCOUNT_STORAGE_KEY, accountId);
    }
    await TestBed.configureTestingModule({
      imports: [MarketPageComponent],
      providers: [
        {
          provide: ExecutionSettingsService,
          useValue: { load: () => savedExecutionPreference({ executionBufferPercent: 0 }) },
        },
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PLATFORM_ID, useValue: 'browser' },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ symbol })),
            queryParamMap: of(
              convertToParamMap({ ...(tab ? { compare, tab } : { compare }), ...query }),
            ),
          },
        },
        { provide: MarketDataService, useValue: marketData },
        // Dua's own suites exercise persistence and forecasts; keep trading request assertions scoped to trading.
        {
          provide: DuaSession,
          useValue: {
            minimized: signal(true),
            forecastSeen: new Set<string>(),
            unread: () => false,
            query: () => {},
            viewedSummary: () => {},
          },
        },
        {
          provide: PlatformSignalsService,
          useValue: { signals: signal(null), status: signal('ready'), load: () => of(null) },
        },
        {
          provide: PlatformTrendService,
          useValue: { trend: signal(null), status: signal('ready'), load: () => of(null) },
        },
      ],
    }).compileComponents();
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(MarketPageComponent);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/me/watchlist').flush([]);
    http.expectOne('/api/me/accounts').flush([
      { accountId: 1, name: 'Investing', openedDate: '2026-01-01' },
      { accountId: 2, name: 'Retirement', openedDate: '2026-01-01' },
    ]);
    http
      .expectOne('/api/accounts/1/holdings')
      .flush([{ symbol: 'AAPL', quantity: 5, averageCost: 100 }]);
    http
      .expectOne('/api/accounts/2/holdings')
      .flush([{ symbol: 'MSFT', quantity: 2, averageCost: 200 }]);
    http
      .expectOne('/api/users/me')
      .flush({ firstName: 'Ada', lastName: 'Lovelace', availableFunds: 10000, ...profile });
    http.expectOne((r) => r.url === '/api/me/cash-transactions').flush([]);
    http.expectOne('/api/orders').flush(orders);
    http.expectOne('/api/instruments').flush([
      { instrumentId: 7, ticker: 'AAPL', simulatedStockSymbol: 'AAPL', tradable: true },
      { instrumentId: 8, ticker: 'MSFT', simulatedStockSymbol: 'MSFT', tradable: true },
    ]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    http
      .match((r) => r.url.startsWith('/forecast/'))
      .forEach((r) => r.flush({}, { status: 503, statusText: 'Unavailable' }));
    http.match((r) => r.url === '/api/me/dua/read-state/query').forEach((r) => r.flush([]));
    return fixture;
  }

  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
    marketData.candles.mockImplementation(
      (_sessionId: number, symbol: string, timeframe: Timeframe) =>
        of({
          sessionId: 7,
          symbol,
          timeframe,
          marketTimestamp: SNAPSHOT.marketTimestamp,
          points: [
            {
              timestamp: '2026-01-05T15:00:00Z',
              open: symbol === 'AAPL' ? 224 : 424,
              high: symbol === 'AAPL' ? 226 : 426,
              low: symbol === 'AAPL' ? 223 : 419,
              close: symbol === 'AAPL' ? 225 : 420,
              volume: symbol === 'AAPL' ? 1000 : 2000,
            },
          ],
        }),
    );
    TestBed.resetTestingModule();
  });

  it('closes every stream when cached and refreshed snapshots arrive before leaving the page', async () => {
    marketData.snapshot.mockReturnValueOnce(of(SNAPSHOT, { ...SNAPSHOT }));
    const fixture = await setup();
    expect(marketData.connect).toHaveBeenCalledTimes(2);
    expect(disconnect).toHaveBeenCalledTimes(1);

    const handlers = marketData.connect.mock.calls[1][1];
    handlers.tick({
      eventId: 2,
      marketTimestamp: '2026-01-05T15:01:10Z',
      serverTimestamp: '2026-01-05T15:01:10Z',
      prices: [{ symbol: 'AAPL', price: 230, sequenceNumber: 2 }],
    });
    expect(
      fixture.componentInstance['instruments']().find((stock) => stock.symbol === 'AAPL')?.price,
    ).toBe(230);
    fixture.destroy();
    expect(disconnect).toHaveBeenCalledTimes(2);
  });

  it('keeps the advanced chart mounted without a visible updating banner during delayed refresh', async () => {
    const fixture = await setup();
    const chart = fixture.debugElement.query(By.directive(PriceChartComponent)).componentInstance;
    const pending = new Subject<CandleSeries>();
    marketData.candles.mockImplementationOnce(() => pending);
    fixture.componentInstance['candleRevision'].update((revision) => revision + 1);
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.directive(PriceChartComponent)).componentInstance).toBe(
      chart,
    );
    const status = [...fixture.nativeElement.querySelectorAll('[role="status"]')].find(
      (element: HTMLElement) => element.textContent?.includes('Updating chart'),
    );
    expect(status?.classList.contains('sr-only')).toBe(true);
    pending.complete();
    fixture.destroy();
  });

  it('loads a direct symbol route with candles and an account-backed trading ticket', async () => {
    const fixture = await setup();
    expect(fixture.componentInstance['symbol']()).toBe('AAPL');
    expect(marketData.candles).toHaveBeenCalledWith(7, 'AAPL', '1D');
    expect(fixture.nativeElement.textContent).toContain('Apple Inc.');
    const quantity = fixture.nativeElement.querySelector(
      '#future-trade-quantity',
    ) as HTMLInputElement;
    quantity.value = '3';
    quantity.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Cash before');
    expect(fixture.nativeElement.textContent).toContain('Cash after');
    expect(fixture.nativeElement.textContent).toContain('Buy 3 AAPL');
    expect(
      fixture.debugElement
        .query(By.directive(PriceChartComponent))
        .componentInstance.showCurrentPrice(),
    ).toBe(true);
  });

  it('opens the dashboard profile actions from the header and has no notifications control', async () => {
    const fixture = await setup();
    const header = fixture.nativeElement.querySelector('header');
    const profile = header.querySelector('[data-testid="profile-dropdown"]');
    expect(profile.querySelector('[data-testid="profile-initials"]').textContent.trim()).toBe(
      fixture.componentInstance['accountStore'].initials(),
    );
    expect(header.querySelector('[data-testid="notifications-dropdown"]')).toBeNull();
    profile.querySelector('summary').click();
    fixture.detectChanges();
    profile.querySelector('button').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-settings-dialog')).not.toBeNull();
    expect(fixture.componentInstance['openHeaderDropdown']()).toBeNull();

    const logout = vi.spyOn(TestBed.inject(AuthService), 'logout').mockReturnValue(of(undefined));
    const navigateToLogin = vi
      .spyOn(TestBed.inject(Router), 'navigateByUrl')
      .mockResolvedValue(true);
    profile.querySelectorAll('button')[1].click();
    expect(logout).toHaveBeenCalledOnce();
    expect(navigateToLogin).toHaveBeenCalledWith('/login');
  });

  it('preserves the order draft while switching away from Trading', async () => {
    const fixture = await setup();
    const root = fixture.nativeElement as HTMLElement;
    const ticket = root.querySelector('app-trade-ticket');
    const quantity = root.querySelector('#future-trade-quantity') as HTMLInputElement;
    quantity.value = '3';
    quantity.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    fixture.componentInstance['insightTab'].set('recent-orders');
    fixture.detectChanges();
    expect(root.querySelector('app-trade-ticket')).toBe(ticket);
    expect((root.querySelector('.trading-content') as HTMLElement).hidden).toBe(true);
    fixture.componentInstance['insightTab'].set('trading');
    fixture.detectChanges();
    expect(quantity.value).toBe('3');
    expect((root.querySelector('.trading-content') as HTMLElement).hidden).toBe(false);
  });

  it('shows shared cash and the selected portfolio in the Trading tab', async () => {
    const fixture = await setup();
    const panel = fixture.nativeElement.querySelector('[data-testid="account-value-panel"]');
    expect(panel.querySelector('[data-testid="available-cash"]').textContent).toContain(
      '$10,000.00',
    );
    expect(panel.querySelector('[data-testid="account-portfolio-value"]').textContent).toContain(
      '$1,129.00',
    );
    expect(
      fixture.nativeElement.querySelector('app-market-clock-control').nextElementSibling.tagName,
    ).toBe('APP-ACCOUNT-CONTROL');
    expect(panel.querySelector('app-account-control')).toBeNull();
    expect(
      fixture.nativeElement.querySelector('[role=tab][aria-selected=true]').textContent.trim(),
    ).toBe('Trading');
    fixture.componentInstance['selectAccount'](2);
    fixture.detectChanges();
    expect(panel.querySelector('[data-testid="account-portfolio-value"]').textContent).toContain(
      '$841.00',
    );
    expect(panel.querySelector('[data-testid="available-cash"]').textContent).toContain(
      '$10,000.00',
    );
    fixture.componentInstance['accountStore'].status.set('loading');
    fixture.detectChanges();
    expect(panel.textContent).toContain('Loading account balances');
    expect(panel.querySelector('[data-testid="available-cash"]').textContent).not.toContain('$');
    // Each balance is a placeholder while it loads, and a dash only once loading has failed.
    for (const testId of ['available-cash', 'account-portfolio-value']) {
      const balance = panel.querySelector(`[data-testid="${testId}"]`);
      expect(balance.querySelector('.skeleton').getAttribute('aria-hidden')).toBe('true');
      expect(balance.textContent).not.toContain('—');
    }
    expect(panel.querySelector('p[role="status"]').className).toContain('sr-only');
    fixture.componentInstance['accountStore'].status.set('error');
    fixture.detectChanges();
    expect(panel.textContent).toContain('Retry accounts');
    expect(panel.querySelector('.skeleton')).toBeNull();
    expect(panel.querySelector('[data-testid="available-cash"]').textContent).toContain('—');
    expect(panel.textContent).not.toContain('Loading account balances');
  });

  it('previews available cash as the buy slider changes without reducing the buying limit', async () => {
    const fixture = await setup();
    const cash = fixture.nativeElement.querySelector('[data-testid="available-cash"]');
    const slider = fixture.nativeElement.querySelector('input[type="range"]') as HTMLInputElement;
    const maximum = slider.max;
    slider.value = '3';
    slider.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(cash.textContent).toContain('$9,322.60');
    expect(slider.max).toBe(maximum);
    expect(fixture.componentInstance['accountStore'].cashBalance()).toBe(10000);

    const ticket = fixture.debugElement.query(By.directive(TradeTicketComponent)).componentInstance;
    ticket.selectSide('sell');
    fixture.detectChanges();
    expect(cash.textContent).toContain('$10,000.00');
    ticket.selectSide('buy');
    fixture.detectChanges();
    expect(cash.textContent).toContain('$9,322.60');

    slider.value = '0';
    slider.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(cash.textContent).toContain('$10,000.00');
  });

  it('distinguishes zero balances from an account with no portfolio selection', async () => {
    const fixture = await setup();
    const http = TestBed.inject(HttpTestingController);
    fixture.componentInstance['accountStore'].load(true);
    http
      .expectOne('/api/me/accounts')
      .flush([{ accountId: 1, name: 'Empty portfolio', openedDate: '2026-01-01' }]);
    http.expectOne('/api/accounts/1/holdings').flush([]);
    http
      .expectOne('/api/users/me')
      .flush({ firstName: 'Ada', lastName: 'Lovelace', availableFunds: 0 });
    http.expectOne((r) => r.url === '/api/me/cash-transactions').flush([]);
    fixture.detectChanges();
    const panel = fixture.nativeElement.querySelector('[data-testid="account-value-panel"]');
    expect(panel.querySelector('[data-testid="available-cash"]').textContent).toContain('$0.00');
    expect(panel.querySelector('[data-testid="account-portfolio-value"]').textContent).toContain(
      '$0.00',
    );
    fixture.componentInstance['accountStore'].load(true);
    http.expectOne('/api/me/accounts').flush([]);
    http
      .expectOne('/api/users/me')
      .flush({ firstName: 'Ada', lastName: 'Lovelace', availableFunds: 0 });
    http.expectOne((r) => r.url === '/api/me/cash-transactions').flush([]);
    fixture.detectChanges();
    expect(panel.textContent).toContain('Create an account to trade');
    expect(
      panel.querySelector('[data-testid="account-portfolio-value"]').textContent,
    ).not.toContain('$');
  });

  it('defaults to an area chart and lets the user select another chart mode', async () => {
    const fixture = await setup();
    const chart = fixture.debugElement.query(By.directive(PriceChartComponent)).componentInstance;
    expect(fixture.componentInstance['chartMode']()).toBe('area');
    expect(chart.mode()).toBe('area');
    expect(
      fixture.nativeElement.querySelector('[aria-controls="chart-mode-picker"]').textContent,
    ).toContain('Graph view: Area');
    expect(fixture.nativeElement.querySelector('#chart-mode-picker')).toBeNull();

    (
      fixture.nativeElement.querySelector(
        '[aria-controls="chart-mode-picker"]',
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.chart-mode-option')).toHaveLength(6);

    (
      fixture.nativeElement.querySelector('[aria-label="Candles chart"]') as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    expect(fixture.componentInstance['chartMode']()).toBe('candles');
    expect(chart.mode()).toBe('candles');
    expect(
      fixture.nativeElement.querySelector('[aria-controls="chart-mode-picker"]').textContent,
    ).toContain('Graph view: Candles');
    expect(fixture.nativeElement.querySelector('.chart-candle')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.chart-price-line')).toBeNull();
  });

  it('starts with indicators off and toggles multiple indicators from the menu', async () => {
    const fixture = await setup();
    const component = fixture.componentInstance;
    const chart = fixture.debugElement.query(By.directive(PriceChartComponent)).componentInstance;
    const button = fixture.nativeElement.querySelector(
      '[aria-controls="indicator-picker"]',
    ) as HTMLButtonElement;

    expect(component['enabledIndicators']()).toEqual([]);
    expect(chart.enabledIndicators()).toEqual([]);
    expect(button.textContent?.trim()).toBe('Indicators');
    expect(fixture.nativeElement.querySelector('#indicator-picker')).toBeNull();

    button.click();
    fixture.detectChanges();
    const options = Array.from(
      fixture.nativeElement.querySelectorAll('#indicator-picker [role="menuitemcheckbox"]'),
    ) as HTMLButtonElement[];
    expect(options.map((option) => option.textContent?.trim())).toEqual([
      'SMA 20',
      'EMA 20',
      'Bollinger Bands 20 · 2σ',
      'RSI 14',
    ]);

    options[0].click();
    options[2].click();
    options[3].click();
    fixture.detectChanges();
    expect(component['enabledIndicators']()).toEqual(['sma', 'bollinger', 'rsi']);
    expect(chart.enabledIndicators()).toEqual(['sma', 'bollinger', 'rsi']);
    expect(fixture.nativeElement.querySelector('.chart-panel').classList).toContain(
      'chart-panel-with-rsi',
    );
    expect(fixture.nativeElement.querySelector('.rsi-pane')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.technical-footer')).toBeNull();
    expect(fixture.nativeElement.querySelector('.chart-indicator-key').textContent).toContain(
      'Bollinger 20 · 2σ',
    );
  });

  it('closes the indicator menu on outside clicks', async () => {
    const fixture = await setup();
    (
      fixture.nativeElement.querySelector('[aria-controls="indicator-picker"]') as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#indicator-picker')).not.toBeNull();

    document.body.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#indicator-picker')).toBeNull();
  });

  it('applies enabled indicators to both comparison charts', async () => {
    const fixture = await setup('aapl', 'msft');
    fixture.componentInstance['toggleIndicator']('ema');
    fixture.componentInstance['toggleIndicator']('rsi');
    fixture.detectChanges();
    const charts = fixture.debugElement.queryAll(By.directive(PriceChartComponent));
    expect(charts).toHaveLength(2);
    expect(
      charts.every((chart) => chart.componentInstance.enabledIndicators().join(',') === 'ema,rsi'),
    ).toBe(true);
    expect(fixture.nativeElement.querySelectorAll('.rsi-pane')).toHaveLength(2);
  });

  it('keeps only one toolbar dropdown open at a time', async () => {
    const fixture = await setup();
    const chartModeButton = fixture.nativeElement.querySelector(
      '[aria-controls="chart-mode-picker"]',
    ) as HTMLButtonElement;
    const compareButton = fixture.nativeElement.querySelector(
      '[aria-controls="comparison-picker"]',
    ) as HTMLButtonElement;

    chartModeButton.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#chart-mode-picker')).not.toBeNull();

    compareButton.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#chart-mode-picker')).toBeNull();
    expect(fixture.nativeElement.querySelector('#comparison-picker')).not.toBeNull();

    chartModeButton.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#comparison-picker')).toBeNull();
    expect(fixture.nativeElement.querySelector('#chart-mode-picker')).not.toBeNull();
  });

  it('positions the comparison menu under its trigger', async () => {
    const fixture = await setup();
    (
      fixture.nativeElement.querySelector(
        '[aria-controls="comparison-picker"]',
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    fixture.componentInstance['positionToolbarMenu']();

    expect(fixture.componentInstance['openToolbarMenu']()).toBe('comparison');
    expect(fixture.componentInstance['toolbarMenuPosition']().top).toBeGreaterThanOrEqual(0);
  });

  it('refreshes balances and reports a rejection when a pending order resolves', async () => {
    const fixture = await setup('aapl', '', '2');
    const refresh = stubRefresh(fixture);
    const resolved = TestBed.inject(OrderService).pendingResolved;

    resolved.next(order({ accountId: 1, status: 'FILLED' }));
    expect(refresh).toHaveBeenLastCalledWith(1);
    expect(TestBed.inject(DuaSpeech).line()).toBeNull();

    resolved.next(
      order({ accountId: undefined, status: 'REJECTED', rejectionReason: 'Out of funds' }),
    );
    expect(refresh).toHaveBeenLastCalledWith(2);
    expect(TestBed.inject(DuaSpeech).line()?.text).toBe('Out of funds');

    resolved.next(order({ accountId: undefined, status: 'REJECTED', rejectionReason: null }));
    expect(TestBed.inject(DuaSpeech).line()?.text).toBe('Order rejected.');
  });

  it('skips the balance refresh when a resolved order has no account to refresh', async () => {
    const fixture = await setup();
    const store = fixture.componentInstance['accountStore'];
    vi.spyOn(store, 'selectedAccountId').mockReturnValue(null);
    const refresh = stubRefresh(fixture);

    TestBed.inject(OrderService).pendingResolved.next(order({ accountId: undefined }));

    expect(refresh).not.toHaveBeenCalled();
  });

  it('renders the streamlined header and demo market metrics', async () => {
    const fixture = await setup();
    const text = fixture.nativeElement.textContent as string;
    expect(fixture.nativeElement.querySelector('[aria-label="Back to dashboard"]')).not.toBeNull();
    expect(text).not.toContain('TradingSeason');
    expect(text).not.toContain('Watchlist');
    expect(text).toContain('Portfolio');
    expect(text).toContain('Range Volume');
    expect(text).toContain('Bid');
    expect(text).toContain('Ask');
    expect(text).toContain('Spread');
    expect(text).toContain('Open');
    expect(text).toContain('Day Range');
    const metricsText = fixture.nativeElement.querySelector('.market-metrics')?.textContent;
    expect(metricsText).not.toContain('Trend');
    expect(metricsText).not.toContain('Data');
    expect(fixture.componentInstance['rangeVolume']()).toBe(1000);
    expect(text).toContain('$3.42T');
    expect(text).not.toContain('P/E (TTM)');
    expect(text).not.toContain('52W Range');
    expect(text).not.toContain('Beta');
    expect(text).not.toContain('Div Yield');
    expect(text).not.toContain('SIMULATED');
    expect(fixture.nativeElement.querySelector('.market-identity')?.textContent).not.toContain(
      '+$',
    );
  });

  it('keeps the header search above the chart controls', async () => {
    const fixture = await setup();
    const header = fixture.nativeElement.querySelector('.market-nav') as HTMLElement;
    const profile = fixture.nativeElement.querySelector(
      '[aria-label="Select account"]',
    ) as HTMLButtonElement;

    expect(getComputedStyle(header).position).toBe('relative');
    // Above the chart menus (40) so its own dropdowns open over the page, but below the
    // dialog backdrops (50) so a dialog covers the header too.
    expect(Number(getComputedStyle(header).zIndex)).toBeGreaterThan(40);
    expect(Number(getComputedStyle(header).zIndex)).toBeLessThan(50);
    expect(header.classList).not.toContain('border-b');
    expect(profile.classList).toContain('border-border');
    expect(profile.className).not.toContain('border-primary');
  });

  it('opens the Outlook tool when the link asks for it', async () => {
    const fixture = await setup('aapl', '', '', [], {}, 'outlook');
    expect(fixture.componentInstance['insightTab']()).toBe('trading');
    expect(fixture.componentInstance['duaOutlook']()).toBe(true);
    expect(fixture.nativeElement.querySelector('[data-testid="market-outlook"]')).toBeNull();
  });

  it("opens Dua on This Stock from the chart's Forecast button, and closes it pressed again", async () => {
    const fixture = await setup('aapl');
    const el = fixture.nativeElement as HTMLElement;
    const session = TestBed.inject(DuaSession);
    const button = el.querySelector('.forecast-toggle') as HTMLButtonElement;
    const title = () => el.querySelector('app-dua .dua-header h2')?.textContent?.trim();
    expect(button.getAttribute('aria-pressed')).toBe('false');

    button.click();
    fixture.detectChanges();
    expect(session.minimized()).toBe(false);
    expect(title()).toBe('This Stock');
    expect(button.getAttribute('aria-pressed')).toBe('true');
    // The market tools keep their tab.
    expect(fixture.componentInstance['insightTab']()).toBe('trading');

    button.click();
    fixture.detectChanges();
    expect(session.minimized()).toBe(true);
    expect(button.getAttribute('aria-pressed')).toBe('false');
  });

  it('toggles live tailing for both comparison charts from the navigation bar', async () => {
    const fixture = await setup('aapl', 'msft');
    const button = fixture.nativeElement.querySelector(
      '[aria-label="Live tailing"]',
    ) as HTMLButtonElement;
    // A lightning toggle inside the navigation bar, still named for screen readers.
    expect(button.closest('.chart-control-bar')).not.toBeNull();
    expect(button.textContent).toContain('Live tailing');
    expect(button.getAttribute('aria-pressed')).toBe('true');
    const charts = fixture.debugElement.queryAll(By.directive(PriceChartComponent));
    expect(charts).toHaveLength(2);
    button.click();
    fixture.detectChanges();
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(charts.every((chart) => !chart.componentInstance.liveTailing())).toBe(true);
    button.click();
    fixture.detectChanges();
    expect(charts.every((chart) => chart.componentInstance.liveTailing())).toBe(true);
  });

  it('offers Trading and Recent Orders in the market tools', async () => {
    const fixture = await setup();
    const tabs = Array.from(
      fixture.nativeElement.querySelectorAll('[role="tab"]'),
    ) as HTMLButtonElement[];
    expect(tabs.map((tab) => tab.textContent?.trim())).toEqual(['Trading', 'Recent Orders']);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    tabs[1].click();
    fixture.detectChanges();
    expect(tabs[1].getAttribute('aria-selected')).toBe('true');
    expect(fixture.nativeElement.querySelector('.overview-feed')).toBeNull();
    expect(fixture.nativeElement.querySelector('.news-feed')).toBeNull();
    expect(fixture.nativeElement.querySelector('[aria-label="Ask market AI"]')).toBeNull();
  });

  it('includes recent orders and expands the chart when tools are collapsed', async () => {
    const fixture = await setup();
    expect(fixture.nativeElement.textContent).toContain('Recent Orders');
    expect(fixture.nativeElement.textContent).not.toContain('Executions');
    expect(fixture.nativeElement.textContent).not.toContain('Trading coming soon');
    expect(fixture.nativeElement.querySelector('[aria-label="Zoom in"]')).not.toBeNull();
    expect(fixture.componentInstance['toolsCollapsed']()).toBe(false);
    const toggle = fixture.nativeElement.querySelector(
      '[aria-label="Hide market tools"]',
    ) as HTMLButtonElement;
    toggle.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.market-grid').classList).toContain(
      'tools-collapsed',
    );
    expect(fixture.nativeElement.querySelector('.tools-column').getAttribute('aria-hidden')).toBe(
      'true',
    );
    const open = fixture.nativeElement.querySelector(
      '[aria-label="Open market tools"]',
    ) as HTMLButtonElement;
    expect(open).not.toBeNull();
    open.click();
    fixture.detectChanges();
    expect(fixture.componentInstance['toolsCollapsed']()).toBe(false);
    expect(fixture.nativeElement.querySelector('.market-grid').classList).not.toContain(
      'tools-collapsed',
    );
  });

  it('restores a comparison from the URL and loads both charts for the same timeframe', async () => {
    const fixture = await setup('aapl', 'msft');
    expect(fixture.componentInstance['comparisonSymbol']()).toBe('MSFT');
    expect(marketData.candles).toHaveBeenCalledWith(7, 'AAPL', '1D');
    expect(marketData.candles).toHaveBeenCalledWith(7, 'MSFT', '1D');
    expect(fixture.nativeElement.querySelectorAll('.comparison-chart').length).toBe(2);
    const summary = fixture.nativeElement.querySelector('.market-summary');
    expect(summary.textContent).toContain('AAPL');
    expect(summary.textContent).toContain('Apple Inc.');
    expect(summary.textContent).not.toContain('MSFT');
    expect(summary.textContent).not.toContain('Microsoft Corporation');
    expect(summary.textContent).toContain('1,000');
    const charts = fixture.debugElement.queryAll(By.directive(PriceChartComponent));
    expect(charts).toHaveLength(2);
    expect(charts.every((chart) => chart.componentInstance.candles().length === 1)).toBe(true);
  });

  it.each([2.04, -3.5, 0])('formats comparison dollar changes for %s', async (change) => {
    marketData.snapshot.mockReturnValueOnce(
      of({
        ...SNAPSHOT,
        stocks: SNAPSHOT.stocks.map((stock) => ({ ...stock, change })),
      }),
    );
    const fixture = await setup('aapl', 'msft');
    const sections = fixture.nativeElement.querySelectorAll('.comparison-chart');
    expect(sections).toHaveLength(2);
    const expected = change === 0 ? '$0.00' : change < 0 ? '-$3.50' : '$2.04';
    sections.forEach((section: HTMLElement, index: number) => {
      const header = section.querySelector(
        '.comparison-price-label-left, .comparison-price-label-right',
      );
      expect(header?.closest('.chart-toolbar')).not.toBeNull();
      expect(section.querySelector('.chart-indicator-key')).toBeNull();
      expect(header?.textContent).toContain(index === 0 ? 'AAPL' : 'MSFT');
      expect(header?.textContent).toContain(expected);
      expect(header?.textContent).toContain('%');
    });
  });

  it('opens the comparison picker and writes the selected peer to the URL', async () => {
    const fixture = await setup();
    const compareButton = Array.from(
      fixture.nativeElement.querySelectorAll('.tool-button') as NodeListOf<HTMLButtonElement>,
    ).find((button) => button.textContent?.includes('Compare')) as HTMLButtonElement;
    compareButton.click();
    fixture.detectChanges();
    expect(compareButton.getAttribute('aria-expanded')).toBe('true');
    const search = fixture.nativeElement.querySelector(
      '#comparison-picker input',
    ) as HTMLInputElement;
    search.value = 'MSFT';
    search.dispatchEvent(new Event('input'));
    search.dispatchEvent(new Event('focus'));
    fixture.detectChanges();
    (
      fixture.nativeElement.querySelector('#comparison-picker [role="option"]') as HTMLElement
    ).click();
    expect(navigate).toHaveBeenCalledWith([], {
      relativeTo: TestBed.inject(ActivatedRoute),
      queryParams: { compare: 'msft' },
      queryParamsHandling: 'merge',
      replaceUrl: false,
    });
  });

  it('keeps the comparison picker open for inside clicks and closes it outside', async () => {
    const fixture = await setup();
    const compareButton = Array.from(
      fixture.nativeElement.querySelectorAll('.tool-button') as NodeListOf<HTMLButtonElement>,
    ).find((button) => button.textContent?.includes('Compare')) as HTMLButtonElement;
    compareButton.click();
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('#comparison-picker') as HTMLElement).click();
    fixture.detectChanges();
    expect(fixture.componentInstance['comparisonPickerOpen']()).toBe(true);

    document.body.click();
    fixture.detectChanges();
    expect(fixture.componentInstance['comparisonPickerOpen']()).toBe(false);
  });

  it('removes a comparison through the chart toolbar', async () => {
    const fixture = await setup('aapl', 'msft');
    (
      fixture.nativeElement.querySelector('[aria-label="Remove comparison"]') as HTMLButtonElement
    ).click();
    expect(navigate).toHaveBeenCalledWith([], {
      relativeTo: TestBed.inject(ActivatedRoute),
      queryParams: { compare: null },
      queryParamsHandling: 'merge',
      replaceUrl: false,
    });
  });

  it('removes invalid and duplicate comparison query parameters', async () => {
    const invalidFixture = await setup('aapl', 'missing');
    expect(invalidFixture.componentInstance['comparisonSymbol']()).toBe('');
    expect(navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        queryParams: { compare: null },
        replaceUrl: true,
      }),
    );
    invalidFixture.destroy();

    TestBed.resetTestingModule();
    const duplicateFixture = await setup('aapl', 'aapl');
    expect(duplicateFixture.componentInstance['comparisonSymbol']()).toBe('');
    expect(navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        queryParams: { compare: null },
        replaceUrl: true,
      }),
    );
  });

  it('updates both instruments from a live market tick', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const fixture = await setup('aapl', 'msft');
    const handlers = marketData.connect.mock.calls[0][1];
    handlers.tick({
      eventId: 2,
      marketTimestamp: '2026-01-05T15:02:00Z',
      serverTimestamp: '2026-01-05T15:02:00Z',
      prices: [
        { symbol: 'AAPL', price: 226.8, sequenceNumber: 2 },
        { symbol: 'MSFT', price: 418.5, sequenceNumber: 2 },
      ],
    });
    fixture.detectChanges();
    expect(fixture.componentInstance['instrument']()?.price).toBe(226.8);
    expect(fixture.componentInstance['comparisonInstrument']()?.price).toBe(418.5);
    expect(fixture.componentInstance['marketTimestamp']()).toBe('2026-01-05T15:02:00Z');
    expect(fixture.componentInstance['tickAnimations']().get('AAPL')).toEqual({
      direction: 'gain',
      durationMs: 750,
      revision: 1,
    });
    expect(fixture.componentInstance['tickAnimations']().get('MSFT')?.direction).toBe('loss');
    vi.restoreAllMocks();
  });

  it('replaces an active price animation when another tick arrives', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const fixture = await setup('aapl');
    vi.useFakeTimers();
    const handlers = marketData.connect.mock.calls[0][1];

    handlers.tick({
      eventId: 2,
      marketTimestamp: '2026-01-05T15:01:01Z',
      serverTimestamp: '2026-01-05T15:01:01Z',
      prices: [{ symbol: 'AAPL', price: 226.8, sequenceNumber: 2 }],
    });
    handlers.tick({
      eventId: 3,
      marketTimestamp: '2026-01-05T15:01:02Z',
      serverTimestamp: '2026-01-05T15:01:02Z',
      prices: [{ symbol: 'AAPL', price: 224.8, sequenceNumber: 3 }],
    });

    expect(fixture.componentInstance['instrument']()?.price).toBe(224.8);
    expect(fixture.componentInstance['tickAnimations']().get('AAPL')).toEqual({
      direction: 'loss',
      durationMs: 500,
      revision: 2,
    });
    vi.advanceTimersByTime(500);
    expect(fixture.componentInstance['tickAnimations']().has('AAPL')).toBe(false);
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('keeps the primary chart ready when comparison candles fail', async () => {
    marketData.candles.mockImplementation(
      (_sessionId: number, symbol: string, timeframe: Timeframe) =>
        symbol === 'MSFT'
          ? throwError(() => new Error('comparison unavailable'))
          : of({
              sessionId: 7,
              symbol,
              timeframe,
              marketTimestamp: SNAPSHOT.marketTimestamp,
              points: [
                {
                  timestamp: '2026-01-05T15:00:00Z',
                  open: 224,
                  high: 226,
                  low: 223,
                  close: 225,
                  volume: 1000,
                },
              ],
            }),
    );
    const fixture = await setup('aapl', 'msft');
    expect(fixture.componentInstance['chartStatus']()).toBe('ready');
    expect(fixture.componentInstance['comparisonChartStatus']()).toBe('error');
    expect(fixture.nativeElement.textContent).toContain('MSFT chart data is unavailable');
  });

  it('holds the page layout with placeholders until the market snapshot arrives', async () => {
    const snapshot = new Subject<MarketSnapshot>();
    marketData.snapshot.mockReturnValueOnce(snapshot);
    const fixture = await setup();
    const root = fixture.nativeElement as HTMLElement;
    const skeleton = root.querySelector('[data-testid="market-skeleton"]')!;

    expect(skeleton.getAttribute('aria-busy')).toBe('true');
    expect(skeleton.querySelector('.sr-only')?.textContent).toBe('Loading live market…');
    // The summary and chart on the left, the tools on the right, as the page will have them.
    expect(skeleton.querySelector('.market-main')?.getAttribute('aria-hidden')).toBe('true');
    expect(skeleton.querySelector('.tools-column')?.getAttribute('aria-hidden')).toBe('true');
    expect(skeleton.querySelectorAll('.market-metrics > div')).toHaveLength(7);
    expect(skeleton.querySelector('.chart-stage .skeleton')).not.toBeNull();
    expect(skeleton.querySelector('[data-testid="trading-skeleton"]')).not.toBeNull();
    expect(root.querySelector('app-price-chart')).toBeNull();
    expect(root.querySelector('app-trade-ticket')).toBeNull();

    snapshot.next(SNAPSHOT);
    snapshot.complete();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(root.querySelector('[data-testid="market-skeleton"]')).toBeNull();
    expect(root.querySelector('h1')?.textContent).toContain('AAPL');
    expect(root.querySelector('app-trade-ticket')).not.toBeNull();
  });

  it('holds the chart with a placeholder while its candles load', async () => {
    const pending = new Subject<CandleSeries>();
    marketData.candles.mockImplementation(() => pending);
    const fixture = await setup();
    const root = fixture.nativeElement as HTMLElement;
    const message = root.querySelector('.chart-message')!;

    expect(message.getAttribute('aria-busy')).toBe('true');
    expect(message.querySelector('.sr-only')?.textContent).toBe('Loading candles…');
    expect(message.querySelector('.skeleton')?.getAttribute('aria-hidden')).toBe('true');
    expect(root.querySelector('app-price-chart')).toBeNull();

    pending.next({
      sessionId: 7,
      symbol: 'AAPL',
      timeframe: '1D',
      marketTimestamp: SNAPSHOT.marketTimestamp,
      points: [
        {
          timestamp: '2026-01-05T15:00:00Z',
          open: 224,
          high: 226,
          low: 223,
          close: 225,
          volume: 1000,
        },
      ],
    });
    fixture.detectChanges();
    expect(root.querySelector('.chart-message')).toBeNull();
    expect(root.querySelector('app-price-chart')).not.toBeNull();
    // Hover details sit at the top of the plot, above the hovered point.
    for (const chart of fixture.debugElement.queryAll(By.directive(PriceChartComponent))) {
      expect(chart.componentInstance.tooltipPlacement()).toBe('top');
    }
    pending.complete();
  });

  it('holds both comparison charts with placeholders while their candles load', async () => {
    const pending = new Subject<CandleSeries>();
    marketData.candles.mockImplementation(() => pending);
    const fixture = await setup('aapl', 'msft');
    const messages = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.comparison-chart .chart-message'),
    );

    expect(messages.map((message) => message.querySelector('.sr-only')?.textContent)).toEqual([
      'Loading AAPL candles…',
      'Loading MSFT candles…',
    ]);
    for (const message of messages) {
      expect(message.getAttribute('aria-busy')).toBe('true');
      expect(message.querySelector('.skeleton')).not.toBeNull();
    }
    pending.complete();
  });

  it('holds recent orders with placeholder rows while order history loads', async () => {
    const fixture = await setup();
    const component = fixture.componentInstance;
    component['insightTab'].set('recent-orders');
    component['orders'].historyStatus.set('loading');
    fixture.detectChanges();
    const panel = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="market-recent-orders"]',
    )!;

    expect(panel.querySelectorAll('[data-testid="activity-row-skeleton"]')).toHaveLength(5);
    expect(panel.querySelector('li[role="status"]')?.textContent).toBe('Loading orders…');
    expect(panel.textContent).not.toContain('No orders at this simulated time.');
    expect(panel.textContent).toContain('Investing · All stocks');

    // Whose orders they are is not known either until the accounts arrive.
    component['accountStore'].status.set('loading');
    fixture.detectChanges();
    expect(panel.textContent).not.toContain('All stocks');
    expect(panel.querySelector(':scope > .skeleton')).not.toBeNull();
    component['accountStore'].status.set('ready');

    component['orders'].historyStatus.set('ready');
    fixture.detectChanges();
    expect(panel.querySelector('[data-testid="activity-row-skeleton"]')).toBeNull();
    expect(panel.textContent).toContain('No orders at this simulated time.');
  });

  it('shows an instrument-not-found state without opening a stream', async () => {
    const fixture = await setup('missing');
    expect(fixture.nativeElement.textContent).toContain('Instrument not found');
    expect(marketData.connect).not.toHaveBeenCalled();
  });

  it('closes the market stream when the page is destroyed', async () => {
    const fixture = await setup();
    fixture.destroy();
    expect(disconnect).toHaveBeenCalledOnce();
  });
  function order(overrides: Partial<OrderResult> = {}): OrderResult {
    return {
      orderId: 1,
      accountId: 1,
      instrumentId: 7,
      status: 'FILLED',
      orderType: 'BUY',
      quantity: 2,
      indicativePrice: 225.8,
      rejectionReason: null,
      simulatedAt: SNAPSHOT.marketTimestamp,
      submittedAt: '2026-10-02T20:00:00Z',
      resolvedAt: '2026-10-02T20:00:01Z',
      ...overrides,
    };
  }
  function stubRefresh(fixture: ComponentFixture<MarketPageComponent>) {
    const page = fixture.componentInstance as unknown as { refreshBalances(id: number): void };
    return vi.spyOn(page, 'refreshBalances').mockImplementation(() => undefined);
  }
  function editQuantity(fixture: ComponentFixture<MarketPageComponent>, quantity: string) {
    const input = fixture.nativeElement.querySelector('#future-trade-quantity') as HTMLInputElement;
    input.value = quantity;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }
  function buy(fixture: ComponentFixture<MarketPageComponent>) {
    (
      fixture.nativeElement.querySelector('app-trade-ticket section > button') as HTMLButtonElement
    ).click();
  }
  it('submits the selected account and current simulated time, prevents duplicate clicks, and refreshes a fill', async () => {
    const fixture = await setup('aapl', '', '2');
    const http = TestBed.inject(HttpTestingController);
    editQuantity(fixture, '2');
    buy(fixture);
    buy(fixture);
    const req = http.expectOne('/api/orders');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toMatchObject({
      accountId: 2,
      instrumentId: 7,
      orderType: 'BUY',
      quantity: 2,
      indicativePrice: 225.8,
      simulatedAt: '2026-01-05T15:01:00.000Z',
    });
    expect(req.request.body.clientReference).toBeTruthy();
    req.flush(order({ accountId: 2, executionPrice: 226.1 }));
    http
      .expectOne('/api/accounts/2/holdings')
      .flush([{ symbol: 'AAPL', quantity: 2, averageCost: 225.8 }]);
    http.expectOne('/api/users/me').flush({ availableFunds: 9548.4 });
    fixture.detectChanges();
    expect(fixture.componentInstance['heldShares']()).toBe(2);
    expect(fixture.componentInstance['cashBalance']()).toBe(9548.4);
    expect(fixture.componentInstance['recentOrders']()[0].status).toBe('FILLED');
    expect(fixture.componentInstance['orderMessage']()).toBe('');
    expect(fixture.nativeElement.querySelector('app-trade-ticket [role="status"]')).toBeNull();
    expect(TestBed.inject(DuaSpeech).line()?.text).toBe('Filled 2 AAPL at $226.10.');
    http.verify();
  });
  it('reports an accepted order that is still open', async () => {
    const fixture = await setup('aapl', '', '2');
    const http = TestBed.inject(HttpTestingController);
    editQuantity(fixture, '2');
    buy(fixture);
    http.expectOne('/api/orders').flush(order({ accountId: 2, status: 'ACCEPTED' }));
    http.expectOne('/api/accounts/2/holdings').flush([]);
    http.expectOne('/api/users/me').flush({ availableFunds: 9000 });
    fixture.detectChanges();
    expect(TestBed.inject(DuaSpeech).line()?.text).toBe('Market buy order placed for 2 AAPL.');
    http.verify();
  });
  it('sells all owned shares and displays the execution immediately', async () => {
    const fixture = await setup();
    const http = TestBed.inject(HttpTestingController);
    fixture.nativeElement.querySelector('app-trade-ticket [aria-pressed="false"]').click();
    fixture.detectChanges();
    editQuantity(fixture, '99');
    buy(fixture);
    const req = http.expectOne('/api/orders');
    expect(req.request.body).toMatchObject({ orderType: 'SELL', quantity: 5 });
    req.flush(order({ orderType: 'SELL', quantity: 5 }));
    http.expectOne('/api/accounts/1/holdings').flush([]);
    http.expectOne('/api/users/me').flush({ availableFunds: 11129 });
    fixture.detectChanges();
    expect(fixture.componentInstance['heldShares']()).toBe(0);
    expect(fixture.componentInstance['recentOrders']()[0].type).toBe('SELL');
    http.verify();
  });
  it('shows a rejected order and reason without refreshing balances', async () => {
    const fixture = await setup();
    const http = TestBed.inject(HttpTestingController);
    editQuantity(fixture, '2');
    buy(fixture);
    http
      .expectOne('/api/orders')
      .flush(order({ status: 'REJECTED', rejectionReason: 'Insufficient funds' }));
    fixture.componentInstance['insightTab'].set('recent-orders');
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('[data-testid="market-recent-orders"]').textContent,
    ).toContain('Rejected');
    expect(fixture.componentInstance['cashBalance']()).toBe(10000);
    http.verify();
  });
  it('handles a request failure without retrying the order or changing balances', async () => {
    const fixture = await setup();
    const http = TestBed.inject(HttpTestingController);
    editQuantity(fixture, '2');
    buy(fixture);
    http
      .expectOne('/api/orders')
      .flush({ error: 'Unavailable' }, { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();
    expect(fixture.componentInstance['orderError']()).toBeTruthy();
    expect(fixture.componentInstance['orders'].orders()).toHaveLength(0);
    expect(fixture.componentInstance['cashBalance']()).toBe(10000);
    http.verify();
  });
  it('retains a fill when refresh fails and retries balances without another order', async () => {
    const fixture = await setup();
    const http = TestBed.inject(HttpTestingController);
    editQuantity(fixture, '2');
    buy(fixture);
    http.expectOne('/api/orders').flush(order());
    const funds = http.expectOne('/api/users/me');
    http
      .expectOne('/api/accounts/1/holdings')
      .flush({}, { status: 503, statusText: 'Unavailable' });
    expect(funds.cancelled).toBe(true);
    fixture.detectChanges();
    expect(fixture.componentInstance['orders'].orders()).toHaveLength(1);
    expect(fixture.componentInstance['tradeReady']()).toBe(false);
    fixture.componentInstance['retryBalances']();
    http
      .expectOne('/api/accounts/1/holdings')
      .flush([{ symbol: 'AAPL', quantity: 7, averageCost: 100 }]);
    http.expectOne('/api/users/me').flush({ availableFunds: 9548.4 });
    expect(fixture.componentInstance['refreshAccountId']()).toBeNull();
    http.verify();
  });
  it('filters recent orders by account and simulation time, across all symbols, with a limit of 20', async () => {
    const history = Array.from({ length: 25 }, (_, i) =>
      order({
        orderId: i + 1,
        instrumentId: i % 2 ? 8 : 7,
        simulatedAt: `2026-01-05T14:${String(30 + i).padStart(2, '0')}:00Z`,
      }),
    );
    history.push(
      order({ orderId: 40, accountId: 2 }),
      order({ orderId: 41, simulatedAt: '2026-01-05T16:00:00Z' }),
    );
    const fixture = await setup('aapl', '', '', history);
    const c = fixture.componentInstance;
    expect(c['recentOrders']()).toHaveLength(20);
    expect(new Set(c['recentOrders']().map((o) => o.label))).toEqual(new Set(['AAPL', 'MSFT']));
    c['marketTimestamp'].set('2026-01-05T14:00:00Z');
    expect(c['recentOrders']()).toHaveLength(0);
    c['marketTimestamp'].set('2026-01-05T16:00:00Z');
    expect(c['recentOrders']()[0].key).toBe('order-41');
    TestBed.inject(HttpTestingController).expectNone((r) => r.method === 'POST');
  });
  it('falls back to the first owned account when the saved one is not owned', async () => {
    const fixture = await setup('aapl', '', '999');
    expect(fixture.componentInstance['accountStore'].selectedAccountId()).toBe(1);
  });
  it('uses the shared time control to refresh snapshot and candle requests', async () => {
    const fixture = await setup();
    const c = fixture.componentInstance;
    const setClock = vi
      .spyOn(TestBed.inject(MarketDataService), 'setClock')
      .mockReturnValue(of({ ...SNAPSHOT, marketTimestamp: '2026-01-05T16:00:00Z' }));
    c['clock'].applyMarketDateTime('2026-01-05T10:00', (snapshot) =>
      c['onClockSnapshot'](snapshot),
    );
    fixture.detectChanges();
    expect(setClock).toHaveBeenCalledWith(7, '2026-01-05T16:00:00.000Z');
    expect(c['marketTimestamp']()).toBe('2026-01-05T16:00:00Z');
    expect(disconnect).toHaveBeenCalled();
  });
  it('refreshes the submitted account even if the account dropdown changes while pending', async () => {
    const fixture = await setup();
    const http = TestBed.inject(HttpTestingController);
    editQuantity(fixture, '1');
    buy(fixture);
    const request = http.expectOne('/api/orders');
    fixture.componentInstance['selectAccount'](2);
    fixture.detectChanges();
    request.flush(order({ quantity: 1 }));
    http
      .expectOne('/api/accounts/1/holdings')
      .flush([{ symbol: 'AAPL', quantity: 6, averageCost: 100 }]);
    http.expectOne('/api/users/me').flush({ availableFunds: 9774.2 });
    expect(fixture.componentInstance['accountStore'].selectedAccountId()).toBe(2);
    http.verify();
  });
  it('omits an invalid simulated timestamp and lets the backend apply its fallback', async () => {
    const fixture = await setup();
    const http = TestBed.inject(HttpTestingController);
    fixture.componentInstance['marketTimestamp'].set('invalid');
    editQuantity(fixture, '1');
    buy(fixture);
    const request = http.expectOne('/api/orders');
    expect(request.request.body.simulatedAt).toBeUndefined();
    request.flush(order({ status: 'REJECTED', rejectionReason: 'Unavailable' }));
    http.verify();
  });
  it('blocks trading when order history is unavailable and recovers with a data-only retry', async () => {
    const fixture = await setup();
    const http = TestBed.inject(HttpTestingController);
    fixture.componentInstance['loadTradingData']();
    http.expectOne('/api/orders').flush({}, { status: 503, statusText: 'Unavailable' });
    editQuantity(fixture, '1');
    buy(fixture);
    http.expectNone((r) => r.method === 'POST');
    expect(fixture.componentInstance['tradeReady']()).toBe(false);
    fixture.componentInstance['loadTradingData']();
    http.expectOne('/api/orders').flush([]);
    expect(fixture.componentInstance['tradeReady']()).toBe(true);
    http.verify();
  });
  it('resets quantity when switching accounts and respects partial-sale limits', async () => {
    const fixture = await setup();
    editQuantity(fixture, '3');
    fixture.componentInstance['selectAccount'](2);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#future-trade-quantity').value).toBe('0');
    fixture.componentInstance['selectAccount'](1);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('app-trade-ticket [aria-pressed="false"]').click();
    fixture.detectChanges();
    editQuantity(fixture, '2');
    buy(fixture);
    const http = TestBed.inject(HttpTestingController);
    const request = http.expectOne('/api/orders');
    expect(request.request.body).toMatchObject({ quantity: 2, orderType: 'SELL' });
    request.flush(order({ orderType: 'SELL' }));
    http
      .expectOne('/api/accounts/1/holdings')
      .flush([{ symbol: 'AAPL', quantity: 3, averageCost: 100 }]);
    http.expectOne('/api/users/me').flush({ availableFunds: 10451.6 });
    expect(fixture.componentInstance['heldShares']()).toBe(3);
    http.verify();
  });

  it.each(['BUY', 'SELL'] as const)(
    'keeps trading limits on current balances when replay crosses a future %s',
    async (side) => {
      const fixture = await setup('aapl', '', '', [
        order({
          orderType: side,
          quantity: 4,
          simulatedAt: '2026-01-05T16:00:00Z',
        }),
      ]);
      const component = fixture.componentInstance;
      const ticket = fixture.debugElement.query(By.directive(TradeTicketComponent))
        .componentInstance as TradeTicketComponent;
      for (const time of ['2026-01-05T15:00:00Z', '2026-01-05T17:00:00Z', '2026-01-05T15:00:00Z']) {
        component['marketTimestamp'].set(time);
        fixture.detectChanges();
        expect(ticket.cashBalance()).toBe(10000);
        expect(ticket.heldShares()).toBe(5);
        ticket['selectSide']('sell');
        fixture.detectChanges();
        expect(ticket['maxShares']()).toBe(5);
        ticket['selectSide']('buy');
        fixture.detectChanges();
        expect(ticket['maxShares']()).toBe(Math.floor(10000 / 225.8));
      }
      TestBed.inject(HttpTestingController).expectNone({ method: 'POST', url: '/api/orders' });
    },
  );

  describe('terms and conditions', () => {
    function page(fixture: ComponentFixture<MarketPageComponent>) {
      return fixture.nativeElement.querySelector('main.market-page') as HTMLElement;
    }

    function termsDialog(fixture: ComponentFixture<MarketPageComponent>) {
      return fixture.nativeElement.querySelector('app-terms-dialog') as HTMLElement | null;
    }

    it('does not ask a user who has already accepted', async () => {
      const fixture = await setup('aapl', '', '', [], { termsAccepted: true });

      expect(termsDialog(fixture)).toBeNull();
      expect(page(fixture).hasAttribute('inert')).toBe(false);
    });

    it('asks a user who has not accepted, and makes the page and its order ticket inert', async () => {
      const fixture = await setup('aapl', '', '', [], { termsAccepted: false });

      expect(termsDialog(fixture)?.textContent).toContain('Terms and Conditions');
      expect(termsDialog(fixture)?.textContent).toContain('Ada Lovelace');
      expect(page(fixture).hasAttribute('inert')).toBe(true);
      expect(page(fixture).querySelector('app-trade-ticket')).not.toBeNull();
      expect(page(fixture).contains(termsDialog(fixture))).toBe(false);
    });

    it('opens the page once the user signs and accepts', async () => {
      const fixture = await setup('aapl', '', '', [], { termsAccepted: false });
      const signature = fixture.nativeElement.querySelector('#termsSignature') as HTMLInputElement;
      signature.value = 'Ada Lovelace';
      signature.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      (termsDialog(fixture)!.querySelector('button[type="submit"]') as HTMLButtonElement).click();
      TestBed.inject(HttpTestingController).expectOne('/api/users/me/terms-acceptance').flush({
        firstName: 'Ada',
        lastName: 'Lovelace',
        availableFunds: 10000,
        termsAccepted: true,
      });
      fixture.detectChanges();

      expect(termsDialog(fixture)).toBeNull();
      expect(page(fixture).hasAttribute('inert')).toBe(false);
    });

    it('signs the user out when they decline', async () => {
      const fixture = await setup('aapl', '', '', [], { termsAccepted: false });
      const logout = vi.spyOn(TestBed.inject(AuthService), 'logout').mockReturnValue(of(undefined));
      const navigateToLogin = vi
        .spyOn(TestBed.inject(Router), 'navigateByUrl')
        .mockResolvedValue(true);

      const signOut = Array.from(termsDialog(fixture)!.querySelectorAll('button')).find(
        (candidate) => candidate.textContent?.trim() === 'Sign out',
      )!;
      signOut.click();

      expect(logout).toHaveBeenCalledOnce();
      expect(navigateToLogin).toHaveBeenCalledWith('/login');
    });
  });

  describe('routing, accounts and refresh failures', () => {
    const lastHandlers = () => marketData.connect.mock.calls.at(-1)![1] as MarketStreamHandlers;

    it('redirects a symbol that is not in canonical form without loading it', async () => {
      await setup('AAPL');
      expect(navigate).toHaveBeenCalledWith(['/dashboard/markets', 'aapl'], {
        queryParamsHandling: 'preserve',
        replaceUrl: true,
      });
      expect(marketData.snapshot).not.toHaveBeenCalled();
    });

    it('rewrites a comparison that is not in canonical form', async () => {
      await setup('aapl', 'MSFT');
      expect(navigate).toHaveBeenCalled();
      const [, extras] = navigate.mock.calls.at(-1)!;
      expect(extras.queryParams).toEqual({ compare: 'msft' });
    });

    it('selects, creates and renames accounts through the store and closes the menu', async () => {
      const fixture = await setup();
      const component = fixture.componentInstance;
      component['openHeaderDropdown'].set('account' as never);
      component['selectAccount'](2);
      expect(component['openHeaderDropdown']()).toBeNull();
      component['selectAccount'](999);

      component['openHeaderDropdown'].set('account' as never);
      component['openCreateAccount']();
      expect(component['accountDialog']()).toEqual({ account: null });
      expect(component['openHeaderDropdown']()).toBeNull();

      const owned = { accountId: 2, name: 'Retirement', openedDate: '2026-01-01' };
      component['openHeaderDropdown'].set('account' as never);
      component['openRenameAccount'](owned);
      expect(component['accountDialog']()).toEqual({ account: owned });
      component['accountDialog'].set(null);
      component['openRenameAccount']({ accountId: 404, name: 'Nope', openedDate: '2026-01-01' });
      expect(component['accountDialog']()).toBeNull();

      component['onAccountSaved'](owned);
      expect(component['accountDialog']()).toBeNull();
    });

    it('navigates to another instrument and keeps a different comparison', async () => {
      const fixture = await setup('aapl', 'msft');
      const component = fixture.componentInstance;
      const instrument = component['instruments']().find((item) => item.symbol === 'MSFT')!;
      component['selectInstrument'](instrument);
      expect(navigate.mock.calls.at(-1)![1].queryParams).toEqual({ compare: null, accountId: 1 });
      component['selectInstrument'](
        component['instruments']().find((item) => item.symbol === 'AAPL')!,
      );
      expect(navigate.mock.calls.at(-1)![1].queryParams).toEqual({ compare: 'msft', accountId: 1 });
    });

    it('reflects stream connection status and reloads the snapshot on resync', async () => {
      const fixture = await setup();
      const handlers = lastHandlers();
      handlers.status(true);
      expect(fixture.componentInstance['connected']()).toBe(true);
      handlers.status(false);
      expect(fixture.componentInstance['connected']()).toBe(false);
      const calls = marketData.snapshot.mock.calls.length;
      handlers.resync();
      expect(marketData.snapshot.mock.calls.length).toBe(calls + 1);
    });

    it('shows the error page when the first snapshot fails and a notice when a refresh fails', async () => {
      marketData.snapshot.mockReturnValueOnce(throwError(() => new Error('down')));
      const fixture = await setup();
      expect(fixture.componentInstance['pageStatus']()).toBe('error');

      marketData.snapshot.mockReturnValue(of(SNAPSHOT));
      fixture.componentInstance['retry']();
      expect(fixture.componentInstance['pageStatus']()).toBe('ready');
      marketData.snapshot.mockReturnValueOnce(throwError(() => new Error('down')));
      fixture.componentInstance['retry']();
      expect(fixture.componentInstance['chartRefreshError']()).toBe(
        'Market snapshot could not refresh.',
      );
      marketData.snapshot.mockImplementation(() => of(SNAPSHOT));
    });

    it('reports a chart that cannot be loaded, keeping any candles already shown', async () => {
      const fixture = await setup();
      const component = fixture.componentInstance;
      marketData.candles.mockImplementationOnce(() => throwError(() => new Error('down')));
      component['candleRevision'].update((revision) => revision + 1);
      fixture.detectChanges();
      expect(component['chartRefreshError']()).toBe('Chart data could not refresh.');
      expect(component['chartStatus']()).not.toBe('error');

      component['candles'].set([]);
      marketData.candles.mockImplementationOnce(() => throwError(() => new Error('down')));
      component['candleRevision'].update((revision) => revision + 1);
      fixture.detectChanges();
      expect(component['chartStatus']()).toBe('error');
    });

    it('marks the chart empty when the market has no candles', async () => {
      const fixture = await setup();
      marketData.candles.mockImplementationOnce(
        (_s: number, symbol: string, timeframe: Timeframe) =>
          of({
            sessionId: 7,
            symbol,
            timeframe,
            marketTimestamp: SNAPSHOT.marketTimestamp,
            points: [],
          }),
      );
      fixture.componentInstance['candleRevision'].update((revision) => revision + 1);
      fixture.detectChanges();
      expect(fixture.componentInstance['chartStatus']()).toBe('empty');
    });

    it('shows the not-found page for a symbol the market does not quote', async () => {
      const fixture = await setup('zzzz');
      expect(fixture.componentInstance['pageStatus']()).toBe('not-found');
    });

    it('marks the catalogue as failed when instruments cannot be loaded', async () => {
      await TestBed.configureTestingModule({
        imports: [MarketPageComponent],
        providers: [
          {
            provide: ExecutionSettingsService,
            useValue: { load: () => savedExecutionPreference({ executionBufferPercent: 0 }) },
          },
          provideRouter([]),
          provideHttpClient(),
          provideHttpClientTesting(),
          { provide: PLATFORM_ID, useValue: 'browser' },
          {
            provide: ActivatedRoute,
            useValue: {
              paramMap: of(convertToParamMap({ symbol: 'aapl' })),
              queryParamMap: of(convertToParamMap({ compare: '' })),
            },
          },
          { provide: MarketDataService, useValue: marketData },
        ],
      }).compileComponents();
      const fixture = TestBed.createComponent(MarketPageComponent);
      fixture.detectChanges();
      const http = TestBed.inject(HttpTestingController);
      http.expectOne('/api/instruments').flush({}, { status: 500, statusText: 'Error' });
      http.expectOne('/api/orders').flush({}, { status: 500, statusText: 'Error' });
      http
        .match(() => true)
        .forEach((request) => {
          if (!request.cancelled) {
            request.flush({}, { status: 500, statusText: 'Error' });
          }
        });
      expect(fixture.componentInstance['catalogueStatus']()).toBe('error');
    });
  });
});
