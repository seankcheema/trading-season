import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { DashboardComponent } from './dashboard.component';
import { Instrument, MOCK_INSTRUMENTS } from './mock-data';
import { OrderResult } from './orders/order.models';
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

// The signed-in user, as GET /api/users/me reports them.
const PROFILE = { firstName: 'Ada', lastName: 'Lovelace' };

// An order as POST /api/orders answers it.
function filledOrder(overrides: Partial<OrderResult> = {}): OrderResult {
  return {
    orderId: 1,
    status: 'FILLED',
    orderType: 'BUY',
    quantity: 1,
    indicativePrice: MOCK_INSTRUMENTS[0].price,
    rejectionReason: null,
    submittedAt: '2026-01-05T16:00:00Z',
    resolvedAt: '2026-01-05T16:00:00Z',
    ...overrides,
  };
}

// Answers the account, holdings and profile loads the dashboard starts with in the browser.
function flushAccounts(
  fixture: ComponentFixture<DashboardComponent>,
  accounts: { accountId: number; name: string; openedDate: string }[] = ACCOUNTS,
  {
    holdings = HOLDINGS,
    cash = CASH,
    transactions = [] as unknown[],
    profile = PROFILE,
    orders = [] as OrderResult[],
  }: {
    holdings?: Record<number, unknown[]>;
    cash?: number;
    transactions?: unknown[];
    profile?: { firstName: string; lastName: string };
    orders?: OrderResult[];
  } = {},
): HttpTestingController {
  const http = TestBed.inject(HttpTestingController);
  for (const request of http.match('/api/me/watchlist')) request.flush([]);
  http.expectOne('/api/me/accounts').flush(accounts);
  for (const account of accounts) {
    http
      .expectOne(`/api/accounts/${account.accountId}/holdings`)
      .flush(holdings[account.accountId] ?? []);
  }
  http.expectOne('/api/users/me').flush({ ...profile, availableFunds: cash });
  http.expectOne((request) => request.url === '/api/me/cash-transactions').flush(transactions);
  for (const request of http.match('/api/orders')) request.flush(orders);
  for (const request of http.match('/api/instruments'))
    request.flush([
      {
        instrumentId: 7,
        ticker: 'AAPL',
        simulatedStockSymbol: 'AAPL',
        name: 'Apple',
        assetClass: 'Equity',
        market: 'US',
        currency: 'USD',
        tradable: true,
      },
    ]);
  fixture.detectChanges();
  const selected = accounts[0];
  if (selected) {
    const positions = holdings[selected.accountId] as
      { quantity: number; averageCost: number }[] | undefined;
    for (const request of http.match(
      (request) => request.url === `/api/accounts/${selected.accountId}/portfolio-history`,
    ))
      request.flush(
        positions?.some((position) => position.quantity > 0)
          ? [
              {
                timestamp: '2026-10-01T18:00:00Z',
                value: positions.reduce(
                  (total, position) => total + position.quantity * position.averageCost,
                  0,
                ),
              },
            ]
          : [],
      );
    fixture.detectChanges();
  }
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

function createDashboard(): ComponentFixture<DashboardComponent> {
  const fixture = TestBed.createComponent(DashboardComponent);
  fixture.componentInstance['instruments'].set([...MOCK_INSTRUMENTS]);
  return fixture;
}

describe('DashboardComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
  });

  it('merges filled executions with cash by execution time and excludes unfilled orders', () => {
    const fixture = createDashboard();
    fixture.detectChanges();
    flushAccounts(fixture, ACCOUNTS, {
      transactions: [
        { cashTransactionId: 8, amount: 500, reason: 'DEPOSIT', createdAt: '2026-01-05T16:30:00Z' },
      ],
      orders: [
        filledOrder({
          instrumentId: 7,
          quantity: 2,
          indicativePrice: 100,
          submittedAt: '2026-01-05T15:00:00Z',
          resolvedAt: '2026-01-05T17:00:00Z',
        }),
        filledOrder({
          orderId: 2,
          instrumentId: 7,
          orderType: 'SELL',
          quantity: 1,
          indicativePrice: 120,
          resolvedAt: '2026-01-05T10:00:00-06:00',
        }),
        filledOrder({ orderId: 3, status: 'PENDING', resolvedAt: null }),
        filledOrder({ orderId: 4, status: 'REJECTED' }),
      ],
    });
    const rows = [
      ...fixture.nativeElement.querySelectorAll(
        '[data-testid="recent-transactions"] li[data-kind]',
      ),
    ] as HTMLElement[];
    expect(rows).toHaveLength(3);
    expect(rows[0].textContent).toContain('AAPL');
    expect(rows[0].textContent).toContain('BUY');
    expect(rows[0].textContent).toContain('-$200.00');
    expect(rows[0].textContent).toContain('2 shares');
    expect(rows[1].dataset['kind']).toBe('cash');
    expect(rows[2].textContent).toContain('SELL');
    expect(rows[2].textContent).toContain('+$120.00');
  });

  it('shows executions at selected replay times and falls back to audit time', () => {
    const fixture = createDashboard();
    fixture.detectChanges();
    flushAccounts(fixture, ACCOUNTS, {
      orders: [
        filledOrder({
          orderId: 1,
          simulatedAt: '2026-01-06T17:00:00Z',
          resolvedAt: '2026-10-01T18:00:00Z',
        }),
        filledOrder({
          orderId: 2,
          simulatedAt: '2026-01-05T16:00:00Z',
          resolvedAt: '2026-10-01T18:01:00Z',
        }),
        filledOrder({ orderId: 3, simulatedAt: null, resolvedAt: '2026-10-01T18:02:00Z' }),
      ],
    });
    const activity = fixture.componentInstance['transactions']();
    expect(activity.map((item) => item.key)).toEqual(['order-3', 'order-1', 'order-2']);
    expect(activity.map((item) => item.date)).toEqual([
      '2026-10-01T18:02:00Z',
      '2026-01-06T17:00:00Z',
      '2026-01-05T16:00:00Z',
    ]);
  });

  it('rewinds the complete account view and restores executions without another submission', () => {
    const fixture = createDashboard();
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component['applySnapshot']({
      sessionId: 1,
      status: 'OPEN',
      marketTimestamp: '2026-01-05T16:00:00Z',
      serverTimestamp: '2026-10-01T18:00:00Z',
      calendar: CALENDAR,
      stocks: [
        {
          symbol: 'AAPL',
          companyName: 'Apple',
          price: 120,
          change: 0,
          changePercent: 0,
          timestamp: '2026-01-05T16:00:00Z',
        },
      ],
    });
    const buy = '2026-01-10T16:00:00Z';
    const sell = '2026-01-20T16:00:00Z';
    const http = flushAccounts(fixture, [ACCOUNTS[0]], {
      cash: 1040,
      holdings: { 1: [{ symbol: 'AAPL', quantity: 0, averageCost: 100 }] },
      orders: [
        filledOrder({
          accountId: 1,
          instrumentId: 7,
          quantity: 2,
          indicativePrice: 100,
          simulatedAt: buy,
        }),
        filledOrder({
          accountId: 1,
          instrumentId: 7,
          orderId: 2,
          orderType: 'SELL',
          quantity: 2,
          indicativePrice: 120,
          simulatedAt: sell,
        }),
      ],
    });
    const answerCandles = () => {
      for (const request of http.match((request) => request.url === '/api/market/candles')) {
        if (!request.cancelled)
          request.flush({
            symbol: 'AAPL',
            points: [
              { timestamp: buy, close: 100 },
              { timestamp: sell, close: 120 },
            ],
          });
      }
      fixture.detectChanges();
    };
    answerCandles();
    for (const [timestamp, shares, cash, rows] of [
      ['2026-01-05T16:00:00Z', 0, 1000, 0],
      [buy, 2, 800, 1],
      [sell, 0, 1040, 2],
      [buy, 2, 800, 1],
      ['2026-01-05T16:00:00Z', 0, 1000, 0],
    ] as const) {
      component['currentMarketTimestamp'].set(timestamp);
      fixture.detectChanges();
      answerCandles();
      expect(component['positions']()['AAPL'] ?? 0).toBe(shares);
      expect(component['cashBalance']()).toBe(cash);
      expect(component['tradingPositions']()['AAPL'] ?? 0).toBe(0);
      expect(component['tradingCashBalance']()).toBe(1040);
      expect(component['portfolioValue']()).toBe(shares * 120);
      expect(component['netWorth']()).toBe(cash + shares * 120);
      expect(component['transactions']().filter((item) => item.kind === 'trade')).toHaveLength(
        rows,
      );
    }
    http.expectNone({ method: 'POST', url: '/api/orders' });
  });

  it('passes current balances to the order dialog while the portfolio shows earlier holdings', () => {
    const fixture = createDashboard();
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const http = flushAccounts(fixture, [ACCOUNTS[0]], {
      cash: 1040,
      holdings: { 1: [{ symbol: 'AAPL', quantity: 0, averageCost: 100 }] },
      orders: [
        filledOrder({
          accountId: 1,
          instrumentId: 7,
          orderType: 'SELL',
          quantity: 40,
          indicativePrice: 100,
          simulatedAt: '2026-10-02T18:23:08Z',
        }),
      ],
    });
    component['currentMarketTimestamp'].set('2026-10-02T16:33:03Z');
    component['openOrder'](MOCK_INSTRUMENTS[0]);
    fixture.detectChanges();
    expect(component['positions']()['AAPL']).toBe(40);
    const dialog = fixture.nativeElement.querySelector('app-order-submission');
    expect(component['tradingPositions']()['AAPL']).toBe(0);
    expect(dialog.textContent).toContain('$1,040.00');
    http.expectNone({ method: 'POST', url: '/api/orders' });
  });

  it('should create the dashboard component', () => {
    const fixture = createDashboard();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it.each([100, 100.5, 0])(
    'displays two decimal places for both financial cards at %s',
    (value) => {
      const fixture = createDashboard();
      fixture.detectChanges();
      flushAccounts(fixture, [ACCOUNTS[0]], {
        holdings: { 1: [{ symbol: 'UNQUOTED', quantity: 1, averageCost: value }] },
        cash: 0,
      });
      for (const testId of ['net-worth', 'portfolio-value']) {
        expect(
          fixture.nativeElement.querySelector(`[data-testid="${testId}"]`).textContent.trim(),
        ).toBe(`$${value.toFixed(2)}`);
      }
    },
  );

  it('uses the selected simulation time for the latest displayed value', () => {
    const fixture = createDashboard();
    fixture.detectChanges();
    flushAccounts(fixture);
    const component = fixture.componentInstance;
    component['currentMarketTimestamp'].set('2026-01-05T16:00:00Z');

    const points = component['portfolioChart']();

    expect(points).toHaveLength(1);
    expect(points[0].time.toISOString()).toBe('2026-01-05T16:00:00.000Z');
  });

  it('should not show the order submission dialog initially', () => {
    const fixture = createDashboard();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-order-submission')).toBeNull();
  });

  it('should open the order submission dialog when an instrument is selected', async () => {
    const fixture = createDashboard();
    fixture.componentInstance['openOrder'](MOCK_INSTRUMENTS[0]);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).not.toBeNull();
  });

  it('should keep the dialog open after an order so its outcome stays visible', () => {
    const fixture = createDashboard();
    fixture.detectChanges();
    const http = flushAccounts(fixture);
    const component = fixture.componentInstance;
    component['openOrder'](MOCK_INSTRUMENTS[0]);

    component['onOrderSubmitted'](filledOrder());

    expect(component['orderInstrument']()).not.toBeNull();
    // A fill moved the user's cash and the account's positions, so both are reloaded.
    http.expectOne('/api/users/me').flush({ ...PROFILE, availableFunds: 9_683.41 });
    http.expectOne('/api/accounts/1/holdings').flush(HOLDINGS[1]);
    http
      .expectOne('/api/accounts/1/portfolio-valuations')
      .flush({ timestamp: '2026-10-01T18:00:00Z', value: 6500 });
    http
      .expectOne((request) => request.url === '/api/accounts/1/portfolio-history')
      .flush([{ timestamp: '2026-10-01T18:00:00Z', value: 6500 }]);
    expect(component['cashBalance']()).toBe(9_683.41);
    expect(component['portfolioChart']()[0].value).toBe(6500);
  });

  it('should reload nothing when an order was rejected', () => {
    const fixture = createDashboard();
    fixture.detectChanges();
    const http = flushAccounts(fixture);

    fixture.componentInstance['onOrderSubmitted'](
      filledOrder({ status: 'REJECTED', rejectionReason: 'BR-05: not tradable' }),
    );

    // Nothing changed, so reloading would only be a wasted round trip.
    http.expectNone('/api/users/me');
    http.expectNone('/api/accounts/1/holdings');
    http.expectNone('/api/accounts/1/portfolio-valuations');
    expect(fixture.componentInstance['cashBalance']()).toBe(CASH);
  });

  it('should leave the dashboard on its loaded figures when the post-trade reload fails', () => {
    const fixture = createDashboard();
    fixture.detectChanges();
    const http = flushAccounts(fixture);

    fixture.componentInstance['onOrderSubmitted'](filledOrder());
    // The two reloads run together, so failing one cancels the other.
    http.expectOne('/api/users/me').flush(null, { status: 500, statusText: 'Server Error' });

    // The trade already happened; a failed reload must not be shown as a failed trade.
    expect(fixture.componentInstance['cashBalance']()).toBe(CASH);
  });

  it('should render market time and account dropdowns in the right header controls', () => {
    const fixture = createDashboard();
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
    const fixture = createDashboard();
    fixture.detectChanges();

    const profileDropdown = fixture.nativeElement.querySelector(
      '[data-testid="profile-dropdown"]',
    ) as HTMLElement;
    const trigger = profileDropdown.querySelector('summary') as HTMLElement;
    const items = Array.from(
      profileDropdown.querySelectorAll('button[role="menuitem"]'),
    ) as HTMLButtonElement[];

    expect(trigger.className).toContain('rounded-full');
    expect(trigger.textContent?.trim()).toBe('');
    expect(items.map((item) => item.textContent?.trim())).toEqual(['Settings', 'Log out']);
    expect(items[1].className).toContain('text-loss');
    expect(fixture.nativeElement.querySelector('[aria-label="Sign out"]')).toBeNull();
  });

  it('should sign out and return to login from the profile menu', async () => {
    const fixture = createDashboard();
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
    const fixture = createDashboard();
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
    const fixture = createDashboard();
    fixture.componentInstance['onSettings']();
    fixture.detectChanges();

    (
      fixture.nativeElement.querySelector('[aria-label="Close settings"]') as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-settings-dialog')).toBeNull();
  });

  it('should update the selected account from the custom account dropdown and close it', () => {
    const fixture = createDashboard();
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
    const fixture = createDashboard();
    fixture.detectChanges();

    openDropdown(fixture, 'market-clock-dropdown');
    openDropdown(fixture, 'account-dropdown');

    expect(dropdownDetails(fixture, 'market-clock-dropdown').open).toBe(false);
    expect(dropdownDetails(fixture, 'account-dropdown').open).toBe(true);
    expect(fixture.componentInstance['openHeaderDropdown']()).toBe('account');
  });

  it('should close the account dropdown when the market clock dropdown opens', () => {
    const fixture = createDashboard();
    fixture.detectChanges();

    openDropdown(fixture, 'account-dropdown');
    openDropdown(fixture, 'market-clock-dropdown');

    expect(dropdownDetails(fixture, 'account-dropdown').open).toBe(false);
    expect(dropdownDetails(fixture, 'market-clock-dropdown').open).toBe(true);
    expect(fixture.componentInstance['openHeaderDropdown']()).toBe('market-clock');
  });

  it('should close an open header dropdown when clicking outside it', () => {
    const fixture = createDashboard();
    fixture.detectChanges();

    openDropdown(fixture, 'account-dropdown');
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();

    expect(dropdownDetails(fixture, 'account-dropdown').open).toBe(false);
    expect(fixture.componentInstance['openHeaderDropdown']()).toBeNull();
  });

  it('should keep an open header dropdown open when clicking inside it', () => {
    const fixture = createDashboard();
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
    const fixture = createDashboard();
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
    expect(marketDropdown.textContent).toContain('Jan 5, 8:30:00 AM CT');
    expect(accountDropdown.className).toContain('w-60');
    expect(accountDetails.className).toContain('w-full');
    expect(marketDropdown.className).toContain('w-60');
    expect(marketDetails.className).toContain('w-full');
    expect(accountPanel.className).toContain('w-full');
    expect(marketPanel.className).toContain('w-full');
    expect(accountLabel.className).toContain('min-w-0');
    expect(accountLabel.className).toContain('flex-1');
    expect(accountLabel.className).toContain('truncate');
    expect(accountLabel.className).not.toContain('break-words');
    expect(marketLabel.className).toContain('truncate');
    expect(marketLabel.className).not.toContain('break-words');
  });

  it('sorts assets by ticker', () => {
    const fixture = createDashboard();
    const component = fixture.componentInstance;
    vi.spyOn(component as unknown as { holdings: () => ReturnType<typeof component['holdings']> }, 'holdings').mockReturnValue([
      { symbol: 'MSFT', value: 300 },
      { symbol: 'AAPL', value: 100 },
    ] as ReturnType<typeof component['holdings']>);
    expect(component['visibleAssets']().map((holding) => holding.symbol)).toEqual(['AAPL', 'MSFT']);
  });

  it('should render separate assets table columns for shares, prices, changes, and values', () => {
    const fixture = createDashboard();
    fixture.detectChanges();
    flushAccounts(fixture);

    const table = fixture.nativeElement.querySelector(
      '[data-testid="assets-table"]',
    ) as HTMLElement;
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
    const fixture = createDashboard();
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
    const fixture = createDashboard();
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
    const fixture = createDashboard();
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
    const fixture = createDashboard();
    const component = fixture.componentInstance;
    const http = TestBed.inject(HttpTestingController);
    component['marketSessionId'].set(2026001);

    component['applyMarketDateTime']('2026-01-05T08:30');

    http
      .expectOne('/api/market/clock?sessionId=2026001')
      .flush(
        { error: 'Selected date has no seeded trading data' },
        { status: 400, statusText: 'Bad Request' },
      );
    expect(component['clockError']()).toBe('Selected date has no seeded trading data');
  });

  it('should display the current simulated time in the market clock trigger', () => {
    const fixture = createDashboard();
    fixture.componentInstance['applySnapshot']({
      sessionId: 2026001,
      status: 'OPEN',
      marketTimestamp: '2026-01-05T14:30:00Z',
      serverTimestamp: '2026-01-05T14:30:00Z',
      calendar: CALENDAR,
      stocks: [],
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Jan 5, 8:30:00 AM CT');
  });

  it('should show shortened copy in the market clock dropdown', () => {
    const fixture = createDashboard();
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
    const fixture = createDashboard();
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
    const fixture = createDashboard();
    const component = fixture.componentInstance;
    const http = TestBed.inject(HttpTestingController);
    component['marketSessionId'].set(2026001);
    component['marketCalendar'].set(CALENDAR);

    component['applyMarketDateTime']('2026-01-04T08:30');

    http.expectNone('/api/market/clock?sessionId=2026001');
    expect(component['clockError']()).toContain('market data from Jan 5');
  });

  it('should apply the next loaded trading date when the selected day is not seeded', () => {
    const fixture = createDashboard();
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
    const fixture = createDashboard();
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

  it('updates ticker prices immediately and animates the movement for 500 to 1000 ms', () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const fixture = createDashboard();
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

    component['applyTick']('AAPL', 101);

    expect(component['instruments']()[0]).toEqual({
      ...instrument,
      price: 101,
      change: 6,
      changePercent: (6 / 95) * 100,
    });
    expect(component['tickAnimations']().get('AAPL')).toEqual({
      direction: 'gain',
      durationMs: 500,
      revision: 1,
    });
    vi.advanceTimersByTime(500);
    expect(component['tickAnimations']().has('AAPL')).toBe(false);
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('applies a tick timestamp and prices synchronously without queued price updates', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999999);
    const fixture = createDashboard();
    const component = fixture.componentInstance;
    component['instruments'].set([{ ...MOCK_INSTRUMENTS[0], price: 100 }]);

    component['queueTickBatch']({
      eventId: 2,
      marketTimestamp: '2026-01-05T14:30:01Z',
      serverTimestamp: '2026-01-05T14:30:01Z',
      prices: [{ symbol: MOCK_INSTRUMENTS[0].symbol, price: 99, sequenceNumber: 2 }],
    });

    expect(component['currentMarketTimestamp']()).toBe('2026-01-05T14:30:01Z');
    expect(component['marketClockLabel']()).toBe('Jan 5, 8:30:01 AM CT');
    expect(component['instruments']()[0].price).toBe(99);
    expect(component['tickAnimations']().get(MOCK_INSTRUMENTS[0].symbol)?.direction).toBe('loss');
    expect(component['tickAnimations']().get(MOCK_INSTRUMENTS[0].symbol)?.durationMs).toBe(1000);
    vi.restoreAllMocks();
  });

  describe('accounts, portfolios and cash', () => {
    function render() {
      const fixture = createDashboard();
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
        element(fixture).querySelectorAll(
          '[data-testid="account-dropdown"] [role="menuitemradio"]',
        ),
      ) as HTMLButtonElement[];
    }

    function button(fixture: ComponentFixture<DashboardComponent>, name: string) {
      return Array.from(element(fixture).querySelectorAll('button')).find(
        (candidate) => candidate.textContent?.trim() === name,
      ) as HTMLButtonElement;
    }

    function assetSymbols(fixture: ComponentFixture<DashboardComponent>) {
      return Array.from(
        element(fixture).querySelectorAll(
          '[data-testid="assets-table"] [data-testid^="asset-row-"]',
        ),
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

      expect(assetSymbols(fixture)).toEqual(['AAPL', 'MSFT', 'NVDA', 'SPY', 'TSLA']);
      expect(text(element(fixture).querySelector('h2.dash-label'))).toBe('Net Worth');
      expect(element(fixture).textContent).toContain(
        'Portfolio Value · Personal Investing Account',
      );

      fixture.componentInstance['selectAccount'](2);
      fixture.detectChanges();

      expect(assetSymbols(fixture)).toEqual(['SPY']);
      expect(fixture.componentInstance['positions']()).toEqual({ SPY: 2 });
      expect(fixture.componentInstance['portfolioChangePercent']()).toBeNull();
    });

    it('hides stocks with a zero total from Assets', () => {
      const fixture = render();
      flushAccounts(fixture, ACCOUNTS, {
        holdings: {
          1: [
            { symbol: 'AAPL', quantity: 0, averageCost: 280.1 },
            { symbol: 'ZERO', quantity: 2, averageCost: 0 },
            { symbol: 'SPY', quantity: 2, averageCost: 600 },
          ],
        },
      });

      expect(assetSymbols(fixture)).toEqual(['SPY']);

      fixture.componentInstance['selectAccount'](2);
      fixture.detectChanges();
      expect(assetSymbols(fixture)).toEqual([]);
    });

    it('shows the Assets empty state when every stock has a zero total', () => {
      const fixture = render();
      flushAccounts(fixture, ACCOUNTS, {
        holdings: { 1: [{ symbol: 'AAPL', quantity: 0, averageCost: 280.1 }] },
      });

      expect(assetSymbols(fixture)).toEqual([]);
      expect(text(element(fixture).querySelector('[data-testid="assets-table"]'))).toContain(
        'This account has no holdings yet.',
      );
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
      expect(
        text(element(fixture).querySelector('[data-testid="portfolio-chart-empty-state"]')),
      ).toBe('No portfolio history in this range yet.');
      expect(element(fixture).querySelector('app-price-chart')).toBeNull();
      expect(element(fixture).querySelector('app-timeframe-toggle')).not.toBeNull();
      expect(text(element(fixture).querySelector('[data-testid="portfolio-value"]'))).toBe('$0.00');
      expect(element(fixture).textContent).toContain('Portfolio Value · Fresh');
    });

    it('shows a loading state without rendering a zero-value portfolio chart', () => {
      const fixture = render();

      expect(text(element(fixture).querySelector('[data-testid="portfolio-chart-status"]'))).toBe(
        'Loading portfolio…',
      );
      expect(element(fixture).querySelector('app-price-chart')).toBeNull();
      expect(element(fixture).querySelector('app-timeframe-toggle')).toBeNull();
    });

    it('shows an unavailable state when accounts fail to load', () => {
      const fixture = render();
      const http = TestBed.inject(HttpTestingController);
      http.expectOne('/api/users/me').flush({ availableFunds: CASH });
      http.expectOne('/api/me/accounts').flush(null, { status: 500, statusText: 'Error' });
      fixture.detectChanges();

      expect(text(element(fixture).querySelector('[data-testid="portfolio-chart-status"]'))).toBe(
        'Ready to grow your portfolio? Start trading to get things moving.',
      );
      expect(
        element(fixture).querySelector('[data-testid="portfolio-chart-status"] ng-icon'),
      ).not.toBeNull();
      expect(element(fixture).querySelector('app-price-chart')).toBeNull();
      expect(element(fixture).querySelector('app-timeframe-toggle')).toBeNull();
    });

    it('shows the portfolio chart and timeframe controls for a positive value', () => {
      const fixture = render();
      flushAccounts(fixture);

      expect(fixture.componentInstance['hasChartablePortfolioValue']()).toBe(true);
      expect(element(fixture).querySelector('app-price-chart')).not.toBeNull();
      expect(element(fixture).querySelector('app-timeframe-toggle')).not.toBeNull();
      expect(
        element(fixture).querySelector('[data-testid="portfolio-chart-empty-state"]'),
      ).toBeNull();
    });

    it('compares the current portfolio against the selected year opening value', () => {
      const fixture = render();
      flushAccounts(fixture);
      const component = fixture.componentInstance;
      component['portfolioTimeframe'].set('1Y');
      fixture.detectChanges();
      const current = component['portfolioValue']();
      const http = TestBed.inject(HttpTestingController);
      http
        .expectOne(
          (request) =>
            request.url.endsWith('/portfolio-history') && request.params.get('timeframe') === '1Y',
        )
        .flush([
          { timestamp: '2025-10-01T18:00:00Z', value: current / 2 },
          { timestamp: '2026-10-01T18:00:00Z', value: current },
        ]);
      fixture.detectChanges();
      expect(component['portfolioChangePercent']()).toBeCloseTo(100);
      expect(text(element(fixture).querySelector('[data-testid="portfolio-change-percent"]'))).toBe(
        '+100.00%',
      );
      component['portfolioHistory'].points.set([
        { time: new Date('2025-10-01T18:00:00Z'), value: 0 },
        { time: new Date('2026-01-01T18:00:00Z'), value: 0 },
        { time: new Date('2026-02-01T18:00:00Z'), value: current / 2 },
        { time: new Date('2026-10-01T18:00:00Z'), value: current },
      ]);
      fixture.detectChanges();
      expect(component['portfolioChangePercent']()).toBeCloseTo(100);
      expect(text(element(fixture).querySelector('[data-testid="portfolio-change-percent"]'))).toBe(
        '+100.00%',
      );
      component['portfolioHistory'].points.set([
        { time: new Date('2025-10-01T18:00:00Z'), value: current * 2 },
      ]);
      expect(component['portfolioChangePercent']()).toBeCloseTo(-50);
      component['portfolioHistory'].points.set([
        { time: new Date('2025-10-01T18:00:00Z'), value: current },
      ]);
      expect(component['portfolioChangePercent']()).toBe(0);
    });

    it('shows an unavailable percentage for zero, missing, loading, or failed history', () => {
      const fixture = render();
      flushAccounts(fixture);
      const component = fixture.componentInstance;
      const history = component['portfolioHistory'];
      for (const points of [[], [{ time: new Date(0), value: 0 }]]) {
        history.points.set(points);
        fixture.detectChanges();
        expect(component['portfolioChangePercent']()).toBeNull();
        expect(
          text(element(fixture).querySelector('[data-testid="portfolio-change-percent"]')),
        ).toBe('—');
      }
      history.points.set([{ time: new Date(0), value: 100 }]);
      for (const status of ['loading', 'error'] as const) {
        history.status.set(status);
        expect(component['portfolioChangePercent']()).toBeNull();
      }
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
        element(fixture).querySelector(
          '[aria-label="Rename Retirement Account"]',
        ) as HTMLButtonElement
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
      expect(element(fixture).textContent).toContain(
        'Create an account to start building a portfolio.',
      );
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

    it("lists only the user's own cash transactions, newest first", () => {
      const fixture = render();
      flushAccounts(fixture, ACCOUNTS, {
        transactions: [
          {
            cashTransactionId: 7,
            amount: 250,
            reason: 'DEPOSIT',
            createdAt: '2026-09-20T15:00:00Z',
          },
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

      // Every row is the caller's own cash movement: no placeholder trades are mixed in.
      expect(rows.map((row) => row.dataset['kind'])).toEqual(['cash', 'cash']);
      expect(rowText[0]).toContain('deposit');
      expect(rowText[0]).toContain('+$250.00');
      expect(rowText[1]).toContain('withdrawal');
      expect(rowText[1]).toContain('-$40.00');
    });

    it('shows an empty transactions list for a user who has moved no cash', () => {
      const fixture = render();
      flushAccounts(fixture, ACCOUNTS, { transactions: [] });

      const rows = Array.from(
        element(fixture).querySelectorAll('[data-testid="recent-transactions"] li'),
      ) as HTMLElement[];

      expect(rows).toHaveLength(1);
      expect(rows[0].dataset['kind']).toBeUndefined();
      expect(text(rows[0])).toContain('No transactions yet');
    });

    it('shows a new user an empty dashboard around their default account', () => {
      const fixture = render();
      flushAccounts(fixture, [{ accountId: 9, name: 'Main Account', openedDate: '2026-09-29' }], {
        holdings: {},
        cash: 0,
        transactions: [],
      });

      // The default account is selected and named, with nothing in it and no cash.
      expect(text(element(fixture).querySelector('[data-testid="portfolio-value"]'))).toBe('$0.00');
      expect(text(element(fixture).querySelector('[data-testid="net-worth"]'))).toBe('$0.00');
      expect(text(element(fixture).querySelector('[data-testid="assets-table"]'))).toContain(
        'This account has no holdings yet.',
      );
      expect(text(element(fixture).querySelector('[data-testid="recent-transactions"]'))).toContain(
        'No transactions yet',
      );
    });

    it("shows the signed-in user's first and last initial in the profile circle", () => {
      const fixture = render();
      flushAccounts(fixture, ACCOUNTS, { profile: { firstName: 'ada', lastName: 'lovelace' } });

      expect(text(element(fixture).querySelector('[data-testid="profile-initials"]'))).toBe('AL');
    });

    it('shows one initial when the user has only one name on file', () => {
      const fixture = render();
      flushAccounts(fixture, ACCOUNTS, { profile: { firstName: 'Prince', lastName: '' } });

      expect(text(element(fixture).querySelector('[data-testid="profile-initials"]'))).toBe('P');
    });
  });
});
