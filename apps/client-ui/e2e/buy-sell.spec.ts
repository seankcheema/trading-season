import { expect, test } from './fixtures/test';

const credentials = { email: 'ledger-trader@example.com', password: 'Trader-password1!' };
test.use({ stubOptions: { accounts: [{ ...credentials, hasProfile: true,
  availableFunds: 5000, tradingAccounts: [{ name: 'Trading', holdings: [] }] }] } });

// This exercises the real UI against the API stand-in; Java tests prove ledger persistence.
test('buy and sell submit replay time and refresh the account', async ({ page, loginPage, api }) => {
  await loginPage.goto();
  await loginPage.signIn(credentials.email, credentials.password);
  await expect(page).toHaveURL(/dashboard$/);
  await page.getByRole('combobox', { name: 'Search instruments' }).fill('AAPL');
  await page.getByRole('option').first().click();
  const dialog = page.getByRole('dialog', { name: 'New Order' });
  await dialog.locator('#order-shares').fill('2');
  const buyResponse = page.waitForResponse(r => r.url().endsWith('/api/orders') && r.request().method() === 'POST');
  await dialog.getByRole('button', { name: 'Buy 2 AAPL', exact: true }).click();
  const buy = await (await buyResponse).json();
  const cashBefore = dialog.locator('dt').filter({ hasText: /^Cash before$/ }).locator('..').locator('dd');
  expect(buy.status).toBe('FILLED');
  expect(buy.simulatedAt).toBeTruthy();
  await expect.poll(() => api.fundsOf(credentials.email)).toBeCloseTo(5000 - 2 * buy.indicativePrice);
  await expect(cashBefore).toHaveText(new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(5000 - 2 * buy.indicativePrice));
  await expect(dialog.getByRole('button', { name: 'Buy 2 AAPL', exact: true })).toBeEnabled();
  await dialog.getByRole('button', { name: 'sell', exact: true }).click();
  await dialog.locator('#order-shares').fill('2');
  const sellResponse = page.waitForResponse(r => r.url().endsWith('/api/orders') && r.request().method() === 'POST');
  await dialog.getByRole('button', { name: 'Sell 2 AAPL', exact: true }).click();
  const sell = await (await sellResponse).json();
  expect(sell.status).toBe('FILLED');
  const submitted = api.requestsContaining('/api/orders').filter(
    r => r.method === 'POST' && new URL(r.url).pathname === '/api/orders',
  );
  expect(submitted).toHaveLength(2);
  expect(JSON.parse(submitted[0].body!).clientReference).not.toBe(JSON.parse(submitted[1].body!).clientReference);
  await expect.poll(() => api.fundsOf(credentials.email)).toBeCloseTo(5000);
  await expect.poll(() => api.holdingsOf(buy.accountId)).toEqual([]);
  await expect(cashBefore).toHaveText('$5,000.00');
  await expect(dialog.getByRole('button', { name: /^Sell \d+ AAPL$/ })).toBeDisabled();
  await expect(dialog.getByText('No shares held', { exact: true })).toBeVisible();
  await expect(page.locator('hlm-toaster .toast')).toContainText('Filled 2 AAPL');
});
