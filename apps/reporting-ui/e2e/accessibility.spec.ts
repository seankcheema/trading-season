import { expectNoAccessibilityViolations } from './fixtures/axe';
import { expect, test } from './fixtures/test';

// Scans each screen and dialog with axe-core in both themes. It catches the mistakes a scanner
// can: missing names and labels, bad ARIA, landmarks and headings, touch targets under 24px,
// and focusable content hidden from assistive technology. It does not replace a pass with a
// screen reader and in Windows high contrast; see the Client UI README's Accessibility section.

for (const theme of ['dark', 'light'] as const) {
  test.describe(`${theme} theme`, () => {
    test.beforeEach(async ({ page }) => {
      // Without motion a dialog is fully opaque the moment it is visible; a scan taken mid-fade
      // would measure its contrast at half strength.
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.addInitScript((value) => localStorage.setItem('ts.settings.theme', value), theme);
    });

    test('the sign-in page, also showing its errors', async ({ page }) => {
      await page.goto('/login');
      await expect(page.getByRole('heading', { name: 'Welcome back', level: 1 })).toBeVisible();
      await expectNoAccessibilityViolations(page, 'sign-in');

      await page.getByRole('button', { name: 'Sign in' }).click();
      await expect(page.getByText('Password is required.')).toBeVisible();
      await expectNoAccessibilityViolations(page, 'sign-in with errors');
    });

    test('each reporting screen', async ({ page, openAsAdmin }) => {
      for (const [heading, path] of [
        ['Activity', '/'],
        ['Customers', '/customers'],
        ['Orders', '/orders'],
        ['Report runs', '/runs'],
      ]) {
        await openAsAdmin(path);
        await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible();
        // The screens fill in as their data arrives; the skeletons are hidden from assistive
        // technology, so wait for them to go.
        await expect(page.locator('.skeleton').first()).toHaveCount(0);
        await expectNoAccessibilityViolations(page, heading);
      }
    });

    test('the export menu, a filter list and an order dialog', async ({ page, openAsAdmin }) => {
      await openAsAdmin('/orders');
      await expect(page.getByRole('heading', { name: 'Orders', level: 1 })).toBeVisible();
      await expect(page.locator('.skeleton').first()).toHaveCount(0);

      await page.getByRole('button', { name: 'Export this view' }).click();
      await expect(page.getByRole('menu')).toBeVisible();
      await expectNoAccessibilityViolations(page, 'export menu');
      await page.keyboard.press('Escape');

      await page.locator('app-filter-select button[aria-haspopup="listbox"]').first().click();
      await expect(page.getByRole('listbox')).toBeVisible();
      await expectNoAccessibilityViolations(page, 'filter list');
      await page.keyboard.press('Escape');

      await page.getByRole('button', { name: /^Open order #\d+$/ }).first().click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await expectNoAccessibilityViolations(page, 'order dialog');
    });
  });
}
