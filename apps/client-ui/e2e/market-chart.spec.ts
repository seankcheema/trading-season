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
  await expect(page).toHaveURL(/\/dashboard\/markets\/aapl\?accountId=\d+$/);
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
  await expect(page.getByTestId('market-recent-orders')).toContainText('3 shares · Filled');
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
    expect(accountBounds!.y).toBeGreaterThanOrEqual(bounds!.y + bounds!.height);
    expect(ticketBounds!.y).toBeGreaterThanOrEqual(accountBounds!.y + accountBounds!.height);
    expect(ticketBounds!.y + ticketBounds!.height).toBeLessThanOrEqual(viewport.height);
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

  await expect(page).toHaveURL(/\/dashboard\/markets\/aapl\?accountId=\d+&compare=msft$/);
  await expect(page.getByRole('region', { name: 'AAPL price chart' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'MSFT price chart' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remove comparison', exact: true })).toBeVisible();
});

test('keeps account selection and rewinds executions with the shared clock', async ({
  page,
  loginPage,
  api,
}) => {
  await loginPage.goto();
  await loginPage.signIn(USER.email, USER.password);
  await page.getByTestId('account-dropdown').locator('summary').click();
  await page.getByRole('menuitemradio', { name: /Retirement/ }).click();
  await page.getByRole('combobox', { name: 'Search instruments' }).fill('AAPL');
  await page.getByRole('option', { name: /AAPL/ }).first().click();
  await page.getByRole('link', { name: 'Open full screen market chart' }).click();
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
  await expect(history).toContainText('2 shares · Filled');
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
  await expect(history).toContainText('2 shares · Filled');
  expect(
    api.requests.filter((r) => r.method === 'POST' && r.url.endsWith('/api/orders')),
  ).toHaveLength(1);
  await page.getByRole('link', { name: 'Back to dashboard' }).click();
  await expect(page.getByTestId('account-dropdown').locator('summary')).toContainText('Retirement');
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
  await page.getByRole('menuitem', { name: 'Rename Market trades', exact: true }).click();
  const rename = page.getByRole('dialog', { name: 'Rename account', exact: true });
  await rename.getByLabel('Account name', { exact: true }).fill('Market savings');
  await rename.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(rename).not.toBeVisible();
  await expect(account.locator('summary')).toContainText('Market savings');
  await page.reload();
  await expect(account.locator('summary')).toContainText('Market savings');
});
