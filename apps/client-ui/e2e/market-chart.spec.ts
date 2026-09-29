import type { Page } from '@playwright/test';
import { newAccount } from './fixtures/accounts';
import type { LoginPage } from './fixtures/pages';
import { expect, test } from './fixtures/test';

const USER = newAccount();

test.use({
  stubOptions: {
    accounts: [{ email: USER.email, password: USER.password, hasProfile: true }],
  },
});

async function openMarketPage(page: Page, loginPage: LoginPage): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginPage.goto();
  await loginPage.signIn(USER.email, USER.password);
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole('button', { name: /AAPL/ }).first().click();
  const dialog = page.getByRole('dialog', { name: 'New Order' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('link', { name: 'Open full screen market chart' })).toBeVisible();

  await dialog.getByRole('link', { name: 'Open full screen market chart' }).click();
  await expect(page).toHaveURL(/\/dashboard\/markets\/aapl$/);
  await expect(page.getByRole('heading', { name: 'AAPL', exact: true })).toBeVisible();
}

test('opens the full-screen market page and previews a trade without submitting it', async ({
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
  await expect(page.getByRole('status')).toHaveText('Demo buy preview: 3 AAPL at market price.');
  expect(
    api.requests.filter(
      (request) => request.method === 'POST' && request.url.endsWith('/api/orders'),
    ),
  ).toHaveLength(0);

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1600, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    expect(
      await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight),
    ).toBe(true);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight),
  ).toBe(true);
});

test('changes chart tools and keeps the selected comparison in the URL', async ({
  page,
  loginPage,
}) => {
  await openMarketPage(page, loginPage);

  await page.getByRole('button', { name: /Graph view: Line/ }).click();
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
