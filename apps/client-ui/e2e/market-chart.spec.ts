import type { Page } from '@playwright/test';
import { newAccount } from './fixtures/accounts';
import type { LoginPage } from './fixtures/pages';
import { expect, test } from './fixtures/test';

const USER = newAccount();

test.use({
  stubOptions: {
    accounts: [
      {
        email: USER.email,
        password: USER.password,
        hasProfile: true,
        tradingAccounts: [{ name: 'Investing' }, { name: 'Retirement' }],
      },
    ],
  },
});

async function openMarketPage(page: Page, loginPage: LoginPage): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginPage.goto();
  await loginPage.signIn(USER.email, USER.password);
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole('combobox', { name: 'Search instruments' }).fill('AAPL');
  await page.getByRole('option', { name: /AAPL/ }).first().click();
  const dialog = page.getByRole('dialog', { name: 'New Order' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('link', { name: 'Open full screen market chart' })).toBeVisible();

  await dialog.getByRole('link', { name: 'Open full screen market chart' }).click();
  await expect(page).toHaveURL(/\/dashboard\/markets\/aapl$/);
  await expect(page.getByRole('heading', { name: 'AAPL', exact: true })).toBeVisible();
}

test('executes a trade and shows recent orders within the full-screen layout', async ({
  page,
  loginPage,
  api,
}) => {
  await openMarketPage(page, loginPage);

  await expect(page.getByText('Apple Inc.')).toBeVisible();
  await expect(page.getByText('Range Volume')).toBeVisible();
  await expect(page.locator('.market-metrics').getByText('1,200', { exact: true })).toBeVisible();

  await page.locator('#future-trade-quantity').fill('3');
  await page.getByRole('button', { name: 'Buy 3 AAPL', exact: true }).click();
  await expect(page.locator('hlm-toaster .toast')).toContainText('Filled 3 AAPL at $225.80.');
  await page.getByRole('tab', { name: 'Recent Orders', exact: true }).click();
  await expect(page.getByTestId('market-recent-orders')).toContainText(
    '3 @ $225.80 · MARKET · Filled',
  );
  await page.getByRole('tab', { name: 'Trading', exact: true }).click();
  await expect(page.locator('app-trade-ticket')).toContainText('$4,322.60');
  // Available cash previews another current draft; the ticket shows persisted cash.
  await expect(page.getByTestId('available-cash')).toContainText('$3,645.20');
  expect(api.fundsOf(USER.email)).toBeCloseTo(4322.6);
  await expect(page.getByTestId('account-portfolio-value')).toContainText('$677.40');
  expect(
    api.requests.filter(
      (request) => request.method === 'POST' && request.url.endsWith('/api/orders'),
    ),
  ).toHaveLength(1);

  for (const viewport of [
    { width: 1280, height: 900 },
    { width: 1440, height: 900 },
    { width: 1600, height: 900 },
    { width: 1280, height: 650 },
  ]) {
    await page.setViewportSize(viewport);
    expect(
      await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight),
    ).toBe(true);
    const panel = page.locator('.insight-panel');
    const recentTab = page.getByRole('tab', { name: 'Recent Orders', exact: true });
    const bounds = await panel.boundingBox();
    const tabBounds = await recentTab.boundingBox();
    expect(tabBounds!.x + tabBounds!.width).toBeLessThanOrEqual(bounds!.x + bounds!.width);
    const accountBounds = await page.getByTestId('account-value-panel').boundingBox();
    const ticketBounds = await page.locator('app-trade-ticket').boundingBox();
    const mainBounds = await page.locator('.market-main').boundingBox();
    expect(Math.abs(bounds!.y - mainBounds!.y)).toBeLessThan(2);
    expect(Math.abs(bounds!.height - mainBounds!.height)).toBeLessThan(2);
    expect(accountBounds!.y).toBeGreaterThan(bounds!.y);
    const clockBounds = await page.getByTestId('market-clock-dropdown').boundingBox();
    const pickerBounds = await page.getByTestId('account-dropdown').boundingBox();
    expect(pickerBounds!.x).toBeGreaterThan(clockBounds!.x);
    expect(pickerBounds!.width).toBe(clockBounds!.width);
    expect(pickerBounds!.height).toBe(clockBounds!.height);
    const searchBounds = await page
      .getByRole('combobox', { name: 'Search instruments' })
      .boundingBox();
    const backBounds = await page.getByRole('link', { name: 'Back to dashboard' }).boundingBox();
    const searchHost = await page.locator('.market-nav app-instrument-search').boundingBox();
    expect(searchHost!.height).toBe(searchBounds!.height);
    expect(searchHost!.y).toBe(searchBounds!.y);
    expect(pickerBounds!.height).toBe(36);
    expect(backBounds!.height).toBe(searchBounds!.height);
    expect(pickerBounds!.y + pickerBounds!.height / 2).toBe(
      searchBounds!.y + searchBounds!.height / 2,
    );
    for (const id of ['notifications-dropdown', 'profile-dropdown']) {
      const iconBounds = await page.getByTestId(id).locator('summary').boundingBox();
      expect(iconBounds!.height).toBe(36);
      expect(iconBounds!.y + iconBounds!.height / 2).toBe(
        searchBounds!.y + searchBounds!.height / 2,
      );
    }
    for (const id of ['market-clock-dropdown', 'account-dropdown']) {
      const trigger = await page.getByTestId(id).locator('summary').boundingBox();
      expect(trigger!.height).toBe(36);
      expect(trigger!.y + trigger!.height / 2).toBe(searchBounds!.y + searchBounds!.height / 2);
    }
    expect(ticketBounds!.y).toBeGreaterThanOrEqual(accountBounds!.y + accountBounds!.height);
    await page.locator('#future-trade-quantity').fill('2');
    for (const name of ['Overview', 'News', 'AI', 'Recent Orders']) {
      await page.getByRole('tab', { name, exact: true }).click();
      await expect(page.locator('app-trade-ticket')).toBeHidden();
    }
    await page.getByRole('tab', { name: 'Trading', exact: true }).click();
    await expect(page.locator('.trading-content')).toBeVisible();
    await expect(page.locator('#future-trade-quantity')).toHaveValue('2');
    if (viewport.height === 900) {
      const ticket = page.locator('app-trade-ticket');
      const cashCard = await page.locator('.account-cash-card').boundingBox();
      expect(cashCard!.height).toBeGreaterThanOrEqual(80);
      expect(cashCard!.height).toBeLessThan(100);
      const estimate = await ticket.getByText('Estimated cost', { exact: true }).boundingBox();
      const action = await ticket.locator('section > button').first().boundingBox();
      expect(action!.y - (estimate!.y + estimate!.height)).toBeGreaterThanOrEqual(8);
      const ticketBounds = await ticket.boundingBox();
      expect(
        Math.abs(ticketBounds!.y + ticketBounds!.height - (bounds!.y + bounds!.height - 13)),
      ).toBeLessThan(3);
    }
    const content = page.locator('.trading-content');
    expect(await content.evaluate((el) => el.scrollHeight >= el.clientHeight)).toBe(true);
    const accountPicker = page.getByTestId('account-dropdown');
    await accountPicker.locator('summary').focus();
    await page.keyboard.press('Enter');
    await expect(accountPicker.getByRole('menuitemradio').first()).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(accountPicker.locator('details')).not.toHaveAttribute('open', '');
    await page.screenshot({ path: `reports/playwright/market-orders-${viewport.width}.png` });
  }

  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight),
  ).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('tab', { name: 'Recent Orders', exact: true }).click();
  const mobileHistory = page.getByTestId('market-recent-orders');
  await mobileHistory.scrollIntoViewIfNeeded();
  expect((await mobileHistory.boundingBox())!.height).toBeGreaterThan(200);
  await expect(mobileHistory).toBeInViewport({ ratio: 0.9 });
  await page.screenshot({ path: 'reports/playwright/market-orders-mobile.png', fullPage: true });
});

