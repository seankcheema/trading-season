import type { Page } from '@playwright/test';
import { newAccount } from './fixtures/accounts';
import {
  checkErrorsAreProgrammatic,
  checkFieldBoundaries,
  checkFocusVisible,
  checkReflow,
  checkTitles,
  type Violation,
} from './fixtures/a11y';
import { expect, test } from './fixtures/test';

/*
 * The WCAG 2.2 AA criteria that axe-core has no rule for: a visible focus indicator, reflow at
 * 320px, field boundaries that stand out, errors a screen reader is told about, and a title for
 * each screen. See accessibility.spec.ts for the rules axe does check.
 */

// Walking the tab order of a screen waits for each stop's focus styles to settle.
test.describe.configure({ timeout: 120_000 });

const USER = newAccount();
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
          { name: 'Investing', holdings: [{ symbol: 'AAPL', quantity: 4, averageCost: 150 }] },
        ],
      },
    ],
  },
});

function expectNone(violations: Violation[]): void {
  expect
    .soft(
      violations.map((v) => `${v.screen}: ${v.rule} ${v.nodes.join(' | ')}`),
      'WCAG 2.2 AA violations',
    )
    .toEqual([]);
}

async function useTheme(page: Page, theme: (typeof THEMES)[number]): Promise<void> {
  await page.addInitScript(
    ([key, value]) => localStorage.setItem(key, value),
    [THEME_KEY, theme] as const,
  );
  await page.emulateMedia({ reducedMotion: 'reduce' });
}

async function signIn(page: Page): Promise<void> {
  await page.goto('/login');
  await page.locator('app-login:not([ngh])').waitFor();
  await page.locator('#email').fill(USER.email);
  await page.locator('#password').fill(USER.password);
  await page.getByRole('button', { name: /^Sign in/ }).click();
  await expect(page).toHaveURL(/dashboard$/);
}

for (const theme of THEMES) {
  test.describe(`${theme} theme`, () => {
    test.beforeEach(async ({ page }) => useTheme(page, theme));

    test('forms: focus, field boundaries and error messages', async ({ page }) => {
      const found: Violation[] = [];

      await page.goto('/login');
      await page.locator('app-login:not([ngh])').waitFor();
      found.push(...(await checkFieldBoundaries(page, `${theme}/login`)));
      found.push(...(await checkFocusVisible(page, `${theme}/login`)));
      await page.getByRole('button', { name: /^Sign in/ }).click();
      found.push(...(await checkErrorsAreProgrammatic(page, `${theme}/login (errors shown)`)));

      await page.goto('/register');
      await page.locator('app-register:not([ngh])').waitFor();
      found.push(...(await checkFieldBoundaries(page, `${theme}/register`)));
      found.push(...(await checkFocusVisible(page, `${theme}/register`, 60)));
      await page.getByRole('button', { name: /^Create account/ }).click();
      found.push(...(await checkErrorsAreProgrammatic(page, `${theme}/register (errors shown)`)));

      expectNone(found);
    });

    test('dashboard: focus and field boundaries', async ({ page }) => {
      const found: Violation[] = [];
      await signIn(page);
      await expect(page.getByTestId('net-worth')).toContainText('$');
      found.push(...(await checkFieldBoundaries(page, `${theme}/dashboard`)));
      found.push(...(await checkFocusVisible(page, `${theme}/dashboard`, 60)));

      await page.getByRole('button', { name: 'Deposit', exact: true }).click();
      await page.getByRole('dialog', { name: 'Deposit funds' }).waitFor();
      found.push(...(await checkFieldBoundaries(page, `${theme}/deposit dialog`)));
      found.push(...(await checkFocusVisible(page, `${theme}/deposit dialog`, 12)));

      expectNone(found);
    });

    test('market page: focus', async ({ page }) => {
      await signIn(page);
      await page.goto('/dashboard/markets/AAPL');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.getByTestId('market-skeleton')).toHaveCount(0);
      expectNone(await checkFocusVisible(page, `${theme}/market page`, 60));
    });
  });
}

test('reflows to 320px wide on every screen', async ({ page }) => {
  await useTheme(page, 'dark');
  const found: Violation[] = [];

  for (const [path, ready] of [
    ['/', 'main'],
    ['/login', '#email'],
    ['/register', '#email'],
  ] as const) {
    await page.goto(path);
    await page.locator(ready).first().waitFor();
    found.push(...(await checkReflow(page, `reflow${path}`)));
  }

  await signIn(page);
  await expect(page.getByTestId('net-worth')).toContainText('$');
  found.push(...(await checkReflow(page, 'reflow/dashboard')));
  await page.goto('/dashboard/markets/AAPL');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByTestId('market-skeleton')).toHaveCount(0);
  found.push(...(await checkReflow(page, 'reflow/market page')));

  expectNone(found);
});

test('each screen has a title of its own', async ({ page }) => {
  const titles = new Map<string, string>();
  for (const [path, ready] of [
    ['/', 'main'],
    ['/login', '#email'],
    ['/register', '#email'],
  ] as const) {
    await page.goto(path);
    await page.locator(ready).first().waitFor();
    titles.set(path, await page.title());
  }
  await signIn(page);
  titles.set('/dashboard', await page.title());
  await page.goto('/dashboard/markets/AAPL');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  titles.set('/dashboard/markets/AAPL', await page.title());

  expectNone(checkTitles(titles, 'titles'));
});
