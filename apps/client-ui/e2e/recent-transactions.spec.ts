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

test('recent transactions label every row by type, show its status, and sign only cash', async ({
  dashboardPage,
}) => {
  await expect(dashboardPage.accountMenu).not.toContainText('Loading accounts');
  await expect(await dashboardPage.moveCash('Deposit', '100')).toBeHidden();
  await expect(await dashboardPage.moveCash('Withdraw', '25')).toBeHidden();

  const rows = dashboardPage.recentTransactions.locator('li[data-kind]');
  await expect(rows).toHaveCount(5);
  await expect
    .poll(() => rows.evaluateAll((items) => items.map((item) => item.getAttribute('data-status'))))
    .toEqual(['COMPLETED', 'COMPLETED', 'PENDING', 'REJECTED', 'FILLED']);

  const tag = (row: number) => rows.nth(row).getByTestId('activity-tag');
  const status = (row: number) => rows.nth(row).getByTestId('activity-status');
  const value = (row: number) => rows.nth(row).getByTestId('activity-value');
  await expect(tag(0)).toHaveText('withdrawal');
  await expect(tag(1)).toHaveText('deposit');
  await expect(tag(2)).toHaveText('buy');
  await expect(tag(3)).toHaveText('sell');
  await expect(tag(4)).toHaveText('buy');
  await expect(tag(0)).toHaveClass(/text-amber-400/);
  await expect(tag(1)).toHaveClass(/text-primary/);
  await expect(tag(2)).toHaveCSS('color', GAIN);
  await expect(tag(3)).toHaveCSS('color', LOSS);
  await expect(tag(4)).toHaveCSS('color', GAIN);

  await expect(status(0)).toHaveText('Cash Transaction');
  await expect(status(2)).toHaveText('Pending');
  await expect(status(3)).toHaveText('Rejected');
  await expect(status(4)).toHaveText('Filled');

  // Only cash carries a +/- sign, and no amount is colored.
  await expect(value(0)).toHaveText('-$25.00');
  await expect(value(1)).toHaveText('+$100.00');
  await expect(value(2)).toHaveText('$400.00');
  await expect(value(3)).toHaveText('$10,000.00');
  await expect(value(4)).toHaveText('$400.00');
  for (let row = 0; row < 5; row++) {
    await expect(value(row)).not.toHaveCSS('color', GAIN);
    await expect(value(row)).not.toHaveCSS('color', LOSS);
  }
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
  await expect(rows.first()).toHaveAttribute('data-status', 'COMPLETED');

  await dialog.getByTestId('transactions-filter-deposit').click();
  await expect(rows).toHaveCount(1);
  await dialog.getByTestId('transactions-filter-withdrawal').click();
  await expect(rows).toHaveCount(0);
  await dialog.getByTestId('transactions-filter-sell').click();
  await expect(rows).toHaveCount(1);
  await dialog.getByTestId('transactions-filter-buy').click();
  await expect(rows).toHaveCount(2);
  await dialog.getByTestId('transactions-filter-all').click();
  await expect(rows).toHaveCount(4);

  // Sorting by value puts the largest first, and a second click reverses it.
  await dialog.getByRole('button', { name: 'Sort by Value' }).click();
  await expect(rows.first()).toContainText('$10,000.00');
  await dialog.getByRole('button', { name: 'Sort by Value' }).click();
  // The smallest value is the $100 deposit; the $400 trades sit above it.
  await expect(rows.first()).toContainText('+$100.00');

  await dialog.getByRole('button', { name: 'Close recent transactions' }).click();
  await expect(dialog).toBeHidden();
});

test('a pending order updates to filled by itself, with the balances it moved', async ({
  page,
  dashboardPage,
  api,
}) => {
  const pendingRow = dashboardPage.recentTransactions.locator('li[data-status="PENDING"]');
  await expect(pendingRow).toContainText('MSFT');
  await expect(dashboardPage.cash).toHaveText('Cash $5,000.00');

  // The backend settles the order; the page is never told.
  api.resolveOrder(USER.email, 2, { status: 'FILLED' });

  await expect(dashboardPage.recentTransactions.locator('li[data-status="PENDING"]')).toHaveCount(
    0,
    { timeout: POLL_TIMEOUT },
  );
  await expect(dashboardPage.recentTransactions.locator('li[data-status="FILLED"]')).toHaveCount(2);
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
  await expect(dashboardPage.recentTransactions.locator('li[data-status="PENDING"]')).toBeVisible();
  api.resolveOrder(USER.email, 2, { status: 'REJECTED', rejectionReason: 'Insufficient funds' });

  const rejected = dashboardPage.recentTransactions.locator('li[data-status="REJECTED"]');
  await expect(rejected).toHaveCount(2, { timeout: POLL_TIMEOUT });
  await expect(dashboardPage.recentTransactions).toContainText('Insufficient funds');
  await expect(dashboardPage.cash).toHaveText('Cash $5,000.00');
  await expect(page.getByTestId('open-order-history')).toHaveCount(0);
});

test('the assets and recent transactions tables leave room below their last row', async ({
  dashboardPage,
}) => {
  await expect(dashboardPage.recentTransactions).toHaveCSS('padding-bottom', '32px');
  await expect(dashboardPage.assets.locator('xpath=..')).toHaveCSS('padding-bottom', '16px');
});
