import { newAccount } from './fixtures/accounts';
import type { SeedAccount } from './fixtures/api-stub';
import { type DashboardPage, type LoginPage } from './fixtures/pages';
import { expect, test } from './fixtures/test';

const NEW_USER = newAccount();
const EXISTING_USER = newAccount();
const OTHER_USER = newAccount();

function seed(user: typeof NEW_USER, extra: Partial<SeedAccount> = {}): SeedAccount {
  return { email: user.email, password: user.password, hasProfile: true, ...extra };
}

async function signIn(
  { loginPage, dashboardPage }: { loginPage: LoginPage; dashboardPage: DashboardPage },
  user: typeof NEW_USER,
) {
  await loginPage.goto();
  await loginPage.signIn(user.email, user.password);
  await expect(loginPage.page).toHaveURL(/\/dashboard$/);
  // The account list has loaded once the menu stops saying so.
  await expect(dashboardPage.accountMenu).not.toContainText('Loading accounts');
}

test.describe('creating an account from the dashboard', () => {
  test.describe('for a user with no accounts', () => {
    test.use({ stubOptions: { accounts: [seed(NEW_USER)] } });

    test('starts with no account and cash actions disabled', async ({
      loginPage,
      dashboardPage,
    }) => {
      await signIn({ loginPage, dashboardPage }, NEW_USER);

      await expect(dashboardPage.accountMenu).toContainText('No accounts');
      await expect(dashboardPage.deposit).toBeDisabled();
      await expect(dashboardPage.withdraw).toBeDisabled();
      expect(await dashboardPage.listedAccounts()).toEqual([]);
    });

    test('creates the first account with an opening deposit and selects it', async ({
      page,
      loginPage,
      dashboardPage,
      api,
    }) => {
      await signIn({ loginPage, dashboardPage }, NEW_USER);

      const dialog = await dashboardPage.createAccount('  Brokerage  ', 2500);

      await expect(dialog).toBeHidden();
      await expect(dashboardPage.accountMenu).toContainText('Brokerage');
      await expect(dashboardPage.cash).toHaveText('Cash $2,500.00');
      await expect(dashboardPage.deposit).toBeEnabled();
      // The opening deposit is on the ledger, so it shows with the recent transactions.
      await expect(dashboardPage.recentTransactions.locator('li').first()).toContainText('deposit');
      await expect(dashboardPage.recentTransactions.locator('li').first()).toContainText(
        '+$2,500.00',
      );

      const creates = api.requests.filter(
        (request) => request.method === 'POST' && request.url.endsWith('/api/me/accounts'),
      );
      expect(creates).toHaveLength(1);
      expect(JSON.parse(creates[0].body ?? '{}')).toEqual({
        name: 'Brokerage',
        currency: 'USD',
        initialDeposit: 2500,
      });
      expect(creates[0].headers['authorization']).toMatch(/^Bearer /);
      expect(api.tradingAccountsOf(NEW_USER.email)).toEqual([
        expect.objectContaining({ name: 'Brokerage', cashBalance: 2500 }),
      ]);

      // The account is the backend's, not the page's: it is still there after a reload.
      await page.reload();
      await expect(dashboardPage.accountMenu).toContainText('Brokerage');
      await expect(dashboardPage.cash).toHaveText('Cash $2,500.00');
    });

    test('creates an account without an opening deposit', async ({
      loginPage,
      dashboardPage,
      api,
    }) => {
      await signIn({ loginPage, dashboardPage }, NEW_USER);

      await dashboardPage.createAccount('Savings');

      await expect(dashboardPage.accountMenu).toContainText('Savings');
      await expect(dashboardPage.cash).toHaveText('Cash $0.00');
      const create = api.requests.find(
        (request) => request.method === 'POST' && request.url.endsWith('/api/me/accounts'),
      );
      expect(JSON.parse(create?.body ?? '{}')).toEqual({ name: 'Savings', currency: 'USD' });
    });

    test('checks the form before sending anything', async ({ loginPage, dashboardPage, api }) => {
      await signIn({ loginPage, dashboardPage }, NEW_USER);

      const dialog = await dashboardPage.openNewAccount();
      await dialog.getByRole('button', { name: 'Create account' }).click();
      await expect(dialog.getByText('Enter an account name of up to 60 characters.')).toBeVisible();

      await dialog.getByLabel('Account name').fill('Savings');
      await dialog.getByLabel('Opening deposit').fill('-10');
      await dialog.getByRole('button', { name: 'Create account' }).click();
      await expect(dialog.getByText(/in whole cents/)).toBeVisible();

      expect(
        api.requests.filter(
          (request) => request.method === 'POST' && request.url.endsWith('/api/me/accounts'),
        ),
      ).toHaveLength(0);
      await expect(dialog).toBeVisible();
    });

    test('can be cancelled without creating anything', async ({
      page,
      loginPage,
      dashboardPage,
      api,
    }) => {
      await signIn({ loginPage, dashboardPage }, NEW_USER);

      const dialog = await dashboardPage.openNewAccount();
      await dialog.getByLabel('Account name').fill('Savings');
      await page.keyboard.press('Escape');

      await expect(dialog).toBeHidden();
      expect(api.tradingAccountsOf(NEW_USER.email)).toEqual([]);
    });

    test('opens the dialog from the net worth card prompt', async ({
      page,
      loginPage,
      dashboardPage,
    }) => {
      await signIn({ loginPage, dashboardPage }, NEW_USER);

      await page.getByRole('button', { name: 'Create an account' }).click();

      await expect(page.getByRole('dialog', { name: 'New account' })).toBeVisible();
    });
  });

  test.describe('when the service rejects it', () => {
    test.use({
      stubOptions: { accounts: [seed(NEW_USER)], failAccountCreationWith: 503 },
    });

    test('keeps the dialog open and explains the failure', async ({ loginPage, dashboardPage }) => {
      await signIn({ loginPage, dashboardPage }, NEW_USER);

      const dialog = await dashboardPage.createAccount('Brokerage');

      await expect(dialog.getByRole('alert')).toHaveText(
        'The service is unavailable right now. Please try again shortly.',
      );
      await expect(dialog.getByRole('button', { name: 'Create account' })).toBeEnabled();
      await expect(dashboardPage.accountMenu).toContainText('No accounts');
    });
  });

  test.describe('for a user who already has accounts', () => {
    test.use({
      stubOptions: {
        accounts: [
          seed(EXISTING_USER, {
            tradingAccounts: [{ name: 'Brokerage', cashBalance: 1000 }],
          }),
          seed(OTHER_USER, {
            tradingAccounts: [
              {
                name: 'Other savings',
                cashBalance: 99_999,
                portfolios: [{ name: 'Other growth' }],
              },
            ],
          }),
        ],
      },
    });

    test('adds the new account alongside the existing one and switches to it', async ({
      loginPage,
      dashboardPage,
    }) => {
      await signIn({ loginPage, dashboardPage }, EXISTING_USER);
      await expect(dashboardPage.cash).toHaveText('Cash $1,000.00');

      await dashboardPage.createAccount('Retirement', 300);

      await expect(dashboardPage.accountMenu).toContainText('Retirement');
      await expect(dashboardPage.cash).toHaveText('Cash $300.00');
      expect(await dashboardPage.listedAccounts()).toEqual(['Brokerage', 'Retirement']);
    });

    test('refuses a duplicate name and says why', async ({ loginPage, dashboardPage, api }) => {
      await signIn({ loginPage, dashboardPage }, EXISTING_USER);

      const dialog = await dashboardPage.createAccount('brokerage');

      await expect(dialog.getByRole('alert')).toHaveText(
        'You already have an account with this name.',
      );
      expect(api.tradingAccountsOf(EXISTING_USER.email)).toHaveLength(1);
    });

    test("never lists or shows another user's accounts or portfolios", async ({
      page,
      loginPage,
      dashboardPage,
    }) => {
      await signIn({ loginPage, dashboardPage }, EXISTING_USER);

      await dashboardPage.createAccount('Retirement');
      await expect(dashboardPage.accountMenu).toContainText('Retirement');

      expect(await dashboardPage.listedAccounts()).toEqual(['Brokerage', 'Retirement']);
      await dashboardPage.portfolioMenuTrigger.click();
      await expect(dashboardPage.portfolioMenu).not.toContainText('Other growth');
      await expect(page.locator('body')).not.toContainText('Other savings');
      await expect(page.locator('body')).not.toContainText('99,999');
    });
  });
});

