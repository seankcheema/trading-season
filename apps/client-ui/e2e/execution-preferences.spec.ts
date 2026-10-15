import { expect, test } from './fixtures/test';

const credentials = { email: 'execution-trader@example.com', password: 'Trader-password1!' };
test.use({ stubOptions: { accounts: [{ ...credentials, hasProfile: true, availableFunds: 5000,
  tradingAccounts: [{ name: 'Trading', holdings: [] }] }] } });

test('saves trading protection across reloads and keeps conditional controls compact', async ({ page, loginPage }) => {
  await loginPage.goto(); await loginPage.signIn(credentials.email, credentials.password);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const settings = page.getByRole('dialog', { name: 'Settings' });
  const buffer = settings.getByLabel('Execution buffer (%)');
  await expect(buffer).toHaveValue('1'); await buffer.fill('10.01');
  await expect(settings.getByRole('button', { name: 'Save execution buffer' })).toBeDisabled();
  await buffer.fill('2.25'); await settings.getByRole('button', { name: 'Save execution buffer' }).click();
  await expect(settings.getByText('Saved successfully')).toBeVisible();
  await page.reload(); await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByLabel('Execution buffer (%)')).toHaveValue('2.25');
  await page.getByRole('button', { name: 'Close settings' }).click();
  await page.getByRole('combobox', { name: 'Search instruments' }).fill('AAPL');
  await page.getByRole('option').first().click();
  const dialog = page.getByRole('dialog', { name: 'New Order' });
  const type = dialog.getByRole('button', { name: 'Order type', exact: true });
  await expect(dialog.locator('summary[aria-label="Order type"]')).toHaveText('Market');
  await expect(dialog.getByText('% buffer', { exact: false })).toHaveCount(0);
  await type.click(); await dialog.getByRole('menuitemradio', { name: 'Limit', exact: true }).click(); await expect(dialog.getByLabel('Limit price', { exact: true })).toBeVisible();
  await expect(dialog.getByLabel('Stop price', { exact: true })).toHaveCount(0);
  await type.click(); await dialog.getByRole('menuitemradio', { name: 'Stop-Limit', exact: true }).click(); await expect(dialog.getByLabel('Stop price', { exact: true })).toBeVisible();
  const width = await dialog.evaluate((element) => element.getBoundingClientRect().width);
  expect(width).toBeLessThanOrEqual(896);
  await dialog.getByRole('link', { name: 'Open full screen market chart' }).click();
  const ticket = page.getByRole('region', { name: 'Order execution' });
  await ticket.getByRole('button', { name: 'Order type', exact: true }).click();
  await ticket.getByRole('menuitemradio', { name: 'Stop', exact: true }).click();
  await expect(ticket.getByLabel('Stop price', { exact: true })).toBeVisible();
  await expect(ticket.getByLabel('Limit price', { exact: true })).toHaveCount(0);
});

test('keeps a limit order open, reserves cash and releases it on cancellation', async ({ page, loginPage }) => {
  await loginPage.goto(); await loginPage.signIn(credentials.email, credentials.password);
  await page.getByRole('combobox', { name: 'Search instruments' }).fill('AAPL'); await page.getByRole('option').first().click();
  const dialog = page.getByRole('dialog', { name: 'New Order' });
  await dialog.getByRole('button', { name: 'Order type', exact: true }).click();
  await dialog.getByRole('menuitemradio', { name: 'Limit', exact: true }).click();
  await dialog.getByLabel('Limit price', { exact: true }).fill('1'); await dialog.locator('#order-shares').fill('2');
  const response = page.waitForResponse((r) => r.url().endsWith('/api/orders') && r.request().method() === 'POST');
  await dialog.getByRole('button', { name: 'Buy 2 AAPL', exact: true }).click();
  const order = await (await response).json(); expect(order.status).toBe('ACCEPTED'); expect(order.reservedCash).toBe(2);
  await expect(dialog.getByText('Order open.', { exact: false })).toBeVisible();
  await dialog.getByRole('button', { name: 'Close order submission' }).click();
  const cancelled = page.waitForResponse((r) => r.url().endsWith(`/api/orders/${order.orderId}/cancel`));
  await page.getByRole('button', { name: 'Cancel order', exact: true }).first().click();
  expect((await (await cancelled).json()).reservedCash).toBe(0);
  await expect(page.getByText('Cancelled', { exact: true }).first()).toBeVisible();
});
