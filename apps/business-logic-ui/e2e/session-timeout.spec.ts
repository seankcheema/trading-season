import type { Page } from '@playwright/test';
import { newAccount } from './fixtures/accounts';
import { type LoginPage, readStoredSession } from './fixtures/pages';
import { expect, test } from './fixtures/test';

const REGISTERED = newAccount();

test.describe('the inactivity timeout', () => {
  test.use({
    stubOptions: {
      accounts: [{ email: REGISTERED.email, password: REGISTERED.password, hasProfile: true }],
    },
  });

  // The page's clock is faked so the tests can skip ahead minutes at a time. It has to be
  // installed before the application loads so every timer it sets is under the fake clock.
  test.beforeEach(async ({ page }) => {
    await page.clock.install();
  });

  async function signIn({ page, loginPage }: { page: Page; loginPage: LoginPage }) {
    await loginPage.goto();
    await loginPage.signIn(REGISTERED.email, REGISTERED.password);
    await expect(page).toHaveURL(/\/dashboard$/);
  }

  test('signs the user out after 10 minutes without activity', async ({
    page,
    loginPage,
    api,
  }) => {
    await signIn({ page, loginPage });

    await page.clock.fastForward('10:00');

    await expect(page).toHaveURL(/\/login\?reason=inactive$/);
    await expect(page.getByRole('status')).toContainText('signed out after a period of inactivity');
    expect(await readStoredSession(page)).toBeNull();
    // The refresh token is revoked, not just forgotten by the browser.
    expect(api.requests.filter((request) => request.url.endsWith('/auth/logout'))).toHaveLength(1);
  });

  test('keeps the user signed in just short of the limit', async ({ page, loginPage }) => {
    await signIn({ page, loginPage });

    await page.clock.fastForward('09:50');

    await expect(page).toHaveURL(/\/dashboard$/);
    expect(await readStoredSession(page)).not.toBeNull();
  });

  test('restarts the countdown when the user is active', async ({ page, loginPage }) => {
    await signIn({ page, loginPage });

    await page.clock.fastForward('09:00');
    await page.mouse.move(200, 200);
    await page.clock.fastForward('09:00');
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.clock.fastForward('01:00');
    await expect(page).toHaveURL(/\/login\?reason=inactive$/);
  });

  test('does not run before the user signs in', async ({ page, loginPage, api }) => {
    await loginPage.goto();

    await page.clock.fastForward('01:00:00');

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('status')).toHaveCount(0);
    expect(api.requests.filter((request) => request.url.endsWith('/auth/logout'))).toHaveLength(0);
  });

  async function openSettings(page: Page) {
    await page.getByLabel('Open profile menu').click();
    await page.getByRole('menuitem', { name: 'Settings' }).click();
    const dialog = page.getByRole('dialog', { name: 'Settings' });
    await expect(dialog).toBeVisible();
    return dialog;
  }

  test('uses the limit chosen in settings', async ({ page, loginPage }) => {
    await signIn({ page, loginPage });

    const dialog = await openSettings(page);
    const limit = dialog.getByLabel('Sign out after inactivity');
    await expect(limit).toHaveValue('10');
    await limit.selectOption('5');
    await dialog.getByRole('button', { name: 'Close settings' }).click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.clock.fastForward('05:00');

    await expect(page).toHaveURL(/\/login\?reason=inactive$/);

    // The choice outlives the session it was made in.
    await loginPage.signIn(REGISTERED.email, REGISTERED.password);
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect((await openSettings(page)).getByLabel('Sign out after inactivity')).toHaveValue(
      '5',
    );
  });

  test('closes the settings dialog with Escape', async ({ page, loginPage }) => {
    await signIn({ page, loginPage });

    const dialog = await openSettings(page);
    await page.keyboard.press('Escape');

    await expect(dialog).toBeHidden();
  });
});