test('changes chart tools and keeps the selected comparison in the URL', async ({
  page,
  loginPage,
}) => {
  await openMarketPage(page, loginPage);

  await page.getByRole('button', { name: /Graph view: Area/ }).click();
  await page.getByRole('menuitemradio', { name: 'Candles chart' }).click();
  await expect(page.getByRole('button', { name: /Graph view: Candles/ })).toBeVisible();

  await page.getByRole('button', { name: /Indicators/ }).click();
  const sma = page.getByRole('menuitemcheckbox', { name: 'SMA 20' });
  await sma.click();
  await expect(sma).toHaveAttribute('aria-checked', 'true');

  await page.getByRole('button', { name: /Compare/ }).click();
  const comparisonPicker = page.getByRole('dialog', { name: 'Choose a stock to compare' });
  await comparisonPicker.getByRole('combobox', { name: 'Search instruments' }).fill('MSFT');
  await comparisonPicker.getByRole('option', { name: /MSFT/ }).click();

  await expect(page).toHaveURL(/\/dashboard\/markets\/aapl\?compare=msft$/);
  await expect(page.getByRole('region', { name: 'AAPL price chart' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'MSFT price chart' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remove comparison', exact: true })).toBeVisible();
});

test('keeps account selection and rewinds executions with the shared clock', async ({
  page,
  loginPage,
  api,
}) => {
  // The selected account is kept by the app for this tab, never in the URL.
  const visited: string[] = [];
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) {
      visited.push(frame.url());
    }
  });
  await loginPage.goto();
  await loginPage.signIn(USER.email, USER.password);
  await page.getByTestId('account-dropdown').locator('summary').click();
  await page.getByRole('menuitemradio', { name: /Retirement/ }).click();
  await page.getByRole('combobox', { name: 'Search instruments' }).fill('AAPL');
  await page.getByRole('option', { name: /AAPL/ }).first().click();
  await page.getByRole('link', { name: 'Open full screen market chart' }).click();
  await expect(page.getByTestId('account-dropdown').locator('summary')).toContainText('Retirement');
  await page.reload();
  await expect(page.getByTestId('account-dropdown').locator('summary')).toContainText('Retirement');
  const buy = page.getByRole('button', { name: 'Buy 2 AAPL', exact: true });
  // The ticket zeroes the quantity when the account input settles, so refill until the click lands.
  await expect(async () => {
    await page.locator('#future-trade-quantity').fill('2');
    await buy.click({ timeout: 2000 });
  }).toPass();
  await expect(page.locator('hlm-toaster .toast')).toContainText('Filled 2 AAPL');
  await page.getByRole('tab', { name: 'Recent Orders', exact: true }).click();
  const history = page.getByTestId('market-recent-orders');
  await expect(history).toContainText('2 @ $225.80 · MARKET · Filled');
  const clock = page.getByTestId('market-clock-dropdown');
  await clock.locator('summary').click();
  await clock.locator('input').fill('2026-01-05T08:30');
  await clock.getByRole('button', { name: 'Apply time' }).click();
  await expect(history).toContainText('No orders at this simulated time.');
  // Rewinding changes history and portfolio views, while trading limits use persisted balances.
  await expect(page.locator('app-trade-ticket')).toContainText('$4,548.40');
  await expect(page.getByTestId('account-portfolio-value')).toContainText('$0.00');
  expect(api.fundsOf(USER.email)).toBeCloseTo(4548.4);
  await clock.locator('summary').click();
  await clock.locator('input').fill('2026-01-05T09:00');
  await clock.getByRole('button', { name: 'Apply time' }).click();
  await expect(history).toContainText('2 @ $225.80 · MARKET · Filled');
  expect(
    api.requests.filter((r) => r.method === 'POST' && r.url.endsWith('/api/orders')),
  ).toHaveLength(1);
  await page.getByRole('link', { name: 'Back to dashboard' }).click();
  await expect(page.getByTestId('account-dropdown').locator('summary')).toContainText('Retirement');
  await expect(page).toHaveURL(/\/dashboard$/);
  expect(visited.length).toBeGreaterThan(3);
  expect(visited.filter((url) => /accountId/i.test(url))).toEqual([]);
});