test.describe('funding and organising a new account', () => {
  test.use({ stubOptions: { accounts: [seed(NEW_USER)] } });

  test('deposits into and withdraws from a new account, refreshing balance and history', async ({
    page,
    loginPage,
    dashboardPage,
  }) => {
    await signIn({ loginPage, dashboardPage }, NEW_USER);
    await dashboardPage.createAccount('Brokerage', 100);
    await expect(dashboardPage.cash).toHaveText('Cash $100.00');

    await dashboardPage.deposit.click();
    const deposit = page.getByRole('dialog', { name: 'Deposit funds' });
    await deposit.getByLabel('Amount').fill('50.25');
    await deposit.getByRole('button', { name: 'Deposit', exact: true }).click();
    await expect(deposit).toBeHidden();
    await expect(dashboardPage.cash).toHaveText('Cash $150.25');
    await expect(dashboardPage.recentTransactions.locator('li').first()).toContainText('+$50.25');

    await dashboardPage.withdraw.click();
    const withdrawal = page.getByRole('dialog', { name: 'Withdraw funds' });
    await withdrawal.getByLabel('Amount').fill('500');
    await withdrawal.getByRole('button', { name: 'Withdraw', exact: true }).click();
    await expect(
      withdrawal.getByText("That's more than the account's available cash."),
    ).toBeVisible();

    await withdrawal.getByLabel('Amount').fill('25');
    await withdrawal.getByRole('button', { name: 'Withdraw', exact: true }).click();
    await expect(withdrawal).toBeHidden();
    await expect(dashboardPage.cash).toHaveText('Cash $125.25');
    await expect(dashboardPage.recentTransactions.locator('li').first()).toContainText(
      'withdrawal',
    );
  });

  test('creates and then renames a portfolio in the new account', async ({
    page,
    loginPage,
    dashboardPage,
    api,
  }) => {
    await signIn({ loginPage, dashboardPage }, NEW_USER);
    await dashboardPage.createAccount('Brokerage');
    await expect(dashboardPage.portfolioMenu).toContainText('No portfolio');

    await dashboardPage.portfolioMenuTrigger.click();
    await dashboardPage.portfolioMenu.getByRole('menuitem', { name: 'New portfolio' }).click();
    const create = page.getByRole('dialog', { name: 'New portfolio' });
    await expect(create.getByLabel('Account')).toHaveValue(
      String(api.tradingAccountsOf(NEW_USER.email)[0].accountId),
    );
    await create.getByLabel('Portfolio name').fill('Growth');
    await create.getByLabel('Description').fill('Long-term tech');
    await create.getByRole('button', { name: 'Create portfolio' }).click();
    await expect(create).toBeHidden();
    await expect(dashboardPage.portfolioMenu).toContainText('Growth');

    await dashboardPage.portfolioMenuTrigger.click();
    await dashboardPage.portfolioMenu.getByRole('menuitem', { name: 'Edit Growth' }).click();
    const edit = page.getByRole('dialog', { name: 'Edit portfolio' });
    await expect(edit.getByLabel('Account')).toBeDisabled();
    await expect(edit.getByLabel('Portfolio name')).toHaveValue('Growth');
    await edit.getByLabel('Portfolio name').fill('Aggressive growth');
    await edit.getByRole('button', { name: 'Save changes' }).click();
    await expect(edit).toBeHidden();

    await expect(dashboardPage.portfolioMenu).toContainText('Aggressive growth');
    expect(api.portfoliosOf(NEW_USER.email)).toEqual([
      expect.objectContaining({ name: 'Aggressive growth', description: 'Long-term tech' }),
    ]);
  });
});
