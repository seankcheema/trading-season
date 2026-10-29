import type { Page } from '@playwright/test';
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

const THEME_KEY = 'ts.settings.theme';
const THEMES = ['dark', 'light'] as const;

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

const SCREENS = [
  ['/', 'Activity'],
  ['/customers', 'Customers'],
  ['/orders', 'Orders'],
  ['/runs', 'Report runs'],
] as const;

for (const theme of THEMES) {
  test.describe(`${theme} theme`, () => {
    test.beforeEach(async ({ page }) => useTheme(page, theme));

    test('sign-in: focus, field boundaries and error messages', async ({ page }) => {
      const found: Violation[] = [];
      await page.goto('/login');
      await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
      found.push(...(await checkFieldBoundaries(page, `${theme}/sign-in`)));
      found.push(...(await checkFocusVisible(page, `${theme}/sign-in`)));
      await page.getByRole('button', { name: 'Sign in' }).click();
      found.push(...(await checkErrorsAreProgrammatic(page, `${theme}/sign-in (errors shown)`)));
      expectNone(found);
    });

    test('screens: focus and field boundaries', async ({ page, openAsAdmin }) => {
      const found: Violation[] = [];
      for (const [path, heading] of SCREENS) {
        await openAsAdmin(path);
        await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible();
        await expect(page.locator('.skeleton')).toHaveCount(0);
        found.push(...(await checkFieldBoundaries(page, `${theme}/${heading}`)));
        found.push(...(await checkFocusVisible(page, `${theme}/${heading}`, 50)));
      }
      expectNone(found);
    });
  });
}

test('reflows to 320px wide on every screen', async ({ page, openAsAdmin }) => {
  await useTheme(page, 'dark');
  const found: Violation[] = [];
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  found.push(...(await checkReflow(page, 'reflow/sign-in')));
  for (const [path, heading] of SCREENS) {
    await openAsAdmin(path);
    await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible();
    await expect(page.locator('.skeleton')).toHaveCount(0);
    found.push(...(await checkReflow(page, `reflow/${heading}`)));
  }
  expectNone(found);
});

test('each screen has a title of its own', async ({ page, openAsAdmin }) => {
  const titles = new Map<string, string>();
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  titles.set('/login', await page.title());
  for (const [path, heading] of SCREENS) {
    await openAsAdmin(path);
    await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible();
    titles.set(path, await page.title());
  }
  expectNone(checkTitles(titles, 'titles'));
});