test('opens an old link that named an account without the account in the URL', async ({
  page,
  loginPage,
}) => {
  await loginPage.goto();
  await loginPage.signIn(USER.email, USER.password);
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto('/dashboard/markets/aapl?accountId=2&compare=msft');

  await expect(page).toHaveURL(/\/dashboard\/markets\/aapl\?compare=msft$/);
  await expect(page.getByRole('heading', { name: 'AAPL', exact: true })).toBeVisible();
});

test('creates and renames accounts from the reused market dropdown', async ({
  page,
  loginPage,
}) => {
  await openMarketPage(page, loginPage);
  const account = page.getByTestId('account-dropdown');
  await account.locator('summary').click();
  await page.getByRole('menuitem', { name: 'New account', exact: true }).click();
  const create = page.getByRole('dialog', { name: 'New account', exact: true });
  await create.getByLabel('Account name', { exact: true }).fill('Market trades');
  await create.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(create).not.toBeVisible();
  await expect(account.locator('summary')).toContainText('Market trades');
  await account.locator('summary').click();
  await page.getByRole('menuitem', { name: 'Settings for Market trades', exact: true }).click();
  const rename = page.getByRole('dialog', { name: 'Rename account', exact: true });
  await rename.getByLabel('Account name', { exact: true }).fill('Market savings');
  await rename.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(rename).not.toBeVisible();
  await expect(account.locator('summary')).toContainText('Market savings');
  await page.reload();
  await expect(account.locator('summary')).toContainText('Market savings');
});

