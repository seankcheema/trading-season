import { newAccount } from './fixtures/accounts';
import { readStoredSession } from './fixtures/pages';
import { expect, test } from './fixtures/test';

const USER = newAccount();
const FULL_NAME = 'Ada Lovelace';

function termsRequests(api: { requests: { method: string; url: string }[] }) {
  return api.requests.filter(
    (request) => request.method === 'PUT' && request.url.endsWith('/users/me/terms-acceptance'),
  );
}

test.describe('the terms and conditions', () => {
  test.describe('for a user who has not accepted them', () => {
    test.use({
      stubOptions: {
        accounts: [
          {
            email: USER.email,
            password: USER.password,
            hasProfile: true,
            firstName: 'Ada',
            lastName: 'Lovelace',
            termsAccepted: false,
          },
        ],
      },
    });

    test('block the dashboard until the user signs with their full name', async ({
      page,
      loginPage,
      api,
    }) => {
      await loginPage.goto();
      await loginPage.signIn(USER.email, USER.password);

      const dialog = page.getByRole('dialog', { name: 'Terms and Conditions' });
      const accept = dialog.getByRole('button', { name: 'Accept terms' });
      await expect(dialog).toBeVisible();
      await expect(accept).toBeDisabled();

      await dialog.getByLabel('Typed signature').fill('Ada');
      await expect(accept).toBeDisabled();
      await dialog.getByLabel('Typed signature').fill(FULL_NAME);
      await accept.click();

      await expect(dialog).toBeHidden();
      expect(termsRequests(api)).toHaveLength(1);
    });

    test('stay accepted on a later visit', async ({ page, loginPage }) => {
      await loginPage.goto();
      await loginPage.signIn(USER.email, USER.password);
      const dialog = page.getByRole('dialog', { name: 'Terms and Conditions' });
      await dialog.getByLabel('Typed signature').fill(FULL_NAME);
      await dialog.getByRole('button', { name: 'Accept terms' }).click();
      await expect(dialog).toBeHidden();

      await page.reload();

      await expect(page.getByLabel('Open profile menu')).toBeVisible();
      await expect(dialog).toBeHidden();
    });

    test('sign the user out when declined', async ({ page, loginPage, api }) => {
      await loginPage.goto();
      await loginPage.signIn(USER.email, USER.password);
      const dialog = page.getByRole('dialog', { name: 'Terms and Conditions' });

      await dialog.getByRole('button', { name: 'Sign out', exact: true }).click();

      await expect(page).toHaveURL(/\/login$/);
      expect(await readStoredSession(page)).toBeNull();
      expect(termsRequests(api)).toHaveLength(0);
    });
  });

  test.describe('for a user who already accepted them', () => {
    test.use({
      stubOptions: {
        accounts: [{ email: USER.email, password: USER.password, hasProfile: true }],
      },
    });

    test('do not interrupt the dashboard', async ({ page, loginPage }) => {
      await loginPage.goto();
      await loginPage.signIn(USER.email, USER.password);

      await expect(page.getByLabel('Open profile menu')).toBeVisible();
      await expect(page.getByRole('dialog', { name: 'Terms and Conditions' })).toBeHidden();
    });
  });
});
