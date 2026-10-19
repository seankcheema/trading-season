import { newAccount } from './fixtures/accounts';
import { expect, test } from './fixtures/test';

const USER = newAccount();

test.use({
  tourDone: false,
  stubOptions: {
    accounts: [
      {
        email: USER.email,
        password: USER.password,
        hasProfile: true,
        tradingAccounts: [{ name: 'Brokerage' }],
      },
    ],
  },
});

test.describe('the first-run dashboard tour', () => {
  test.beforeEach(async ({ loginPage }) => {
    await loginPage.goto();
    await loginPage.signIn(USER.email, USER.password);
    await expect(loginPage.page).toHaveURL(/\/dashboard$/);
  });

  test('walks a new user to the stock search, then stays closed', async ({ page }) => {
    const tour = page.getByRole('dialog', { name: 'Welcome to TradingSeason' });
    await expect(tour).toBeVisible();
    await expect(page.getByTestId('dashboard-content')).toHaveAttribute('inert', '');

    await tour.getByRole('button', { name: 'Start tour' }).click();
    await expect(
      page.getByRole('dialog', { name: 'Every trade starts with a search' }),
    ).toBeVisible();
    await expect(page.getByTestId('tour-spotlight')).toBeVisible();

    for (let step = 2; step <= 6; step++) {
      await page.keyboard.press('ArrowRight');
    }
    await page.getByRole('button', { name: 'Find a stock' }).click();

    await expect(page.getByTestId('dashboard-tour')).toHaveCount(0);
    await expect(page.getByRole('combobox').first()).toBeFocused();

    await page.reload();
    await expect(page.getByTestId('net-worth')).toBeVisible();
    await expect(page.getByTestId('dashboard-tour')).toHaveCount(0);
  });

  test('can be skipped and taken again from the profile menu', async ({ page }) => {
    await page.getByRole('button', { name: 'Skip' }).click();
    await expect(page.getByTestId('dashboard-tour')).toHaveCount(0);

    await page.getByLabel('Open profile menu').click();
    await page.getByRole('menuitem', { name: 'Take the tour' }).click();

    await expect(page.getByRole('dialog', { name: 'Welcome to TradingSeason' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('dashboard-tour')).toHaveCount(0);
  });
});
