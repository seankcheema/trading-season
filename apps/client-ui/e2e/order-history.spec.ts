import { newAccount } from './fixtures/accounts';
import type { SeedAccount } from './fixtures/api-stub';
import { expect, test } from './fixtures/test';

const USER = newAccount();

// Every order is dated before the stubbed market clock (2026-01-05T15:00:00Z), so the
// dashboard's replay rule keeps them all in view.
const SEED: SeedAccount = {
  email: USER.email,
  password: USER.password,
  hasProfile: true,
  availableFunds: 5000,
  tradingAccounts: [
    { name: 'Trading', holdings: [{ symbol: 'AAPL', quantity: 2, averageCost: 200 }] },
  ],
  orders: [
    {
      orderId: 3,
      instrumentId: 7,
      status: 'REJECTED',
      orderType: 'SELL',
      quantity: 50,
      indicativePrice: 200,
      rejectionReason: 'Insufficient holdings',
      submittedAt: '2026-01-05T14:35:00Z',
      resolvedAt: '2026-01-05T14:35:01Z',
    },
    {
      orderId: 2,
      instrumentId: 8,
      status: 'PENDING',
      orderType: 'BUY',
      quantity: 1,
      indicativePrice: 400,
      rejectionReason: null,
      submittedAt: '2026-01-05T14:40:00Z',
      resolvedAt: null,
    },
    {
      orderId: 1,
      instrumentId: 7,
      status: 'FILLED',
      orderType: 'BUY',
      quantity: 2,
      indicativePrice: 200,
      rejectionReason: null,
      submittedAt: '2026-01-05T14:31:00Z',
      resolvedAt: '2026-01-05T14:31:01Z',
    },
  ],
};

// rgb() of the gain and loss colors in src/styles.css.
const GAIN = 'rgb(37, 235, 105)';
const LOSS = 'rgb(255, 61, 90)';

// A pending order is picked up by the next poll, which runs every five seconds.
const POLL_TIMEOUT = 15_000;

test.use({ stubOptions: { accounts: [SEED] } });

test.beforeEach(async ({ page, loginPage }) => {
  await loginPage.goto();
  await loginPage.signIn(USER.email, USER.password);
  await expect(page).toHaveURL(/\/dashboard$/);
});

test('recent transactions tag every row and color its amount by direction', async ({
  dashboardPage,
}) => {
  await expect(dashboardPage.accountMenu).not.toContainText('Loading accounts');
  await expect(await dashboardPage.moveCash('Deposit', '100')).toBeHidden();
  await expect(await dashboardPage.moveCash('Withdraw', '25')).toBeHidden();

  const rows = dashboardPage.recentTransactions.locator('li[data-kind]');
  await expect(rows).toHaveCount(5);
  await expect
    .poll(() => rows.evaluateAll((items) => items.map((item) => item.getAttribute('data-tag'))))
    .toEqual(['WITHDRAWAL', 'DEPOSIT', 'PENDING', 'REJECTED', 'FILLED']);

  const tag = (row: number) => rows.nth(row).getByTestId('activity-tag');
  const value = (row: number) => rows.nth(row).getByTestId('activity-value');
  await expect(tag(0)).toHaveText('withdrawal');
  await expect(tag(1)).toHaveText('deposit');
  await expect(tag(2)).toHaveText('pending');
  await expect(tag(3)).toHaveText('rejected');
  await expect(tag(4)).toHaveText('filled');
  await expect(tag(0)).toHaveClass(/text-primary/);
  await expect(tag(1)).toHaveClass(/text-primary/);
  await expect(tag(2)).toHaveClass(/text-amber-400/);
  await expect(tag(3)).toHaveCSS('color', LOSS);
  await expect(tag(4)).toHaveCSS('color', GAIN);

  // Money out is red: a withdrawal and a buy. Money in is green: a deposit and a sell.
  await expect(value(0)).toHaveCSS('color', LOSS);
  await expect(value(0)).toHaveText('-$25.00');
  await expect(value(1)).toHaveCSS('color', GAIN);
  await expect(value(1)).toHaveText('+$100.00');
  await expect(value(2)).toHaveCSS('color', LOSS);
  await expect(value(3)).toHaveCSS('color', GAIN);
  await expect(value(4)).toHaveCSS('color', LOSS);
  await expect(value(4)).toHaveText('-$400.00');
});

