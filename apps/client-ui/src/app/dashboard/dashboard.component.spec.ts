import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { DashboardComponent } from './dashboard.component';
import { Instrument, MOCK_INSTRUMENTS } from './mock-data';
import { vi } from 'vitest';

const CALENDAR = {
  timezone: 'America/Chicago',
  firstTimestamp: '2026-01-05T14:30:00Z',
  lastTimestamp: '2026-01-06T20:59:59Z',
  tradingDates: ['2026-01-05', '2026-01-06'],
};

const ACCOUNTS = [
  { accountId: 1, name: 'Personal Investing Account', openedDate: '2026-01-02' },
  { accountId: 2, name: 'Retirement Account', openedDate: '2026-02-03' },
];

// Each account's portfolio is its holdings. Valued at MOCK_INSTRUMENTS prices, the first
// is worth $6,430.38 and the second $1,296.40.
const HOLDINGS: Record<number, unknown[]> = {
  1: [
    { symbol: 'AAPL', quantity: 4, averageCost: 280.1 },
    { symbol: 'NVDA', quantity: 10, averageCost: 190.25 },
    { symbol: 'MSFT', quantity: 2, averageCost: 455.0 },
    { symbol: 'SPY', quantity: 3, averageCost: 610.5 },
    { symbol: 'TSLA', quantity: 1, averageCost: 301.8 },
  ],
  2: [{ symbol: 'SPY', quantity: 2, averageCost: 600 }],
};

// The user's cash, shared by every account.
const CASH = 10_000;

