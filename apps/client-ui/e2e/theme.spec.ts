import type { Page } from '@playwright/test';
import { newAccount } from './fixtures/accounts';
import { expect, test } from './fixtures/test';

const USER = newAccount();
const THEME_KEY = 'ts.settings.theme';

// The page background of each theme, as the browser computes --background.
const DARK_BACKGROUND = 'rgb(14, 14, 14)';
const LIGHT_BACKGROUND = 'rgb(244, 247, 249)';

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

const toggle = (page: Page) => page.getByTestId('theme-toggle');

async function expectTheme(page: Page, theme: 'dark' | 'light'): Promise<void> {
  const html = page.locator('html');
  if (theme === 'dark') {
    await expect(html).toHaveClass(/\bdark\b/);
  } else {
    await expect(html).not.toHaveClass(/\bdark\b/);
  }
  await expect(page.locator('body')).toHaveCSS(
    'background-color',
    theme === 'dark' ? DARK_BACKGROUND : LIGHT_BACKGROUND,
  );
}

test.describe('Theme', () => {
  test('starts dark, switches to light from the landing page, and keeps it after a reload', async ({
    page,
  }) => {
    await page.goto('/');
    await expectTheme(page, 'dark');
    await expect(toggle(page)).toHaveAccessibleName('Switch to light theme');

    await toggle(page).click();

    await expectTheme(page, 'light');
    await expect(toggle(page)).toHaveAccessibleName('Switch to dark theme');
    expect(await page.evaluate((key) => localStorage.getItem(key), THEME_KEY)).toBe('light');

    // The script in index.html applies the saved theme before the app starts, so the
    // first paint is already light.
    await page.reload({ waitUntil: 'domcontentloaded' });
    expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(
      false,
    );
    await expectTheme(page, 'light');
  });

  test('carries the choice to the sign-in and registration pages, which switch it too', async ({
    page,
    loginPage,
  }) => {
    await page.goto('/');
    await toggle(page).click();

    await loginPage.goto();
    await expectTheme(page, 'light');
    await page.screenshot({ path: 'reports/playwright/theme-login-light.png' });

    await page.goto('/register');
    await expectTheme(page, 'light');
    await toggle(page).click();
    await expectTheme(page, 'dark');
    expect(await page.evaluate((key) => localStorage.getItem(key), THEME_KEY)).toBe('dark');
  });

  test('switches the signed-in dashboard and the market page from their headers', async ({
    page,
    loginPage,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginPage.goto();
    await loginPage.signIn(USER.email, USER.password);
    await expect(page).toHaveURL(/\/dashboard$/);
    const header = page.getByTestId('dashboard-header-controls');

    await header.getByRole('button', { name: 'Switch to light theme' }).click();

    await expectTheme(page, 'light');
    await expect(page.getByTestId('net-worth')).toBeVisible();
    await page.screenshot({ path: 'reports/playwright/theme-dashboard-light.png' });

    await page.getByRole('combobox', { name: 'Search instruments' }).fill('AAPL');
    await page.getByRole('option', { name: /AAPL/ }).first().click();
    await page.getByRole('link', { name: 'Open full screen market chart' }).click();
    await expect(page.getByRole('heading', { name: 'AAPL', exact: true })).toBeVisible();

    await expectTheme(page, 'light');
    await expect(page.locator('.market-page')).toHaveCSS('background-color', LIGHT_BACKGROUND);
    await page.screenshot({ path: 'reports/playwright/theme-market-light.png' });

    await page.locator('.market-nav').getByRole('button', { name: 'Switch to dark theme' }).click();
    await expectTheme(page, 'dark');
    await expect(page.locator('.market-page')).toHaveCSS('background-color', DARK_BACKGROUND);
  });

  test('follows a theme chosen in another tab', async ({ page, context }) => {
    await page.goto('/');
    const other = await context.newPage();
    await other.goto('/login');
    await expectTheme(other, 'dark');

    await toggle(page).click();

    await expectTheme(other, 'light');
    await expect(toggle(other)).toHaveAccessibleName('Switch to dark theme');
  });

  test('Dua choices, insight cards and explanations follow theme changes while open', async ({
    page,
    loginPage,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginPage.goto();
    await loginPage.signIn(USER.email, USER.password);
    await page.getByRole('button', { name: 'Switch to light theme' }).click();
    await page.getByRole('button', { name: 'Dua insights', exact: true }).click();
    const panel = page.getByRole('region', { name: 'Dua insights' });
    await expect(panel).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(panel).toHaveCSS('color', 'rgb(14, 14, 14)');

    for (const choice of ['Daily Review', 'My Holdings']) {
      await panel.getByRole('button', { name: choice, exact: true }).click();
      const card = panel.locator('.insight-card:not(.inactive)');
      await expect(card.locator('.primary-metric strong')).toHaveCSS('color', 'rgb(14, 14, 14)');
      await expect(panel.locator('.dua-header')).toHaveCSS(
        'background-color',
        'rgb(255, 255, 255)',
      );
      await page.screenshot({
        path: `reports/playwright/theme-dua-${choice === 'Daily Review' ? 'daily' : 'holdings'}-light.png`,
      });
      await card.getByRole('button', { name: 'Explain these numbers' }).click();
      await expect(panel.locator('.insight-explanation')).toHaveCSS('color', 'rgb(14, 14, 14)');
      await page.screenshot({ path: 'reports/playwright/theme-dua-explanation-light.png' });
      await panel.getByRole('button', { name: 'Back to results' }).click();
      await panel.getByRole('button', { name: 'Back to choices' }).click();
    }

    await panel.getByRole('button', { name: 'Daily Review', exact: true }).click();
    await page.getByRole('button', { name: 'Switch to dark theme' }).click();
    // The theme toggle is outside Dua, so it closes the panel without resetting its choice.
    await expect(panel).toBeHidden();
    await page.getByRole('button', { name: 'Dua insights', exact: true }).click();
    await expect(panel.locator('.dua-header')).toHaveCSS('background-color', 'rgb(12, 14, 16)');
    await expect(panel.locator('.insight-card:not(.inactive) .primary-metric strong')).toHaveCSS(
      'color',
      'rgb(255, 255, 255)',
    );
    await page.screenshot({ path: 'reports/playwright/theme-dua-daily-dark.png' });
  });
});
