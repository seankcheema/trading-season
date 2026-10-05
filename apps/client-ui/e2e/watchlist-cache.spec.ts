import { newAccount } from './fixtures/accounts';
import { expect, test } from './fixtures/test';

const USER = newAccount();
test.use({
  stubOptions: {
    accounts: [
      {
        email: USER.email,
        password: USER.password,
        hasProfile: true,
        tradingAccounts: [{ name: 'Investing' }],
      },
    ],
  },
});

test('saves stars across popup, fullscreen, navigation, and reload without duplicate candles', async ({
  page,
  loginPage,
  api,
}) => {
  await loginPage.goto();
  await loginPage.signIn(USER.email, USER.password);
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('region', { name: 'Watch List' })).toContainText('click its star');
  await page.getByRole('combobox', { name: 'Search instruments' }).fill('AAPL');
  await page.getByRole('option', { name: /AAPL/ }).click();
  const dialog = page.getByRole('dialog', { name: 'New Order' });
  await expect(dialog.locator('app-price-chart svg').first()).toBeVisible();
  await dialog.getByRole('button', { name: 'Add AAPL to watchlist' }).click();
  await expect(dialog.getByRole('button', { name: 'Remove AAPL from watchlist' })).toBeEnabled();
  await dialog.getByRole('link', { name: 'Open full screen market chart' }).click();
  await expect(page).toHaveURL(/\/dashboard\/markets\/aapl/);
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Remove AAPL from watchlist' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('app-price-chart svg').first()).toBeVisible();
  expect(
    api.requests.filter(
      (request) => request.url.includes('/market/candles') && request.url.includes('symbol=AAPL'),
    ),
  ).toHaveLength(1);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Remove AAPL from watchlist' })).toBeEnabled();
  await page.getByRole('button', { name: 'Remove AAPL from watchlist' }).click();
  await expect(page.getByRole('button', { name: 'Add AAPL to watchlist' })).toBeEnabled();
  await page.goto('/dashboard');
  await expect(page.getByRole('region', { name: 'Watch List' })).toContainText('click its star');
});

test('keeps popup and fullscreen charts visible while an uncached timeframe loads', async ({
  page,
  loginPage,
}) => {
  await loginPage.goto();
  await loginPage.signIn(USER.email, USER.password);
  await page.getByRole('combobox', { name: 'Search instruments' }).fill('AAPL');
  await page.getByRole('option', { name: /AAPL/ }).click();
  const dialog = page.getByRole('dialog', { name: 'New Order' });
  await expect(dialog.locator('app-price-chart svg').first()).toBeVisible();
  let release!: () => void;
  let started!: () => void;
  let pending = new Promise<void>((resolve) => (release = resolve));
  let received = new Promise<void>((resolve) => (started = resolve));
  await page.route('**/api/market/candles?**', async (route) => {
    started();
    await pending;
    await route.fallback();
  });
  await dialog.getByRole('button', { name: '5D', exact: true }).click();
  await received;
  await expect(dialog.locator('app-price-chart svg').first()).toBeVisible();
  await expect(dialog.getByRole('status')).toContainText('Updating chart');
  release();
  await expect(dialog.getByText('Updating chart…')).toHaveCount(0);
  await dialog.getByRole('link', { name: 'Open full screen market chart' }).click();
  await expect(page).toHaveURL(/\/dashboard\/markets\/aapl/);
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('app-price-chart svg').first()).toBeVisible();
  pending = new Promise<void>((resolve) => (release = resolve));
  received = new Promise<void>((resolve) => (started = resolve));
  await page.getByRole('button', { name: '1M', exact: true }).click();
  await received;
  await expect(page.locator('app-price-chart svg').first()).toBeVisible();
  await expect(page.getByText('Updating chart…')).toBeVisible();
  release();
  await expect(page.getByText('Updating chart…')).toHaveCount(0);
});
