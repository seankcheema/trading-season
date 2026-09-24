import { newAccount } from './fixtures/accounts';
import { expect, test } from './fixtures/test';

const USER = newAccount();

test.use({
  stubOptions: {
    accounts: [{ email: USER.email, password: USER.password, hasProfile: true }],
  },
});

test('opens the original instrument popup and navigates its full-screen chart', async ({
  page,
  loginPage,
}) => {
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
  await expect(page.getByText('Apple Inc.')).toBeVisible();
  await expect(page.getByText('Trading coming soon')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Buy AAPL', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Sell AAPL', exact: true })).toBeDisabled();

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
