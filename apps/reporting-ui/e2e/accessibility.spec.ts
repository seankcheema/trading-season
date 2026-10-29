import type { Page } from '@playwright/test';
import { scan, type Violation } from './fixtures/a11y';
import { customers } from './fixtures/scenario';
import { expect, test } from './fixtures/test';

const THEME_KEY = 'ts.settings.theme';
const THEMES = ['dark', 'light'] as const;

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

for (const theme of THEMES) {
  test.describe(`${theme} theme`, () => {
    test.beforeEach(async ({ page }) => useTheme(page, theme));

    test('sign-in', async ({ page }) => {
      const found: Violation[] = [];
      await page.goto('/login');
      await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
      found.push(...(await scan(page, `${theme}/sign-in`)));
      await page.getByRole('button', { name: 'Sign in' }).click();
      found.push(...(await scan(page, `${theme}/sign-in (errors shown)`)));
      expectNone(found);
    });

    test('activity, with the export menu open', async ({ page, openAsAdmin }) => {
      const found: Violation[] = [];
      await openAsAdmin('/');
      await expect(page.getByRole('heading', { name: 'Activity', level: 1 })).toBeVisible();
      await expect(page.locator('.skeleton')).toHaveCount(0);
      found.push(...(await scan(page, `${theme}/activity`)));
      await page.getByRole('button', { name: 'Export this view' }).click();
      found.push(...(await scan(page, `${theme}/export menu`)));
      expectNone(found);
    });

    test('customers and a customer', async ({ page, openAsAdmin }) => {
      const found: Violation[] = [];
      await openAsAdmin('/customers');
      await expect(page.getByRole('heading', { name: 'Customers', level: 1 })).toBeVisible();
      await expect(page.locator('main ul > li').first()).toBeVisible();
      found.push(...(await scan(page, `${theme}/customers`)));
      await page.goto(`/customers/${customers[0].userId}`);
      await expect(page.getByRole('link', { name: 'Back to customers' })).toBeVisible();
      await expect(page.locator('main ul > li').first()).toBeVisible();
      found.push(...(await scan(page, `${theme}/customer`)));
      expectNone(found);
    });

    test('orders and an order', async ({ page, openAsAdmin }) => {
      const found: Violation[] = [];
      await openAsAdmin('/orders');
      await expect(page.getByRole('heading', { name: 'Orders', level: 1 })).toBeVisible();
      await expect(page.locator('main ul > li').first()).toBeVisible();
      found.push(...(await scan(page, `${theme}/orders`)));
      await page
        .getByRole('button', { name: /^#\d+/ })
        .first()
        .click();
      await page.getByRole('dialog').waitFor();
      found.push(...(await scan(page, `${theme}/order dialog`)));
      expectNone(found);
    });

    test('report runs', async ({ page, openAsAdmin }) => {
      await openAsAdmin('/runs');
      await expect(page.getByRole('heading', { name: 'Report runs', level: 1 })).toBeVisible();
      await expect(page.locator('.skeleton')).toHaveCount(0);
      expectNone(await scan(page, `${theme}/report runs`));
    });
  });
}