test('order history lists every past order and filters by status', async ({ page }) => {
  await page.getByTestId('open-order-history').click();
  const dialog = page.getByRole('dialog', { name: 'Order History' });
  const rows = dialog.getByTestId('order-history-row');

  await expect(rows).toHaveCount(3);
  // Newest first, each with its status and, for a rejection, the reason.
  await expect(dialog.getByTestId('order-history-status')).toHaveText([
    'pending',
    'rejected',
    'filled',
  ]);
  await expect(rows.nth(1)).toContainText('Insufficient holdings');
  await expect(rows.nth(0)).toContainText('MSFT');
  await expect(rows.nth(0)).toContainText('Trading');
  await expect(dialog.getByTestId('order-history-count')).toHaveText('3 orders');

  await dialog.getByTestId('order-history-filter-rejected').click();
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('AAPL');
  await dialog.getByTestId('order-history-filter-all').click();
  await dialog.getByLabel('Filter by symbol').fill('msft');
  await expect(rows).toHaveCount(1);

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('view all opens every transaction, including cash, and filters by type', async ({
  page,
  dashboardPage,
}) => {
  await expect(dashboardPage.accountMenu).not.toContainText('Loading accounts');
  await expect(await dashboardPage.moveCash('Deposit', '100')).toBeHidden();

  await page.getByTestId('open-transactions').click();
  const dialog = page.getByRole('dialog', { name: 'Recent Transactions' });
  const rows = dialog.getByTestId('transactions-row');
  await expect(rows).toHaveCount(4);
  await expect(rows.first()).toHaveAttribute('data-tag', 'DEPOSIT');

  await dialog.getByTestId('transactions-filter-cash').click();
  await expect(rows).toHaveCount(1);
  await dialog.getByTestId('transactions-filter-trades').click();
  await expect(rows).toHaveCount(3);

  // Sorting by value puts the largest first, and a second click reverses it.
  await dialog.getByRole('button', { name: 'Sort by Value' }).click();
  await expect(rows.first()).toContainText('$10,000.00');
  await dialog.getByRole('button', { name: 'Sort by Value' }).click();
  await expect(rows.first()).toContainText('$400.00');

  await dialog.getByRole('button', { name: 'Close recent transactions' }).click();
  await expect(dialog).toBeHidden();
});

test('a pending order updates to filled by itself, with the balances it moved', async ({
  page,
  dashboardPage,
  api,
}) => {
  const pendingRow = dashboardPage.recentTransactions.locator('li[data-tag="PENDING"]');
  await expect(pendingRow).toContainText('MSFT');
  await expect(dashboardPage.cash).toHaveText('Cash $5,000.00');

  await page.getByTestId('open-order-history').click();
  const dialog = page.getByRole('dialog', { name: 'Order History' });
  await expect(dialog.getByTestId('order-history-status').first()).toHaveText('pending');

  // The backend settles the order; the page is never told.
  api.resolveOrder(USER.email, 2, { status: 'FILLED' });

  await expect(dialog.getByTestId('order-history-status').first()).toHaveText('filled', {
    timeout: POLL_TIMEOUT,
  });
  await page.keyboard.press('Escape');
  await expect(dashboardPage.recentTransactions.locator('li[data-tag="PENDING"]')).toHaveCount(0);
  await expect(dashboardPage.recentTransactions.locator('li[data-tag="FILLED"]')).toHaveCount(2);
  // The fill moved cash and added the position without a reload.
  await expect(dashboardPage.cash).toHaveText('Cash $4,600.00');
  await expect(dashboardPage.assets.getByTestId('asset-row-MSFT')).toBeVisible();

  // With nothing pending left, the page stops reading the history.
  const reads = () =>
    api.requests.filter((r) => r.method === 'GET' && r.url.endsWith('/api/orders')).length;
  const before = reads();
  await page.waitForTimeout(6_000);
  expect(reads()).toBe(before);
});

test('a pending order that is rejected shows its reason without a reload', async ({
  page,
  dashboardPage,
  api,
}) => {
  await expect(dashboardPage.recentTransactions.locator('li[data-tag="PENDING"]')).toBeVisible();
  api.resolveOrder(USER.email, 2, { status: 'REJECTED', rejectionReason: 'Insufficient funds' });

  const rejected = dashboardPage.recentTransactions.locator('li[data-tag="REJECTED"]');
  await expect(rejected).toHaveCount(2, { timeout: POLL_TIMEOUT });
  await expect(dashboardPage.recentTransactions).toContainText('Insufficient funds');
  await expect(dashboardPage.cash).toHaveText('Cash $5,000.00');
  await expect(page.getByTestId('open-order-history')).toBeVisible();
});

test('the assets and recent transactions tables leave room below their last row', async ({
  dashboardPage,
}) => {
  await expect(dashboardPage.recentTransactions).toHaveCSS('padding-bottom', '32px');
  await expect(dashboardPage.assets.locator('xpath=..')).toHaveCSS('padding-bottom', '16px');
});
