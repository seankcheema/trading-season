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
import { ToastService } from '../notifications/toast.service';

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
  ): Promise<ComponentFixture<MarketPageComponent>> {
    await TestBed.configureTestingModule({
      imports: [MarketPageComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PLATFORM_ID, useValue: 'browser' },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ symbol })),
            queryParamMap: of(convertToParamMap({ compare, accountId })),
          },
        },
        { provide: MarketDataService, useValue: marketData },
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
      .flush({ firstName: 'Ada', lastName: 'Lovelace', availableFunds: 10000 });
    http.expectOne((r) => r.url === '/api/me/cash-transactions').flush([]);
    http.expectOne('/api/orders').flush(orders);
    http.expectOne('/api/instruments').flush([
      { instrumentId: 7, ticker: 'AAPL', simulatedStockSymbol: 'AAPL', tradable: true },
      { instrumentId: 8, ticker: 'MSFT', simulatedStockSymbol: 'MSFT', tradable: true },
    ]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
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
    expect(fixture.componentInstance['instruments']().find((stock) => stock.symbol === 'AAPL')?.price).toBe(230);
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
    expect(fixture.debugElement.query(By.directive(PriceChartComponent)).componentInstance).toBe(chart);
    const status = [...fixture.nativeElement.querySelectorAll('[role="status"]')]
      .find((element: HTMLElement) => element.textContent?.includes('Updating chart'));
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

  it('opens notifications and the dashboard profile actions from the header', async () => {
    const fixture = await setup();
    const header = fixture.nativeElement.querySelector('header');
    const profile = header.querySelector('[data-testid="profile-dropdown"]');
    expect(profile.querySelector('[data-testid="profile-initials"]').textContent.trim()).toBe(
      fixture.componentInstance['accountStore'].initials(),
    );
    header.querySelector('[data-testid="notifications-dropdown"] summary').click();
    fixture.detectChanges();
    expect(header.textContent).toContain('No notifications yet.');
    profile.querySelector('summary').click();
    fixture.detectChanges();
    profile.querySelector('button').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-settings-dialog')).not.toBeNull();
    expect(fixture.componentInstance['openHeaderDropdown']()).toBeNull();

    const logout = vi.spyOn(TestBed.inject(AuthService), 'logout').mockReturnValue(of(undefined));
    const navigateToLogin = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    profile.querySelectorAll('button')[1].click();
    expect(logout).toHaveBeenCalledOnce();
    expect(navigateToLogin).toHaveBeenCalledWith('/login');
  });

  it('shows shared cash and the selected portfolio in the account box above execution', async () => {
    const fixture = await setup();
    const panel = fixture.nativeElement.querySelector('[data-testid="account-value-panel"]');
    expect(panel.querySelector('[data-testid="available-cash"]').textContent).toContain(
      '$10,000.00',
    );
    expect(panel.querySelector('[data-testid="account-portfolio-value"]').textContent).toContain(
      '$1,129.00',
    );
    expect(fixture.nativeElement.querySelector('header app-account-control')).toBeNull();
    expect(panel.querySelector('app-account-control')).not.toBeNull();
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
    fixture.componentInstance['accountStore'].status.set('error');
    fixture.detectChanges();
    expect(panel.textContent).toContain('Retry accounts');
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
    expect(Number(getComputedStyle(header).zIndex)).toBeGreaterThan(30);
    expect(header.classList).not.toContain('border-b');
    expect(profile.classList).toContain('border-border');
    expect(profile.className).not.toContain('border-primary');
  });

  it('renders overview and news feeds plus an empty AI chat state', async () => {
    const fixture = await setup();
    expect(fixture.nativeElement.textContent).not.toContain('Current market read');
    expect(fixture.nativeElement.textContent).toContain('Short-term risk');
    expect(fixture.nativeElement.textContent).toContain('Popularity');
    expect(fixture.nativeElement.textContent).toContain('Sentiment');
    expect(fixture.nativeElement.textContent).toContain('Bullish');
    expect(fixture.nativeElement.querySelectorAll('.overview-card')).toHaveLength(6);
    expect(fixture.nativeElement.querySelectorAll('.overview-card-icon')).toHaveLength(4);
    expect(fixture.nativeElement.querySelectorAll('[role="progressbar"]')).toHaveLength(4);
    expect(fixture.nativeElement.querySelectorAll('.overview-progress span')).toHaveLength(20);
    expect(fixture.nativeElement.querySelector('.overview-summary')?.textContent).toContain(
      'AAPL shows steady strength, elevated activity, and positive sentiment',
    );
    expect(fixture.nativeElement.querySelector('.overview-summary')?.textContent).toContain(
      'Signal scores are illustrative',
    );
    expect(
      fixture.nativeElement
        .querySelector('[aria-label="Short-term risk level"]')
        ?.getAttribute('aria-valuenow'),
    ).toBe('3');
    expect(fixture.nativeElement.querySelector('[aria-label="Key level strength"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[aria-label="Activity level"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('.overview-risk')?.textContent).toContain(
      'Moderate',
    );
    expect(fixture.nativeElement.textContent).not.toContain('Reconnecting');
    const tabs = Array.from(
      fixture.nativeElement.querySelectorAll('[role="tab"]'),
    ) as HTMLButtonElement[];
    expect(tabs.find((tab) => tab.textContent?.trim() === 'Overview')?.classList).toContain(
      'bg-primary',
    );
    tabs.find((tab) => tab.textContent?.trim() === 'News')?.click();
    fixture.detectChanges();
    expect(tabs.find((tab) => tab.textContent?.trim() === 'News')?.classList).toContain(
      'bg-primary',
    );
    expect(fixture.nativeElement.textContent).toContain('Latest headlines');
    expect(fixture.nativeElement.querySelector('.news-hero')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.news-story').length).toBe(5);
    expect(fixture.nativeElement.querySelector('.news-story')?.textContent).toContain(
      'AAPL holds near its session high',
    );
    expect(fixture.nativeElement.textContent).toContain('Market update');
    expect(fixture.nativeElement.textContent).toContain('Sector watch');
    expect(fixture.nativeElement.textContent).toContain('Company outlook');
    expect(fixture.nativeElement.textContent).toContain('Macroeconomy');
    expect(fixture.nativeElement.textContent).toContain('Earnings');
    expect(fixture.nativeElement.querySelectorAll('.news-arrow')).toHaveLength(5);
    tabs.find((tab) => tab.textContent?.trim() === 'AI')?.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Ask about AAPL');
    expect(fixture.nativeElement.textContent).toContain('Explore the chart');
    expect(fixture.nativeElement.querySelector('[aria-label="Ask market AI"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.insight-item').length).toBe(0);
    expect(fixture.nativeElement.querySelectorAll('[aria-hidden="true"]')).not.toHaveLength(0);
  });

  it('submits a prompt from the AI chat composer', async () => {
    const fixture = await setup();
    const tabs = Array.from(
      fixture.nativeElement.querySelectorAll('[role="tab"]'),
    ) as HTMLButtonElement[];
    tabs.find((tab) => tab.textContent?.trim() === 'AI')?.click();
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector(
      '[aria-label="Ask market AI"]',
    ) as HTMLInputElement;
    input.value = 'Explain today’s volume';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (
      fixture.nativeElement.querySelector('[aria-label="Send question"]') as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Explain today’s volume');
    expect(fixture.nativeElement.textContent).toContain('simulated session');
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
    req.flush(order({ accountId: 2 }));
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
    expect(TestBed.inject(ToastService).messages()[0].message).toContain('Filled 2 AAPL');
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
  it('falls back to the first owned account for invalid account links', async () => {
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
});
