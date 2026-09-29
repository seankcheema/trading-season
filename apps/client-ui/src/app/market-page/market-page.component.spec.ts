import { PLATFORM_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import {
  MarketDataService,
  MarketSnapshot,
  MarketStreamHandlers,
} from '../dashboard/market-data.service';
import { Timeframe } from '../dashboard/mock-data';
import { PriceChartComponent } from '../dashboard/shared/price-chart.component';
import { MarketPageComponent } from './market-page.component';

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
  ): Promise<ComponentFixture<MarketPageComponent>> {
    await TestBed.configureTestingModule({
      imports: [MarketPageComponent],
      providers: [
        provideRouter([]),
        { provide: PLATFORM_ID, useValue: 'browser' },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ symbol })),
            queryParamMap: of(convertToParamMap(compare ? { compare } : {})),
          },
        },
        { provide: MarketDataService, useValue: marketData },
      ],
    }).compileComponents();
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(MarketPageComponent);
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

  it('loads a direct symbol route with candles and an interactive demo ticket', async () => {
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

  it('defaults to a line chart and lets the user select another chart mode', async () => {
    const fixture = await setup();
    const chart = fixture.debugElement.query(By.directive(PriceChartComponent)).componentInstance;
    expect(fixture.componentInstance['chartMode']()).toBe('line');
    expect(chart.mode()).toBe('line');
    expect(
      fixture.nativeElement.querySelector('[aria-controls="chart-mode-picker"]').textContent,
    ).toContain('Graph view: Line');
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
    expect(text).not.toContain('Portfolio');
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
      '[aria-label="Profile, not available yet"]',
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
    expect(fixture.nativeElement.querySelectorAll('.overview-card-icon')).toHaveLength(6);
    expect(fixture.nativeElement.querySelectorAll('[role="progressbar"]')).toHaveLength(6);
    expect(fixture.nativeElement.querySelectorAll('.overview-progress span')).toHaveLength(30);
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
    expect(
      fixture.nativeElement
        .querySelector('[aria-label="Key level strength"]')
        ?.getAttribute('aria-valuenow'),
    ).toBe('4');
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

  it('removes recent orders and expands the chart when tools are collapsed', async () => {
    const fixture = await setup();
    expect(fixture.nativeElement.textContent).not.toContain('Recent Orders');
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
    expect(fixture.nativeElement.querySelector('.comparison-summary')?.textContent).toContain(
      'Microsoft Corporation',
    );
    expect(fixture.nativeElement.querySelector('.comparison-summary')?.textContent).toContain(
      'Volume',
    );
    expect(fixture.nativeElement.textContent).toContain('2,000');
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
});
