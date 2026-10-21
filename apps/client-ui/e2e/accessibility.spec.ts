import { newAccount } from './fixtures/accounts';
import { expectNoAccessibilityViolations } from './fixtures/axe';
import { expect, test } from './fixtures/test';

// Scans each screen and dialog with axe-core in both themes. It catches the mistakes a scanner
// can: missing names and labels, bad ARIA, landmarks and headings, touch targets under 24px,
// and focusable content hidden from assistive technology. It does not replace a pass with a
// screen reader and in Windows high contrast; see the README's Accessibility section.

const USER = newAccount();

test.use({
  stubOptions: {
    accounts: [
      {
        email: USER.email,
        password: USER.password,
        hasProfile: true,
        availableFunds: 5000,
        tradingAccounts: [
          { name: 'Brokerage', holdings: [{ symbol: 'IBM', quantity: 3, averageCost: 200 }] },
        ],
      },
    ],
  },
});

for (const theme of ['dark', 'light'] as const) {
  test.describe(`${theme} theme`, () => {
    test.beforeEach(async ({ page }) => {
      // Without motion a dialog is fully opaque the moment it is visible; a scan taken mid-fade
      // would measure its contrast at half strength.
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.addInitScript(
        (value) => localStorage.setItem('ts.settings.theme', value),
        theme,
      );
    });

    test('the landing, sign-in and registration pages', async ({ page }) => {
      for (const [name, path] of [
        ['landing', '/'],
        ['sign-in', '/login'],
        ['registration', '/register'],
      ]) {
        await page.goto(path);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await expectNoAccessibilityViolations(page, name);
      }
    });

    test('the sign-in and registration pages showing their errors', async ({
      page,
      loginPage,
      registerPage,
    }) => {
      await loginPage.goto();
      await page.locator('app-login:not([ngh])').waitFor();
      await loginPage.submit.click();
      await expect(page.getByText('Password is required.')).toBeVisible();
      await expectNoAccessibilityViolations(page, 'sign-in with errors');

      await registerPage.goto();
      await page.locator('app-register:not([ngh])').waitFor();
      await page.getByRole('button', { name: 'Create account' }).click();
      await expect(page.getByText('First name is required.')).toBeVisible();
      await expectNoAccessibilityViolations(page, 'registration with errors');
    });

    test('the dashboard, its menus and its dialogs', async ({
      page,
      loginPage,
      dashboardPage,
    }) => {
      await loginPage.goto();
      await loginPage.signIn(USER.email, USER.password);
      await expect(page).toHaveURL(/\/dashboard$/);
      await expect(dashboardPage.accountMenu).not.toContainText('Loading accounts');
      await expect(dashboardPage.assets.getByTestId('asset-row-IBM')).toBeVisible();
      await expectNoAccessibilityViolations(page, 'dashboard');

      await dashboardPage.accountMenuTrigger.click();
      await expectNoAccessibilityViolations(page, 'account menu');
      await dashboardPage.accountMenuTrigger.click();

      await page.getByLabel('Open profile menu').click();
      await expectNoAccessibilityViolations(page, 'profile menu');
      await page.getByRole('menuitem', { name: 'Settings' }).click();
      await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
      await expectNoAccessibilityViolations(page, 'settings dialog');
      await page.keyboard.press('Escape');

      await dashboardPage.deposit.click();
      await expect(page.getByRole('dialog', { name: 'Deposit funds' })).toBeVisible();
      await expectNoAccessibilityViolations(page, 'deposit dialog');
      await page.keyboard.press('Escape');

      await page.getByTestId('open-transactions').click();
      await expect(page.getByRole('dialog', { name: 'Recent Transactions' })).toBeVisible();
      await expectNoAccessibilityViolations(page, 'transactions dialog');
      await page.keyboard.press('Escape');

      await page.getByTestId('open-assets').click();
      await expect(page.getByRole('dialog', { name: 'Assets' })).toBeVisible();
      await expectNoAccessibilityViolations(page, 'assets dialog');
    });

    test('the market page', async ({ page, loginPage, dashboardPage }) => {
      await loginPage.goto();
      await loginPage.signIn(USER.email, USER.password);
      await expect(dashboardPage.accountMenu).not.toContainText('Loading accounts');
      await page.goto('/dashboard/markets/IBM');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expectNoAccessibilityViolations(page, 'market page');
    });
  });
}
