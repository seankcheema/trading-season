import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DashboardComponent } from './dashboard.component';
import { Instrument, MOCK_INSTRUMENTS } from './mock-data';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { vi } from 'vitest';

const CALENDAR = {
  timezone: 'America/Chicago',
  firstTimestamp: '2026-01-05T14:30:00Z',
  lastTimestamp: '2026-01-06T20:59:59Z',
  tradingDates: ['2026-01-05', '2026-01-06'],
};

function dropdownDetails(fixture: ComponentFixture<DashboardComponent>, testId: string) {
  return fixture.nativeElement.querySelector(
    `[data-testid="${testId}"] details`,
  ) as HTMLDetailsElement;
}

function openDropdown(fixture: ComponentFixture<DashboardComponent>, testId: string): void {
  const details = dropdownDetails(fixture, testId);
  details.open = true;
  details.dispatchEvent(new Event('toggle'));
  fixture.detectChanges();
}

describe('DashboardComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  it('should create the dashboard component', () => {
    const fixture = TestBed.createComponent(DashboardComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should not show the order submission dialog initially', () => {
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-order-submission')).toBeNull();
  });

  it('should open the order submission dialog when an instrument is selected', async () => {
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.componentInstance['openOrder'](MOCK_INSTRUMENTS[0]);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).not.toBeNull();
  });

  it('should close the dialog after an order is submitted', () => {
    const fixture = TestBed.createComponent(DashboardComponent);
    const component = fixture.componentInstance;
    component['openOrder'](MOCK_INSTRUMENTS[0]);
    component['onOrderSubmitted']({
      accountId: 'personal',
      symbol: 'AAPL',
      side: 'buy',
      shares: 1,
      price: MOCK_INSTRUMENTS[0].price,
    });
    expect(component['orderInstrument']()).toBeNull();
  });

  it('should render market time and account dropdowns in the right header controls', () => {
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();

    const controls = fixture.nativeElement.querySelector(
      '[data-testid="dashboard-header-controls"]',
    ) as HTMLElement;
    const children = Array.from(controls.children).map((child) =>
      (child as HTMLElement).getAttribute('data-testid'),
    );

    expect(children.slice(0, 2)).toEqual(['market-clock-dropdown', 'account-dropdown']);
  });

  it('should update the selected account from the custom account dropdown and close it', () => {
    const fixture = TestBed.createComponent(DashboardComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    openDropdown(fixture, 'account-dropdown');

    const accountDropdown = fixture.nativeElement.querySelector(
      '[data-testid="account-dropdown"]',
    ) as HTMLElement;
    const accountButtons = accountDropdown.querySelectorAll('button[role="menuitemradio"]');
    (accountButtons[1] as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(component['selectedAccountId']()).toBe('retirement');
    expect(component['openHeaderDropdown']()).toBeNull();
    expect(dropdownDetails(fixture, 'account-dropdown').open).toBe(false);
    expect(accountDropdown.textContent).toContain('Retirement Account');
  });

  it('should close the market clock dropdown when the account dropdown opens', () => {
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();

    openDropdown(fixture, 'market-clock-dropdown');
    openDropdown(fixture, 'account-dropdown');

    expect(dropdownDetails(fixture, 'market-clock-dropdown').open).toBe(false);
    expect(dropdownDetails(fixture, 'account-dropdown').open).toBe(true);
    expect(fixture.componentInstance['openHeaderDropdown']()).toBe('account');
  });

  it('should close the account dropdown when the market clock dropdown opens', () => {
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();

    openDropdown(fixture, 'account-dropdown');
    openDropdown(fixture, 'market-clock-dropdown');

    expect(dropdownDetails(fixture, 'account-dropdown').open).toBe(false);
    expect(dropdownDetails(fixture, 'market-clock-dropdown').open).toBe(true);
    expect(fixture.componentInstance['openHeaderDropdown']()).toBe('market-clock');
  });

  it('should close an open header dropdown when clicking outside it', () => {
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();

    openDropdown(fixture, 'account-dropdown');
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();

    expect(dropdownDetails(fixture, 'account-dropdown').open).toBe(false);
    expect(fixture.componentInstance['openHeaderDropdown']()).toBeNull();
  });

  it('should keep an open header dropdown open when clicking inside it', () => {
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();

    openDropdown(fixture, 'market-clock-dropdown');
    const marketDropdown = fixture.nativeElement.querySelector(
      '[data-testid="market-clock-dropdown"]',
    ) as HTMLElement;
    marketDropdown.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();

    expect(dropdownDetails(fixture, 'market-clock-dropdown').open).toBe(true);
    expect(fixture.componentInstance['openHeaderDropdown']()).toBe('market-clock');
  });

  it('should keep dropdown labels on one line in matching-width trigger markup', () => {
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.componentInstance['applySnapshot']({
      sessionId: 2026001,
      status: 'OPEN',
      marketTimestamp: '2026-01-05T14:30:00Z',
      serverTimestamp: '2026-01-05T14:30:00Z',
      calendar: CALENDAR,
      stocks: [],
    });
    fixture.detectChanges();

    const accountDropdown = fixture.nativeElement.querySelector(
      '[data-testid="account-dropdown"]',
    ) as HTMLElement;
    const marketDropdown = fixture.nativeElement.querySelector(
      '[data-testid="market-clock-dropdown"]',
    ) as HTMLElement;
    const accountLabel = accountDropdown.querySelector('summary span') as HTMLElement;
    const marketLabel = marketDropdown.querySelector('summary span') as HTMLElement;
    const accountDetails = accountDropdown.querySelector('details') as HTMLElement;
    const marketDetails = marketDropdown.querySelector('details') as HTMLElement;
    const accountPanel = accountDropdown.querySelector('details > div') as HTMLElement;
    const marketPanel = marketDropdown.querySelector('details > div') as HTMLElement;

    expect(accountDropdown.textContent).toContain('Personal Investing Account');
    expect(marketDropdown.textContent).toContain('Jan 5, 8:30 AM CT');
    expect(accountDetails.className).toContain('w-60');
    expect(marketDetails.className).toContain('w-60');
    expect(accountPanel.className).toContain('w-full');
    expect(marketPanel.className).toContain('w-full');
    expect(accountLabel.className).toContain('min-w-0');
    expect(accountLabel.className).toContain('flex-1');
    expect(accountLabel.className).toContain('whitespace-nowrap');
    expect(accountLabel.className).not.toContain('break-words');
    expect(accountLabel.className).not.toContain('truncate');
    expect(marketLabel.className).toContain('whitespace-nowrap');
    expect(marketLabel.className).not.toContain('break-words');
    expect(marketLabel.className).not.toContain('truncate');
  });

  it('should render separate assets table columns for shares, prices, changes, and values', () => {
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();

    const table = fixture.nativeElement.querySelector('[data-testid="assets-table"]') as HTMLElement;
    const headers = Array.from(table.querySelectorAll('.dash-table-head span')).map((header) =>
      (header as HTMLElement).textContent?.trim(),
    );
    const appleRow = table.querySelector('[data-testid="asset-row-AAPL"]') as HTMLElement;
    const appleCells = Array.from(appleRow.children).map((cell) =>
      (cell as HTMLElement).textContent?.trim(),
    );

    expect(headers).toEqual([
      'Asset',
      'Today',
      'Shares',
      'Avg Price',
      'Price',
      'Change',
      'Change %',
      'Value',
      'Value $',
    ]);
    expect(appleCells).toEqual([
      'AAPL',
      '',
      '4',
      '$280.10',
      '$316.59',
      '+$15.65',
      '+5.20%',
      '$1,266.36',
      '+$145.96',
    ]);
    expect(appleRow.querySelector('app-daily-sparkline')).not.toBeNull();
    expect(appleRow.children[5].className).toContain('text-gain');
    expect(appleRow.children[6].className).toContain('text-gain');
    expect(appleRow.children[8].className).toContain('text-gain');
  });

  it('should request one-day candle series for held assets when a market snapshot loads', () => {
    const fixture = TestBed.createComponent(DashboardComponent);
    const component = fixture.componentInstance;
    const http = TestBed.inject(HttpTestingController);
    const stocks = MOCK_INSTRUMENTS.map((instrument) => ({
      symbol: instrument.symbol,
      companyName: instrument.name,
      price: instrument.price,
      change: instrument.change,
      changePercent: instrument.changePercent,
      timestamp: '2026-01-05T14:30:00Z',
    }));

    component['applySnapshot']({
      sessionId: 2026001,
      status: 'OPEN',
      marketTimestamp: '2026-01-05T14:30:00Z',
      serverTimestamp: '2026-01-05T14:30:00Z',
      calendar: CALENDAR,
      stocks,
    });

    for (const symbol of ['AAPL', 'NVDA', 'MSFT', 'SPY', 'TSLA']) {
      const request = http.expectOne(
        (candidate) =>
          candidate.url === '/api/market/candles' &&
          candidate.params.get('sessionId') === '2026001' &&
          candidate.params.get('symbol') === symbol &&
          candidate.params.get('timeframe') === '1D',
      );
      request.flush({
        sessionId: 2026001,
        symbol,
        timeframe: '1D',
        marketTimestamp: '2026-01-05T14:30:00Z',
        points: [
          {
            timestamp: '2026-01-05T14:30:00Z',
            open: 100,
            high: 101,
            low: 99,
            close: 100,
            volume: 1000,
          },
        ],
      });
    }
  });

  it('should submit the current typed market time when applying the clock', () => {
    const fixture = TestBed.createComponent(DashboardComponent);
    const component = fixture.componentInstance;
    const http = TestBed.inject(HttpTestingController);
    component['marketSessionId'].set(2026001);

    component['applyMarketDateTime']('2026-01-05T08:30');

    const request = http.expectOne('/api/market/clock?sessionId=2026001');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ timestamp: '2026-01-05T14:30:00.000Z' });
    request.flush({
      sessionId: 2026001,
      status: 'OPEN',
      marketTimestamp: '2026-01-05T14:30:00Z',
      serverTimestamp: '2026-01-05T14:30:00Z',
      calendar: CALENDAR,
      stocks: [],
    });
    expect(component['clockError']()).toBe('');
  });

  it('should submit September market close minutes in Central time', () => {
    const fixture = TestBed.createComponent(DashboardComponent);
    const component = fixture.componentInstance;
    const http = TestBed.inject(HttpTestingController);
    component['marketSessionId'].set(2026001);
    component['marketCalendar'].set({
      timezone: 'America/Chicago',
      firstTimestamp: '2026-01-01T14:30:00Z',
      lastTimestamp: '2026-12-31T20:59:59Z',
      tradingDates: ['2026-09-01'],
    });

    component['applyMarketDateTime']('2026-09-01T14:59');

    const request = http.expectOne('/api/market/clock?sessionId=2026001');
    expect(request.request.body).toEqual({ timestamp: '2026-09-01T19:59:00.000Z' });
    request.flush({
      sessionId: 2026001,
      status: 'OPEN',
      marketTimestamp: '2026-09-01T19:59:00Z',
      serverTimestamp: '2026-09-01T19:59:00Z',
      calendar: CALENDAR,
      stocks: [],
    });
  });

  it('should show the backend clock error when the backend rejects the selected time', () => {
    const fixture = TestBed.createComponent(DashboardComponent);
    const component = fixture.componentInstance;
    const http = TestBed.inject(HttpTestingController);
    component['marketSessionId'].set(2026001);

    component['applyMarketDateTime']('2026-01-05T08:30');

    http.expectOne('/api/market/clock?sessionId=2026001').flush(
      { error: 'Selected date has no seeded trading data' },
      { status: 400, statusText: 'Bad Request' },
    );
    expect(component['clockError']()).toBe('Selected date has no seeded trading data');
  });

  it('should display the current simulated time in the market clock trigger', () => {
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.componentInstance['applySnapshot']({
      sessionId: 2026001,
      status: 'OPEN',
      marketTimestamp: '2026-01-05T14:30:00Z',
      serverTimestamp: '2026-01-05T14:30:00Z',
      calendar: CALENDAR,
      stocks: [],
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Jan 5, 8:30 AM CT');
  });

  it('should show shortened copy in the market clock dropdown', () => {
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.componentInstance['applySnapshot']({
      sessionId: 2026001,
      status: 'OPEN',
      marketTimestamp: '2026-01-05T14:30:00Z',
      serverTimestamp: '2026-01-05T14:30:00Z',
      calendar: CALENDAR,
      stocks: [],
    });
    fixture.detectChanges();

    const dropdown = fixture.nativeElement.querySelector(
      '[data-testid="market-clock-dropdown"]',
    ) as HTMLElement;
    expect(dropdown.textContent).toContain('Range: Jan 5 - Jan 6');
    expect(dropdown.textContent).not.toContain('Loaded range');
    expect(dropdown.textContent).toContain('Apply time');
  });

  it('should set datetime bounds from the simulation calendar', () => {
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.componentInstance['applySnapshot']({
      sessionId: 2026001,
      status: 'OPEN',
      marketTimestamp: '2026-01-05T14:30:00Z',
      serverTimestamp: '2026-01-05T14:30:00Z',
      calendar: CALENDAR,
      stocks: [],
    });
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('#market-date-time') as HTMLInputElement;
    expect(input.min).toBe('2026-01-05T08:30');
    expect(input.max).toBe('2026-01-06T14:59');
  });

  it('should validate dates outside the simulation range before calling the backend', () => {
    const fixture = TestBed.createComponent(DashboardComponent);
    const component = fixture.componentInstance;
    const http = TestBed.inject(HttpTestingController);
    component['marketSessionId'].set(2026001);
    component['marketCalendar'].set(CALENDAR);

    component['applyMarketDateTime']('2026-01-04T08:30');

    http.expectNone('/api/market/clock?sessionId=2026001');
    expect(component['clockError']()).toContain('market data from Jan 5');
  });

  it('should apply the next loaded trading date when the selected day is not seeded', () => {
    const fixture = TestBed.createComponent(DashboardComponent);
    const component = fixture.componentInstance;
    const http = TestBed.inject(HttpTestingController);
    const calendarWithGap = {
      ...CALENDAR,
      lastTimestamp: '2026-01-08T20:59:59Z',
      tradingDates: ['2026-01-05', '2026-01-08'],
    };
    component['marketSessionId'].set(2026001);
    component['marketCalendar'].set(calendarWithGap);

    component['applyMarketDateTime']('2026-01-06T08:30');

    const request = http.expectOne('/api/market/clock?sessionId=2026001');
    expect(request.request.body).toEqual({ timestamp: '2026-01-08T14:30:00.000Z' });
    expect(component['marketDateTime']()).toBe('2026-01-08T08:30');
    request.flush({
      sessionId: 2026001,
      status: 'OPEN',
      marketTimestamp: '2026-01-08T14:30:00Z',
      serverTimestamp: '2026-01-08T14:30:00Z',
      calendar: calendarWithGap,
      stocks: [],
    });
    expect(component['clockError']()).toBe('');
  });

  it('should still reject dates in months with no loaded trading dates', () => {
    const fixture = TestBed.createComponent(DashboardComponent);
    const component = fixture.componentInstance;
    const http = TestBed.inject(HttpTestingController);
    component['marketSessionId'].set(2026001);
    component['marketCalendar'].set({
      ...CALENDAR,
      firstTimestamp: '2026-01-05T14:30:00Z',
      lastTimestamp: '2026-03-31T19:59:59Z',
      tradingDates: ['2026-01-05', '2026-03-02'],
    });

    component['applyMarketDateTime']('2026-02-02T08:30');

    http.expectNone('/api/market/clock?sessionId=2026001');
    expect(component['clockError']()).toBe(
      'Feb 2, 2026 is not in this simulation archive. Choose one of the loaded trading dates.',
    );
  });

  it('should flash ticker rows only when the rendered price changes', () => {
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(DashboardComponent);
    const component = fixture.componentInstance;
    const instrument: Instrument = {
      symbol: 'AAPL',
      name: 'Apple Inc.',
      price: 100,
      change: 0,
      changePercent: 0,
    };
    component['instruments'].set([instrument]);

    component['applyTick']('AAPL', 100.004);

    expect(component['instruments']()[0].price).toBe(100.004);
    expect(component['changedSymbols']().has('AAPL')).toBe(false);

    component['applyTick']('AAPL', 100.01);

    expect(component['changedSymbols']().has('AAPL')).toBe(true);
    expect(component['flashDirections']()['AAPL']).toBe(1);
    vi.advanceTimersByTime(221);
    expect(component['changedSymbols']().has('AAPL')).toBe(false);
    vi.useRealTimers();
  });
});