// Answers the account, holdings and cash loads the dashboard starts with in the browser.
function flushAccounts(
  fixture: ComponentFixture<DashboardComponent>,
  accounts: { accountId: number; name: string; openedDate: string }[] = ACCOUNTS,
  {
    holdings = HOLDINGS,
    cash = CASH,
    transactions = [] as unknown[],
  }: { holdings?: Record<number, unknown[]>; cash?: number; transactions?: unknown[] } = {},
): HttpTestingController {
  const http = TestBed.inject(HttpTestingController);
  http.expectOne('/api/me/accounts').flush(accounts);
  for (const account of accounts) {
    http
      .expectOne(`/api/accounts/${account.accountId}/holdings`)
      .flush(holdings[account.accountId] ?? []);
  }
  http.expectOne('/api/users/me').flush({ availableFunds: cash });
  http.expectOne((request) => request.url === '/api/me/cash-transactions').flush(transactions);
  fixture.detectChanges();
  return http;
}

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
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
  });

  it('should create the dashboard component', () => {
    const fixture = TestBed.createComponent(DashboardComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should limit the portfolio chart to the elapsed market session', () => {
    const component = TestBed.createComponent(DashboardComponent).componentInstance;
    component['currentMarketTimestamp'].set('2026-01-05T16:00:00Z');

    const points = component['portfolioChart']();

    expect(points[0].time.toISOString()).toBe('2026-01-05T15:30:00.000Z');
    expect(points[points.length - 1].time.toISOString()).toBe('2026-01-05T16:00:00.000Z');
    expect(points.every((point) => point.time.getTime() <= Date.parse('2026-01-05T16:00:00Z'))).toBe(
      true,
    );
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

  it('should offer settings and a red log out behind the profile icon instead of a logout button', () => {
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();

    const profileDropdown = fixture.nativeElement.querySelector(
      '[data-testid="profile-dropdown"]',
    ) as HTMLElement;
    const trigger = profileDropdown.querySelector('summary') as HTMLElement;
    const items = Array.from(
      profileDropdown.querySelectorAll('button[role="menuitem"]'),
    ) as HTMLButtonElement[];

    expect(trigger.className).toContain('rounded-full');
    expect(trigger.textContent?.trim()).toBe('SC');
    expect(items.map((item) => item.textContent?.trim())).toEqual(['Settings', 'Log out']);
    expect(items[1].className).toContain('text-loss');
    expect(fixture.nativeElement.querySelector('[aria-label="Sign out"]')).toBeNull();
  });

  it('should sign out and return to login from the profile menu', async () => {
    const fixture = TestBed.createComponent(DashboardComponent);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture.detectChanges();
    openDropdown(fixture, 'profile-dropdown');

    const items = fixture.nativeElement.querySelectorAll(
      '[data-testid="profile-dropdown"] button[role="menuitem"]',
    ) as NodeListOf<HTMLButtonElement>;
    items[1].click();
    fixture.detectChanges();

    expect(navigate).toHaveBeenCalledWith('/login');
    expect(fixture.componentInstance['openHeaderDropdown']()).toBeNull();
  });

  it('should open the settings dialog and close the profile menu after choosing settings', () => {
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-settings-dialog')).toBeNull();
    openDropdown(fixture, 'profile-dropdown');

    const items = fixture.nativeElement.querySelectorAll(
      '[data-testid="profile-dropdown"] button[role="menuitem"]',
    ) as NodeListOf<HTMLButtonElement>;
    items[0].click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-settings-dialog')).not.toBeNull();
    expect(fixture.componentInstance['openHeaderDropdown']()).toBeNull();
    expect(dropdownDetails(fixture, 'profile-dropdown').open).toBe(false);
  });

  it('should close the settings dialog', () => {
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.componentInstance['onSettings']();
    fixture.detectChanges();

    (
      fixture.nativeElement.querySelector('[aria-label="Close settings"]') as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-settings-dialog')).toBeNull();
  });

  it('should update the selected account from the custom account dropdown and close it', () => {
    const fixture = TestBed.createComponent(DashboardComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    flushAccounts(fixture);
    openDropdown(fixture, 'account-dropdown');

    const accountDropdown = fixture.nativeElement.querySelector(
      '[data-testid="account-dropdown"]',
    ) as HTMLElement;
    const accountButtons = accountDropdown.querySelectorAll('button[role="menuitemradio"]');
    (accountButtons[1] as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(component['selectedAccountId']()).toBe(2);
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
    flushAccounts(fixture);

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
    flushAccounts(fixture);

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
    fixture.detectChanges();
    const http = flushAccounts(fixture);
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

  it('should update ticker prices and daily changes without highlight state', () => {
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
    component['openingPrices'].set('AAPL', 95);

    component['applyTick']('AAPL', 100);

    expect(component['instruments']()[0]).toEqual({
      ...instrument,
      price: 100,
      change: 5,
      changePercent: (5 / 95) * 100,
    });
    expect('changedSymbols' in component).toBe(false);
    expect('flashDirections' in component).toBe(false);
  });

  describe('accounts, portfolios and cash', () => {
    function render() {
      const fixture = TestBed.createComponent(DashboardComponent);
      fixture.detectChanges();
      return fixture;
    }

    function element(fixture: ComponentFixture<DashboardComponent>) {
      return fixture.nativeElement as HTMLElement;
    }

    function text(node: Element | null | undefined) {
      return node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    }

    function accountItems(fixture: ComponentFixture<DashboardComponent>) {
      return Array.from(
        element(fixture).querySelectorAll('[data-testid="account-dropdown"] [role="menuitemradio"]'),
      ) as HTMLButtonElement[];
    }

    function button(fixture: ComponentFixture<DashboardComponent>, name: string) {
      return Array.from(element(fixture).querySelectorAll('button')).find(
        (candidate) => candidate.textContent?.trim() === name,
      ) as HTMLButtonElement;
    }

    function assetSymbols(fixture: ComponentFixture<DashboardComponent>) {
      return Array.from(
        element(fixture).querySelectorAll('[data-testid="assets-table"] [data-testid^="asset-row-"]'),
      ).map((row) => row.getAttribute('data-testid')?.replace('asset-row-', ''));
    }

    it('shows a loading label until the accounts arrive', () => {
      const fixture = render();

      expect(
        element(fixture).querySelector('[data-testid="account-dropdown"]')?.textContent,
      ).toContain('Loading accounts…');
    });

    it("lists only the signed-in user's accounts with each portfolio's value", () => {
      const fixture = render();
      flushAccounts(fixture);
      openDropdown(fixture, 'account-dropdown');

      const accounts = accountItems(fixture);

      expect(accounts.map((item) => text(item))).toEqual([
        'Personal Investing Account Portfolio $6,430.38',
        'Retirement Account Portfolio $1,296.40',
      ]);
      expect(accounts[0].getAttribute('aria-checked')).toBe('true');
    });

    it('has no separate portfolio picker: an account is its portfolio', () => {
      const fixture = render();
      flushAccounts(fixture);

      expect(element(fixture).querySelector('[data-testid="portfolio-dropdown"]')).toBeNull();
    });

    it("counts the shared cash once plus every account's portfolio in net worth", () => {
      const fixture = render();
      flushAccounts(fixture);
      const component = fixture.componentInstance;

      expect(component['cashBalance']()).toBe(10_000);
      expect(component['investedValue']()).toBeCloseTo(6_430.38 + 1_296.4, 2);
      expect(component['netWorth']()).toBeCloseTo(10_000 + 6_430.38 + 1_296.4, 2);

      // Switching accounts changes the portfolio shown, not the cash or net worth.
      component['selectAccount'](2);
      expect(component['portfolioValue']()).toBeCloseTo(1_296.4, 2);
      expect(component['cashBalance']()).toBe(10_000);
      expect(component['netWorth']()).toBeCloseTo(10_000 + 6_430.38 + 1_296.4, 2);
    });

    it("shows the selected account's holdings as its portfolio", () => {
      const fixture = render();
      flushAccounts(fixture);

      expect(assetSymbols(fixture)).toEqual(['AAPL', 'NVDA', 'MSFT', 'SPY', 'TSLA']);
      expect(text(element(fixture).querySelector('h2.dash-label'))).toBe('Net Worth');
      expect(element(fixture).textContent).toContain('Portfolio Value · Personal Investing Account');

      fixture.componentInstance['selectAccount'](2);
      fixture.detectChanges();

      expect(assetSymbols(fixture)).toEqual(['SPY']);
      expect(fixture.componentInstance['positions']()).toEqual({ SPY: 2 });
      expect(fixture.componentInstance['portfolioChangePercent']()).toBeCloseTo(8.0333, 3);
    });

    it('shows a new account as an empty portfolio', () => {
      const fixture = render();
      flushAccounts(fixture, [{ accountId: 3, name: 'Fresh', openedDate: '2026-09-21' }], {
        holdings: {},
      });

      expect(assetSymbols(fixture)).toEqual([]);
      expect(element(fixture).textContent).toContain('This account has no holdings yet.');
      expect(fixture.componentInstance['portfolioValue']()).toBe(0);
      expect(fixture.componentInstance['netWorth']()).toBe(CASH);
    });

    it('values a holding with no live price at its cost', () => {
      const fixture = render();
      flushAccounts(fixture, [ACCOUNTS[0]], {
        holdings: { 1: [{ symbol: 'ZZZZ', quantity: 2, averageCost: 50 }] },
      });

      expect(fixture.componentInstance['portfolioValue']()).toBe(100);
      expect(assetSymbols(fixture)).toEqual(['ZZZZ']);
    });

    it('ignores an attempt to select an account the user does not own', () => {
      const fixture = render();
      flushAccounts(fixture);
      const component = fixture.componentInstance;

      component['selectAccount'](999);

      expect(component['selectedAccountId']()).toBe(1);
    });

    it('opens the new account dialog from the account dropdown', () => {
      const fixture = render();
      flushAccounts(fixture);
      openDropdown(fixture, 'account-dropdown');

      button(fixture, 'New account').click();
      fixture.detectChanges();

      expect(text(element(fixture).querySelector('[role="dialog"] h2'))).toBe('New account');
      expect(fixture.componentInstance['openHeaderDropdown']()).toBeNull();
    });

    it('opens the rename dialog for an account from the account dropdown', () => {
      const fixture = render();
      flushAccounts(fixture);
      openDropdown(fixture, 'account-dropdown');

      (
        element(fixture).querySelector('[aria-label="Rename Retirement Account"]') as HTMLButtonElement
      ).click();
      fixture.detectChanges();

      expect(text(element(fixture).querySelector('[role="dialog"] h2'))).toBe('Rename account');
      expect((element(fixture).querySelector('#accountName') as HTMLInputElement).value).toBe(
        'Retirement Account',
      );
    });

    it('refuses to rename an account the user does not own', () => {
      const fixture = render();
      flushAccounts(fixture);

      fixture.componentInstance['openRenameAccount']({
        accountId: 999,
        name: 'Someone else',
        openedDate: '2026-01-01',
      });

      expect(fixture.componentInstance['accountDialog']()).toBeNull();
    });

    it('opens the deposit and withdrawal dialogs from the net worth card', () => {
      const fixture = render();
      flushAccounts(fixture);

      button(fixture, 'Deposit').click();
      fixture.detectChanges();
      expect(text(element(fixture).querySelector('[role="dialog"] h2'))).toBe('Deposit funds');

      (element(fixture).querySelector('[aria-label="Close deposit"]') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(element(fixture).querySelector('app-cash-transaction-dialog')).toBeNull();

      button(fixture, 'Withdraw').click();
      fixture.detectChanges();
      expect(text(element(fixture).querySelector('[role="dialog"] h2'))).toBe('Withdraw funds');
    });

    it('lets a user with no accounts manage cash and prompts them to create one', () => {
      const fixture = render();
      flushAccounts(fixture, []);
      openDropdown(fixture, 'account-dropdown');

      expect(fixture.componentInstance['accountLabel']()).toBe('No accounts');
      expect(element(fixture).textContent).toContain("You don't have any accounts yet.");
      expect(element(fixture).textContent).toContain('Create an account to start building a portfolio.');
      expect(fixture.componentInstance['netWorth']()).toBe(CASH);
      expect(button(fixture, 'Deposit').disabled).toBe(false);

      button(fixture, 'Create an account').click();
      fixture.detectChanges();
      expect(element(fixture).querySelector('app-account-dialog')).not.toBeNull();
    });

    it('offers a retry when the accounts fail to load', () => {
      const fixture = render();
      const http = TestBed.inject(HttpTestingController);
      http.expectOne('/api/users/me').flush({ availableFunds: CASH });
      http.expectOne('/api/me/accounts').flush(null, { status: 500, statusText: 'Error' });
      fixture.detectChanges();
      openDropdown(fixture, 'account-dropdown');

      expect(fixture.componentInstance['accountLabel']()).toBe('Accounts unavailable');
      button(fixture, 'Try again').click();

      flushAccounts(fixture);
      expect(fixture.componentInstance['accountLabel']()).toBe('Personal Investing Account');
    });

    it('requests daily candles for holdings that arrive after the market snapshot', () => {
      const fixture = render();
      const http = TestBed.inject(HttpTestingController);
      fixture.componentInstance['applySnapshot']({
        sessionId: 2026001,
        status: 'OPEN',
        marketTimestamp: '2026-01-05T14:30:00Z',
        serverTimestamp: '2026-01-05T14:30:00Z',
        calendar: CALENDAR,
        stocks: [],
      });

      flushAccounts(fixture, [ACCOUNTS[1]]);

      expect(
        http.match(
          (request) =>
            request.url === '/api/market/candles' && request.params.get('symbol') === 'SPY',
        ),
      ).toHaveLength(1);
    });

    it('lists cash transactions with the trades, newest first', () => {
      const fixture = render();
      flushAccounts(fixture, ACCOUNTS, {
        transactions: [
          { cashTransactionId: 7, amount: 250, reason: 'DEPOSIT', createdAt: '2026-09-20T15:00:00Z' },
          {
            cashTransactionId: 8,
            amount: 40,
            reason: 'WITHDRAWAL',
            createdAt: '2026-09-01T15:00:00Z',
          },
        ],
      });

      const rows = Array.from(
        element(fixture).querySelectorAll('[data-testid="recent-transactions"] li'),
      ) as HTMLElement[];
      const rowText = rows.map((row) => text(row));

      expect(rows[0].dataset['kind']).toBe('cash');
      expect(rowText[0]).toContain('deposit');
      expect(rowText[0]).toContain('+$250.00');
      expect(rows[1].dataset['kind']).toBe('trade');
      expect(rowText.find((row) => row.includes('withdrawal'))).toContain('-$40.00');
    });
  });
});
