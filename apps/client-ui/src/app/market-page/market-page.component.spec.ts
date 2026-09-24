import { PLATFORM_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { MarketDataService, MarketSnapshot } from '../dashboard/market-data.service';
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
  ],
};

describe('MarketPageComponent', () => {
  const disconnect = vi.fn();
  const marketData = {
    snapshot: vi.fn(() => of(SNAPSHOT)),
    candles: vi.fn(() =>
      of({
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
      }),
    ),
    connect: vi.fn(() => disconnect),
  };

  async function setup(symbol = 'aapl'): Promise<ComponentFixture<MarketPageComponent>> {
    await TestBed.configureTestingModule({
      imports: [MarketPageComponent],
      providers: [
        provideRouter([]),
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ symbol })) } },
        { provide: MarketDataService, useValue: marketData },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(MarketPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.resetTestingModule();
  });

  it('loads a direct symbol route with candles and disabled trading', async () => {
    const fixture = await setup();
    expect(fixture.componentInstance['symbol']()).toBe('AAPL');
    expect(marketData.candles).toHaveBeenCalledWith(7, 'AAPL', '1D');
    expect(fixture.nativeElement.textContent).toContain('Apple Inc.');
    const tradeButtons = Array.from(
      fixture.nativeElement.querySelectorAll('app-trade-ticket button'),
    ) as HTMLButtonElement[];
    expect(tradeButtons.every((button) => button.disabled)).toBe(true);
  });

  it('renders the dashboard-width header and demo market metrics', async () => {
    const fixture = await setup();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('TradingSeason');
    expect(text).toContain('Markets');
    expect(text).toContain('Watchlist');
    expect(text).toContain('Portfolio');
    expect(text).toContain('Back');
    expect(text).toContain('Range Volume');
    expect(fixture.componentInstance['rangeVolume']()).toBe(1000);
    expect(text).toContain('$3.42T');
    expect(text).toContain('33.80');
  });

  it('renders consensus and switches News and AI tools to demo states', async () => {
    const fixture = await setup();
    expect(fixture.nativeElement.textContent).toContain('Consensus');
    expect(fixture.nativeElement.textContent).toContain('81% Buy');
    const tabs = Array.from(
      fixture.nativeElement.querySelectorAll('[role="tab"]'),
    ) as HTMLButtonElement[];
    tabs.find((tab) => tab.textContent?.trim() === 'News')?.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Demo news brief');
    tabs.find((tab) => tab.textContent?.trim() === 'AI')?.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Demo AI signal');
  });

  it('shows disabled unavailable navigation and mock recent orders', async () => {
    const fixture = await setup();
    const disabledLabels = Array.from(
      fixture.nativeElement.querySelectorAll('button:disabled'),
      (button) => {
        const element = button as HTMLButtonElement;
        return element.getAttribute('aria-label') ?? element.textContent;
      },
    ).join(' ');
    expect(disabledLabels).toContain('Watchlist, not available yet');
    expect(disabledLabels).toContain('Portfolio, not available yet');
    expect(fixture.nativeElement.textContent).toContain('Recent Orders');
    expect(fixture.nativeElement.textContent).toContain('10 shares');
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
