import { newAccount } from './fixtures/accounts';
import type { SeedAccount } from './fixtures/api-stub';
import { expect, test } from './fixtures/test';

const USER = newAccount();

// Thirty-five orders a minute apart, all before the stubbed market clock (2026-01-05T15:00:00Z).
const SEED: SeedAccount = {
  email: USER.email,
  password: USER.password,
  hasProfile: true,
  availableFunds: 5000,
  tradingAccounts: [
    { name: 'Trading', holdings: [{ symbol: 'AAPL', quantity: 2, averageCost: 200 }] },
  ],
  orders: Array.from({ length: 35 }, (_, index) => ({
    orderId: index + 1,
    instrumentId: 7,
    status: 'FILLED' as const,
    orderType: 'BUY' as const,
    quantity: 1,
    indicativePrice: 200,
    rejectionReason: null,
    submittedAt: new Date(Date.UTC(2026, 0, 5, 13, index)).toISOString(),
    resolvedAt: new Date(Date.UTC(2026, 0, 5, 13, index, 1)).toISOString(),
  })),
};

test.use({ stubOptions: { accounts: [SEED] } });

test.beforeEach(async ({ page, loginPage }) => {
  await loginPage.goto();
  await loginPage.signIn(USER.email, USER.password);
  await expect(page).toHaveURL(/\/dashboard$/);
});

test('a page taller than the box shows a scrollbar and keeps the columns aligned', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.getByTestId('open-transactions').click();
  const dialog = page.getByRole('dialog', { name: 'Recent Transactions' });
  await expect(dialog.getByTestId('transactions-row')).toHaveCount(15);

  const list = dialog.getByTestId('transactions-table').locator('ul');
  const scroll = await list.evaluate((el) => ({
    scrolls: el.scrollHeight > el.clientHeight,
    // The scrollbar's gutter takes width from the list, so the rows are narrower than the box.
    scrollbar: (el as HTMLElement).offsetWidth - el.clientWidth,
  }));
  expect(scroll.scrolls).toBe(true);
  expect(scroll.scrollbar).toBeGreaterThan(0);

  const right = async (locator: ReturnType<typeof dialog.locator>) => {
    const box = (await locator.boundingBox())!;
    return box.x + box.width;
  };
  const valueHeader = await right(dialog.getByRole('button', { name: 'Sort by Value' }));
  const valueCell = await right(dialog.getByTestId('transaction-amount').first());
  expect(Math.abs(valueHeader - valueCell)).toBeLessThan(1);
});

test('the transactions table shows fifteen rows a page and pages through the rest', async ({
  page,
}) => {
  await page.getByTestId('open-transactions').click();
  const dialog = page.getByRole('dialog', { name: 'Recent Transactions' });
  const rows = dialog.getByTestId('transactions-row');
  await expect(rows).toHaveCount(15);
  await expect(dialog.getByTestId('transactions-page')).toHaveText('Page 1 of 3');
  await expect(dialog.getByTestId('transactions-count')).toHaveText('1–15 of 35 transactions');
  await expect(dialog.getByTestId('transactions-prev')).toBeDisabled();
  const layoutHeight = () => dialog.evaluate((el) => (el as HTMLElement).offsetHeight);
  const fullHeight = await layoutHeight();

  await dialog.getByTestId('transactions-next').click();
  await expect(dialog.getByTestId('transactions-page')).toHaveText('Page 2 of 3');
  await expect(dialog.getByTestId('transactions-count')).toHaveText('16–30 of 35 transactions');
  await expect(rows).toHaveCount(15);

  await dialog.getByTestId('transactions-next').click();
  await expect(dialog.getByTestId('transactions-page')).toHaveText('Page 3 of 3');
  await expect(dialog.getByTestId('transactions-count')).toHaveText('31–35 of 35 transactions');
  await expect(rows).toHaveCount(5);
  // The box keeps its size on a short last page, and with nothing listed at all.
  expect(await layoutHeight()).toBe(fullHeight);
  await expect(dialog.getByTestId('transactions-next')).toBeDisabled();

  // A new filter starts again from the first page.
  await dialog.getByTestId('transactions-from').fill('2026-01-01');
  await expect(dialog.getByTestId('transactions-page')).toHaveText('Page 1 of 3');
  await dialog.getByTestId('transactions-to').fill('2026-01-02');
  await expect(rows).toHaveCount(0);
  await expect(dialog.getByTestId('transactions-page')).toHaveCount(0);
  expect(await layoutHeight()).toBe(fullHeight);
});
