import type { Page } from '@playwright/test';
import { newAccount } from './fixtures/accounts';
import { scan, type Violation } from './fixtures/a11y';
import { expect, test } from './fixtures/test';

const USER = newAccount();
const FRESH = newAccount();
const THEME_KEY = 'ts.settings.theme';
const THEMES = ['dark', 'light'] as const;

test.use({
  stubOptions: {
    accounts: [
      {
        email: USER.email,
        password: USER.password,
        hasProfile: true,
        firstName: 'Jane',
        lastName: 'Doe',
        tradingAccounts: [
          {
            name: 'Investing',
            holdings: [
              { symbol: 'AAPL', quantity: 4, averageCost: 150 },
              { symbol: 'MSFT', quantity: 2, averageCost: 300 },
            ],
          },
          { name: 'Retirement' },
        ],
      },
      {
        email: FRESH.email,
        password: FRESH.password,
        hasProfile: true,
        firstName: 'Jane',
        lastName: 'Doe',
        termsAccepted: false,
        tradingAccounts: [{ name: 'Investing' }],
      },
    ],
  },
});

/** Fails with every violation listed, so one run reports the whole screen rather than the first rule. */
function expectNone(violations: Violation[]): void {
  expect
    .soft(
      violations.map((v) => `${v.screen}: ${v.rule} (${v.impact}) ${v.nodes.join(' | ')}`),
      'WCAG 2.2 AA violations',
    )
    .toEqual([]);
}

async function useTheme(page: Page, theme: (typeof THEMES)[number]): Promise<void> {
  await page.addInitScript(
    ([key, value]) => localStorage.setItem(key, value),
    [THEME_KEY, theme] as const,
  );
  // Fades and slides leave half-transparent text that reads as low contrast.
  await page.emulateMedia({ reducedMotion: 'reduce' });
}

async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.locator('app-login:not([ngh])').waitFor();
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: /^Sign in/ }).click();
  await expect(page).toHaveURL(/dashboard$/);
}

for (const theme of THEMES) {
  test.describe(`${theme} theme`, () => {
    test.beforeEach(async ({ page }) => useTheme(page, theme));

    test('signed-out screens', async ({ page }) => {
      const found: Violation[] = [];

      await page.goto('/');
      await expect(page.locator('main, [role="main"]').first()).toBeVisible();
      found.push(...(await scan(page, `${theme}/landing`)));

      await page.goto('/login');
      await page.locator('app-login:not([ngh])').waitFor();
      found.push(...(await scan(page, `${theme}/login`)));
      await page.getByRole('button', { name: /^Sign in/ }).click();
      found.push(...(await scan(page, `${theme}/login (errors shown)`)));

      await page.goto('/register');
      await page.locator('app-register:not([ngh])').waitFor();
      found.push(...(await scan(page, `${theme}/register`)));
      await page.getByRole('button', { name: /^Create account/ }).click();
      found.push(...(await scan(page, `${theme}/register (errors shown)`)));

      expectNone(found);
    });

    test('dashboard and its dialogs', async ({ page }) => {
      const found: Violation[] = [];
      await signIn(page, USER.email, USER.password);
      await expect(page.getByTestId('net-worth')).toContainText('$');
      found.push(...(await scan(page, `${theme}/dashboard`)));

      await page.getByLabel('Open profile menu').click();
      found.push(...(await scan(page, `${theme}/dashboard profile menu`)));
      await page.getByRole('menuitem', { name: 'Settings' }).click();
      await page.getByRole('dialog', { name: 'Settings' }).waitFor();
      found.push(...(await scan(page, `${theme}/settings dialog`)));
      await page.getByRole('button', { name: 'Close settings' }).click();

      await page.getByLabel('Select account').click();
      found.push(...(await scan(page, `${theme}/account menu`)));
      await page.getByTestId('account-dropdown').getByRole('menuitem', { name: 'New account' }).click();
      await page.getByRole('dialog', { name: 'New account' }).waitFor();
      found.push(...(await scan(page, `${theme}/new account dialog`)));
      await page.keyboard.press('Escape');

      await page.getByRole('button', { name: 'Deposit', exact: true }).click();
      await page.getByRole('dialog', { name: 'Deposit funds' }).waitFor();
      found.push(...(await scan(page, `${theme}/deposit dialog`)));
      await page.keyboard.press('Escape');

      for (const [trigger, dialog] of [
        ['open-assets', 'assets'],
        ['open-transactions', 'transactions'],
      ] as const) {
        await page.getByTestId(trigger).click();
        await page.getByRole('dialog').waitFor();
        found.push(...(await scan(page, `${theme}/${dialog} dialog`)));
        await page.keyboard.press('Escape');
      }

      await page.locator('.dua-launcher').click();
      await expect(page.getByRole('region', { name: 'Dua insights' })).toBeVisible();
      found.push(...(await scan(page, `${theme}/Dua panel`)));
      await page.keyboard.press('Escape');

      await page.getByRole('combobox', { name: 'Search instruments' }).fill('AAPL');
      found.push(...(await scan(page, `${theme}/search suggestions`)));
      await page.getByRole('option').first().click();
      await page.getByRole('dialog', { name: 'New Order' }).waitFor();
      found.push(...(await scan(page, `${theme}/order dialog`)));

      expectNone(found);
    });

    test('market page', async ({ page }) => {
      await signIn(page, USER.email, USER.password);
      await page.goto('/dashboard/markets/AAPL');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.getByTestId('market-skeleton')).toHaveCount(0);
      expectNone(await scan(page, `${theme}/market page`));
    });

    test('terms dialog', async ({ page }) => {
      await signIn(page, FRESH.email, FRESH.password);
      await page.getByRole('dialog', { name: 'Terms and Conditions' }).waitFor();
      expectNone(await scan(page, `${theme}/terms dialog`));
    });
  });
}

test.describe('first-run tour', () => {
  test.use({ tourDone: false });

  test('dialog', async ({ page }) => {
    await useTheme(page, 'dark');
    await signIn(page, USER.email, USER.password);
    await page.getByRole('dialog', { name: "Hi, I'm Dua" }).waitFor();
    expectNone(await scan(page, 'dark/tour'));
  });
});
