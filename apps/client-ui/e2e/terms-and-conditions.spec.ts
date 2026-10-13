import { TERMS_SECTIONS, TERMS_VERSION } from '../src/app/dashboard/terms/terms-content';
import { newAccount } from './fixtures/accounts';
import type { SeedAccount } from './fixtures/api-stub';
import { expect, test } from './fixtures/test';

const TERMS_ACCEPTANCE = '/api/users/me/terms-acceptance';

// An established user who registered before the terms in force were published.
const ADA = newAccount({ firstName: 'Ada', lastName: 'Lovelace' });
const ADA_SEED: SeedAccount = {
  email: ADA.email,
  password: ADA.password,
  hasProfile: true,
  firstName: ADA.firstName,
  lastName: ADA.lastName,
  termsAccepted: false,
  tradingAccounts: [{ name: 'Brokerage' }],
};

test.describe('a newly registered user', () => {
  test('must read, sign and accept the terms before using the dashboard', async ({
    page,
    registerPage,
    termsDialog,
    api,
  }) => {
    const account = newAccount({ firstName: 'Grace', lastName: 'Hopper' });
    await registerPage.goto();
    await registerPage.register(account);
    await expect(page).toHaveURL(/\/dashboard$/);

    // Every section is there to read, under the version being accepted.
    await expect(termsDialog.dialog).toBeVisible();
    await expect(termsDialog.dialog).toContainText(`Version ${TERMS_VERSION}`);
    for (const section of TERMS_SECTIONS) {
      await expect(termsDialog.text).toContainText(section.title);
    }

    // There is no way past it: no close button, and Escape and the backdrop do nothing.
    await expect(termsDialog.dialog.getByRole('button', { name: /close/i })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await page.mouse.click(5, 5);
    await expect(termsDialog.dialog).toBeVisible();
    await expect(page.getByTestId('dashboard-content')).toHaveAttribute('inert');

    // Only the user's own name signs; capitalisation does not matter.
    await expect(termsDialog.dialog).toContainText('Grace Hopper');
    await expect(termsDialog.accept).toBeDisabled();
    await termsDialog.signature.fill('Someone Else');
    await expect(termsDialog.accept).toBeDisabled();
    await termsDialog.signAndAccept('grace hopper');

    await expect(termsDialog.dialog).toBeHidden();
    await expect(page.getByTestId('dashboard-content')).not.toHaveAttribute('inert');
    expect(api.termsAcceptedBy(account.email)).toBe(true);

    // The acceptance names the version that was on screen, and nothing else.
    const calls = api.requests.filter((request) => request.url.endsWith(TERMS_ACCEPTANCE));
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('PUT');
    expect(JSON.parse(calls[0].body ?? '{}')).toEqual({ termsVersion: TERMS_VERSION });
  });

  test('is not asked again once they have accepted', async ({
    page,
    registerPage,
    dashboardPage,
    termsDialog,
  }) => {
    const account = newAccount({ firstName: 'Grace', lastName: 'Hopper' });
    await registerPage.goto();
    await registerPage.register(account);
    await termsDialog.signAndAccept('Grace Hopper');
    await expect(termsDialog.dialog).toBeHidden();

    await page.reload();

    await expect(dashboardPage.accountMenu).not.toContainText('Loading accounts');
    await expect(termsDialog.dialog).toBeHidden();
    await expect(page.getByTestId('dashboard-content')).not.toHaveAttribute('inert');
  });
});

test.describe('an existing user who has not accepted the terms in force', () => {
  test.use({ stubOptions: { accounts: [ADA_SEED] } });

  test.beforeEach(async ({ page, loginPage }) => {
    await loginPage.goto();
    await loginPage.signIn(ADA.email, ADA.password);
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('is asked on the market page too, where the order ticket is', async ({
    page,
    termsDialog,
    api,
  }) => {
    await expect(termsDialog.dialog).toBeVisible();

    await page.goto('/dashboard/markets/AAPL');

    await expect(termsDialog.dialog).toBeVisible();
    await expect(page.locator('main.market-page')).toHaveAttribute('inert');

    await termsDialog.signAndAccept('Ada Lovelace');

    await expect(termsDialog.dialog).toBeHidden();
    await expect(page.locator('main.market-page')).not.toHaveAttribute('inert');
    expect(api.termsAcceptedBy(ADA.email)).toBe(true);
  });

  test('can sign out instead, and nothing is recorded', async ({ page, termsDialog, api }) => {
    await termsDialog.signOut.click();

    await expect(page).toHaveURL(/\/login$/);
    expect(api.termsAcceptedBy(ADA.email)).toBe(false);
    expect(api.requests.filter((request) => request.url.endsWith(TERMS_ACCEPTANCE))).toHaveLength(
      0,
    );
  });

  test('is asked again after signing back in without accepting', async ({
    page,
    loginPage,
    termsDialog,
  }) => {
    await termsDialog.signOut.click();
    await expect(page).toHaveURL(/\/login$/);

    await loginPage.signIn(ADA.email, ADA.password);

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(termsDialog.dialog).toBeVisible();
  });
});

test.describe('when the terms have changed since the page was loaded', () => {
  test.use({ stubOptions: { accounts: [ADA_SEED], termsVersion: '2099-01-01' } });

  test('the acceptance is refused and the user is told to reload', async ({
    page,
    loginPage,
    termsDialog,
    api,
  }) => {
    await loginPage.goto();
    await loginPage.signIn(ADA.email, ADA.password);
    await expect(page).toHaveURL(/\/dashboard$/);

    await termsDialog.signAndAccept('Ada Lovelace');

    await expect(termsDialog.error).toHaveText(
      'The terms have changed. Reload the page to read the current version.',
    );
    await expect(termsDialog.dialog).toBeVisible();
    await expect(page.getByTestId('dashboard-content')).toHaveAttribute('inert');
    expect(api.termsAcceptedBy(ADA.email)).toBe(false);
  });
});