test('keeps comparison headers and chart controls separate at every layout', async ({
  page,
  loginPage,
}) => {
  await page.route('**/api/market/candles?**', async (route) => {
    const symbol = new URL(route.request().url()).searchParams.get('symbol');
    await route.fulfill({
      json: {
        sessionId: 1,
        symbol,
        timeframe: '1D',
        marketTimestamp: '2026-01-05T15:01:00Z',
        points: Array.from({ length: 120 }, (_, i) => ({
          timestamp: new Date(Date.UTC(2026, 0, 5, 14, 59, i)).toISOString(),
          open: 224 + i / 100,
          high: 226 + i / 100,
          low: 223 + i / 100,
          close: 225 + i / 100,
          volume: 10,
        })),
      },
    });
  });
  await openMarketPage(page, loginPage);
  await page.getByRole('button', { name: /Compare/ }).click();
  const picker = page.getByRole('dialog', { name: 'Choose a stock to compare' });
  await picker.getByRole('combobox', { name: 'Search instruments' }).fill('MSFT');
  await picker.getByRole('option', { name: /MSFT/ }).click();
  await page.getByRole('button', { name: /Indicators/ }).click();
  for (const name of ['SMA 20', 'EMA 20', 'Bollinger Bands 20 · 2σ', 'RSI 14']) {
    await page.getByRole('menuitemcheckbox', { name, exact: true }).click();
  }
  await page.getByRole('button', { name: /Indicators/ }).click();
  await expect(page.locator('[aria-controls="indicator-picker"] span')).toHaveCSS(
    'color',
    'rgb(0, 0, 0)',
  );
  const charts = page.locator('.comparison-chart');
  await expect(charts).toHaveCount(2);
  for (const width of [1440, 901, 900, 640, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const chart of await charts.all()) {
      await chart.getByRole('button', { name: 'Pan left', exact: true }).click();
      await expect(chart.getByRole('button', { name: /Latest/ })).toBeVisible();
      const header = await chart
        .locator('.comparison-price-label-left, .comparison-price-label-right')
        .boundingBox();
      const toolbar = await chart.locator('.chart-toolbar').boundingBox();
      expect(header!.y).toBeGreaterThanOrEqual(toolbar!.y);
      expect(header!.y + header!.height).toBeLessThanOrEqual(toolbar!.y + toolbar!.height + 1);
      const controls = await chart.locator('.chart-control-bar').boundingBox();
      const tags = await chart.locator('.chart-top-right').boundingBox();
      expect(
        controls!.x + controls!.width <= tags!.x + 1 ||
          controls!.y + controls!.height <= tags!.y + 1,
      ).toBe(true);
      const latest = await chart.getByRole('button', { name: /Latest/ }).boundingBox();
      await expect(chart.locator('.chart-indicator-key')).toHaveCount(0);
      await expect(chart.locator('.chart-indicator-sma')).toBeVisible();
      expect(
        header!.x + header!.width <= controls!.x + 1 ||
          header!.y + header!.height <= controls!.y + 1,
      ).toBe(true);
      expect(latest!.x + latest!.width).toBeLessThanOrEqual(toolbar!.x + toolbar!.width + 1);
    }
    await charts
      .nth(0)
      .getByRole('button', { name: /Latest/ })
      .click();
    await expect(charts.nth(0).getByRole('button', { name: /Latest/ })).toHaveCount(0);
    await expect(charts.nth(1).getByRole('button', { name: /Latest/ })).toBeVisible();
    await charts
      .nth(1)
      .getByRole('button', { name: /Latest/ })
      .click();
  }
  await page.getByRole('button', { name: /Indicators/ }).click();
  for (const name of ['SMA 20', 'EMA 20', 'Bollinger Bands 20 · 2σ', 'RSI 14']) {
    await page.getByRole('menuitemcheckbox', { name, exact: true }).click();
  }
  await page.getByRole('button', { name: /Indicators/ }).click();
  for (const chart of await charts.all()) {
    await chart.getByRole('button', { name: 'Pan left', exact: true }).click();
    await expect(chart.locator('.chart-indicator-key')).toHaveCount(0);
    await expect(
      chart.locator('.chart-top-right').getByRole('button', { name: /Latest/ }),
    ).toBeVisible();
  }
});
