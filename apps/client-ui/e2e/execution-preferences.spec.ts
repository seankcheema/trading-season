import { expect, test } from './fixtures/test';

const credentials = { email: 'execution-trader@example.com', password: 'Trader-password1!' };
test.use({ stubOptions: { accounts: [{ ...credentials, hasProfile: true, availableFunds: 5000,
  tradingAccounts: [{ name: 'Trading', holdings: [] }] }] } });

test('saves trading protection across reloads and keeps conditional controls compact', async ({ page, loginPage }) => {
  await loginPage.goto(); await loginPage.signIn(credentials.email, credentials.password);
  await page.getByLabel('Open profile menu').click();
  await page.getByRole('menuitem', { name: 'Settings', exact: true }).click();
  const settings = page.getByRole('dialog', { name: 'Settings' });
  const buffer = settings.getByLabel('Execution buffer (%)');
  await expect(buffer).toHaveValue('1'); await buffer.fill('10.01');
  await expect(settings.getByRole('button', { name: 'Save execution buffer' })).toBeDisabled();
  await buffer.fill('2.25'); await settings.getByRole('button', { name: 'Save execution buffer' }).click();
  await expect(settings.getByText('Saved successfully')).toBeVisible();
  await page.reload();
  await page.getByLabel('Open profile menu').click();
  await page.getByRole('menuitem', { name: 'Settings', exact: true }).click();
  await expect(page.getByLabel('Execution buffer (%)')).toHaveValue('2.25');
  await page.getByRole('button', { name: 'Close settings' }).click();
  await page.getByRole('combobox', { name: 'Search instruments' }).fill('AAPL');
  await page.getByRole('option').first().click();
  const dialog = page.getByRole('dialog', { name: 'New Order' });
  const type = dialog.locator('summary[aria-label$="Order type"]');
  await expect(dialog.locator('summary[aria-label$="Order type"]')).toHaveText('Market');
  await expect(dialog.getByText('% buffer', { exact: false })).toHaveCount(0);
  await type.click(); await dialog.getByRole('menuitemradio', { name: 'Limit', exact: true }).click(); await expect(dialog.getByLabel('Limit price', { exact: true })).toBeVisible();
  await expect(dialog.getByLabel('Stop price', { exact: true })).toHaveCount(0);
  await type.click(); await dialog.getByRole('menuitemradio', { name: 'Stop-Limit', exact: true }).click(); await expect(dialog.getByLabel('Stop price', { exact: true })).toBeVisible();
  const width = await dialog.evaluate((element) => element.getBoundingClientRect().width);
  expect(width).toBeLessThanOrEqual(896);
  await dialog.getByRole('link', { name: 'Open full screen market chart' }).click();
  const ticket = page.getByRole('region', { name: 'Order execution' });
  await ticket.locator('summary[aria-label$="Order type"]').click();
  await ticket.getByRole('menuitemradio', { name: 'Stop', exact: true }).click();
  await expect(ticket.getByLabel('Stop price', { exact: true })).toBeVisible();
  await expect(ticket.getByLabel('Limit price', { exact: true })).toHaveCount(0);
});

test('keeps a limit order open, reserves cash and releases it on cancellation', async ({ page, loginPage }) => {
  await loginPage.goto(); await loginPage.signIn(credentials.email, credentials.password);
  await page.getByRole('combobox', { name: 'Search instruments' }).fill('AAPL'); await page.getByRole('option').first().click();
  const dialog = page.getByRole('dialog', { name: 'New Order' });
  await dialog.locator('summary[aria-label$="Order type"]').click();
  await dialog.getByRole('menuitemradio', { name: 'Limit', exact: true }).click();
  await dialog.getByLabel('Limit price', { exact: true }).fill('1'); await dialog.locator('#order-shares').fill('2');
  const response = page.waitForResponse((r) => r.url().endsWith('/api/orders') && r.request().method() === 'POST');
  await dialog.getByRole('button', { name: 'Buy 2 AAPL', exact: true }).click();
  const order = await (await response).json(); expect(order.status).toBe('ACCEPTED'); expect(order.reservedCash).toBe(2);
  await expect(page.locator('hlm-toaster .toast')).toContainText('Limit buy order placed for 2 AAPL.');
  await dialog.getByRole('button', { name: 'Close order submission' }).click();
  const cancelled = page.waitForResponse((r) => r.url().endsWith(`/api/orders/${order.orderId}/cancel`));
  await page.locator('summary[aria-label="Order actions"]').first().click();
  await page.getByRole('menuitem', { name: 'Cancel order', exact: true }).first().click();
  const confirmation = page.getByRole('dialog', { name: 'Cancel this order?' });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole('button', { name: 'Confirm cancellation' }).click();
  expect((await (await cancelled).json()).reservedCash).toBe(0);
  await expect(page.getByText('Cancelled', { exact: true }).first()).toBeVisible();
});


test('keeps the modal and submit button stationary while preferences load', async ({ page, loginPage }) => {
  await loginPage.goto(); await loginPage.signIn(credentials.email, credentials.password);
  let release!: () => void;
  const ready = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/api/users/me/execution-settings', async (route) => {
    await ready;
    await route.fallback();
  });
  try {
    await page.getByRole('combobox', { name: 'Search instruments' }).fill('AAPL');
    await page.getByRole('option').first().click();
    const dialog = page.getByRole('dialog', { name: 'New Order' });
    const submit = dialog.getByRole('button', { name: /^Buy \d+ AAPL$/ });
    await expect(dialog.getByText('Loading execution preference')).toBeAttached();
    const before = await dialog.boundingBox();
    const buttonBefore = await submit.boundingBox();
    release();
    await expect(submit).toBeEnabled();
    const after = await dialog.boundingBox();
    const buttonAfter = await submit.boundingBox();
    expect(Math.abs(after!.height - before!.height)).toBeLessThan(1);
    expect(Math.abs(after!.y - before!.y)).toBeLessThan(1);
    expect(Math.abs(buttonAfter!.y - buttonBefore!.y)).toBeLessThan(1);
    expect(Math.abs(buttonAfter!.height - buttonBefore!.height)).toBeLessThan(1);
  } finally {
    release();
  }
});
