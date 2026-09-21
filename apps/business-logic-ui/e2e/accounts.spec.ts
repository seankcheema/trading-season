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

// The stubbed market has no live prices, so every holding is valued at its average cost.
// These symbols are also outside the dashboard's placeholder ticker, so their values are
// stable whether or not the market snapshot has arrived yet.
const EXISTING_SEED = seed(EXISTING_USER, {
  availableFunds: 2000,
  tradingAccounts: [
    // A $600 portfolio.
    { name: 'Brokerage', holdings: [{ symbol: 'IBM', quantity: 3, averageCost: 200 }] },
    // A $700 portfolio.
    { name: 'IRA', holdings: [{ symbol: 'KO', quantity: 10, averageCost: 70 }] },
  ],
});

const OTHER_SEED = seed(OTHER_USER, {
  availableFunds: 99_999,
  tradingAccounts: [
    { name: 'Other savings', holdings: [{ symbol: 'PEP', quantity: 1, averageCost: 150 }] },
  ],
});

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
    test.use({ stubOptions: { accounts: [seed(NEW_USER, { availableFunds: 5000 })] } });

    test('starts with no accounts, and the user’s own cash as their net worth', async ({
      loginPage,
      dashboardPage,
    }) => {
      await signIn({ loginPage, dashboardPage }, NEW_USER);

      await expect(dashboardPage.accountMenu).toContainText('No accounts');
      await expect(dashboardPage.cash).toHaveText('Cash $5,000.00');
      await expect(dashboardPage.netWorth).toHaveText('$5,000');
      // Cash belongs to the user, not an account, so it can move before any account exists.
      await expect(dashboardPage.deposit).toBeEnabled();
      expect(await dashboardPage.listedAccounts()).toEqual([]);
    });

    test('creates a blank account and selects it', async ({
      page,
      loginPage,
      dashboardPage,
      api,
    }) => {
      await signIn({ loginPage, dashboardPage }, NEW_USER);

      const dialog = await dashboardPage.createAccount('  Brokerage  ');

      await expect(dialog).toBeHidden();
      await expect(dashboardPage.accountMenu).toContainText('Brokerage');
      // The new account's portfolio is empty and the shared cash is untouched.
      await expect(dashboardPage.portfolioValue).toHaveText('$0');
      await expect(dashboardPage.assets).toContainText('This account has no holdings yet.');
      await expect(dashboardPage.cash).toHaveText('Cash $5,000.00');
      await expect(dashboardPage.netWorth).toHaveText('$5,000');

      const creates = api.requests.filter(
        (request) => request.method === 'POST' && request.url.endsWith('/api/me/accounts'),
      );
      expect(creates).toHaveLength(1);
      // Only a name: no opening deposit or balance.
      expect(JSON.parse(creates[0].body ?? '{}')).toEqual({ name: 'Brokerage' });
      expect(creates[0].headers['authorization']).toMatch(/^Bearer /);
      const [created] = api.tradingAccountsOf(NEW_USER.email);
      expect(created).toEqual(expect.objectContaining({ name: 'Brokerage' }));
      expect(api.holdingsOf(created.accountId)).toEqual([]);
      expect(api.fundsOf(NEW_USER.email)).toBe(5000);

      // The account is the backend's, not the page's: it is still there after a reload.
      await page.reload();
      await expect(dashboardPage.accountMenu).toContainText('Brokerage');
    });

    test('asks only for a name', async ({ loginPage, dashboardPage }) => {
      await signIn({ loginPage, dashboardPage }, NEW_USER);

      const dialog = await dashboardPage.openNewAccount();

      await expect(dialog.getByRole('textbox')).toHaveCount(1);
      await expect(dialog.getByRole('spinbutton')).toHaveCount(0);
      await expect(dialog).toContainText('starts with no holdings');
    });

    test('checks the name before sending anything', async ({ loginPage, dashboardPage, api }) => {
      await signIn({ loginPage, dashboardPage }, NEW_USER);

      const dialog = await dashboardPage.openNewAccount();
      await dialog.getByLabel('Account name').fill('   ');
      await dialog.getByRole('button', { name: 'Create account' }).click();

      await expect(dialog.getByText('Enter an account name of up to 60 characters.')).toBeVisible();
      expect(
        api.requests.filter(
          (request) => request.method === 'POST' && request.url.endsWith('/api/me/accounts'),
        ),
      ).toHaveLength(0);
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
    test.use({ stubOptions: { accounts: [EXISTING_SEED, OTHER_SEED] } });

    test('adds a blank account alongside the others without changing net worth', async ({
      loginPage,
      dashboardPage,
    }) => {
      await signIn({ loginPage, dashboardPage }, EXISTING_USER);
      await expect(dashboardPage.netWorth).toHaveText('$3,300');

      await dashboardPage.createAccount('Retirement');

      await expect(dashboardPage.accountMenu).toContainText('Retirement');
      await expect(dashboardPage.portfolioValue).toHaveText('$0');
      await expect(dashboardPage.netWorth).toHaveText('$3,300');
      expect(await dashboardPage.listedAccounts()).toEqual(['Brokerage', 'IRA', 'Retirement']);
    });

    test('refuses a duplicate name and says why', async ({ loginPage, dashboardPage, api }) => {
      await signIn({ loginPage, dashboardPage }, EXISTING_USER);

      const dialog = await dashboardPage.createAccount('brokerage');

      await expect(dialog.getByRole('alert')).toHaveText(
        'You already have an account with this name.',
      );
      expect(api.tradingAccountsOf(EXISTING_USER.email)).toHaveLength(2);
    });

    test("never lists or counts another user's accounts or cash", async ({
      page,
      loginPage,
      dashboardPage,
    }) => {
      await signIn({ loginPage, dashboardPage }, EXISTING_USER);
      await dashboardPage.createAccount('Retirement');
      await expect(dashboardPage.accountMenu).toContainText('Retirement');

      expect(await dashboardPage.listedAccounts()).toEqual(['Brokerage', 'IRA', 'Retirement']);
      await expect(page.locator('body')).not.toContainText('Other savings');
      await expect(page.locator('body')).not.toContainText('99,999');
      await expect(dashboardPage.assets).not.toContainText('PEP');
      await expect(dashboardPage.netWorth).toHaveText('$3,300');
    });
  });
});

test.describe('portfolios and net worth', () => {
  test.use({ stubOptions: { accounts: [EXISTING_SEED] } });

  test("counts the shared cash once plus every account's portfolio", async ({
    loginPage,
    dashboardPage,
  }) => {
    await signIn({ loginPage, dashboardPage }, EXISTING_USER);

    // $2,000 cash + $600 Brokerage portfolio + $700 IRA portfolio.
    await expect(dashboardPage.netWorth).toHaveText('$3,300');
    await expect(dashboardPage.cash).toHaveText('Cash $2,000.00');
    await expect(dashboardPage.portfolioValue).toHaveText('$600');
    await expect(dashboardPage.assets).toContainText('IBM');

    // An account's portfolio is its holdings; switching accounts switches portfolios only.
    await dashboardPage.selectAccount('IRA');
    await expect(dashboardPage.portfolioValue).toHaveText('$700');
    await expect(dashboardPage.assets).toContainText('KO');
    await expect(dashboardPage.assets).not.toContainText('IBM');
    await expect(dashboardPage.cash).toHaveText('Cash $2,000.00');
    await expect(dashboardPage.netWorth).toHaveText('$3,300');
  });

  test('renames an account, and so its portfolio', async ({
    page,
    loginPage,
    dashboardPage,
    api,
  }) => {
    await signIn({ loginPage, dashboardPage }, EXISTING_USER);

    await dashboardPage.accountMenuTrigger.click();
    await dashboardPage.accountMenu.getByRole('menuitem', { name: 'Rename IRA' }).click();
    const dialog = page.getByRole('dialog', { name: 'Rename account' });
    await expect(dialog.getByLabel('Account name')).toHaveValue('IRA');
    await dialog.getByLabel('Account name').fill('Roth IRA');
    await dialog.getByRole('button', { name: 'Save' }).click();

    await expect(dialog).toBeHidden();
    expect(await dashboardPage.listedAccounts()).toEqual(['Brokerage', 'Roth IRA']);
    expect(api.tradingAccountsOf(EXISTING_USER.email).map((account) => account.name)).toEqual([
      'Brokerage',
      'Roth IRA',
    ]);
  });

  test('deposits and withdraws shared cash, refreshing net worth and history', async ({
    page,
    loginPage,
    dashboardPage,
    api,
  }) => {
    await signIn({ loginPage, dashboardPage }, EXISTING_USER);

    const deposit = await dashboardPage.moveCash('Deposit', '50.25');
    await expect(deposit).toBeHidden();
    await expect(dashboardPage.cash).toHaveText('Cash $2,050.25');
    await expect(dashboardPage.netWorth).toHaveText('$3,350');
    await expect(dashboardPage.recentTransactions.locator('li').first()).toContainText('+$50.25');

    // Cash is shared, so the selected account makes no difference to it.
    await dashboardPage.selectAccount('IRA');
    await expect(dashboardPage.cash).toHaveText('Cash $2,050.25');

    const tooMuch = await dashboardPage.moveCash('Withdraw', '5000');
    await expect(tooMuch.getByText("That's more than your available cash.")).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(tooMuch).toBeHidden();

    const withdrawal = await dashboardPage.moveCash('Withdraw', '25');
    await expect(withdrawal).toBeHidden();
    await expect(dashboardPage.cash).toHaveText('Cash $2,025.25');
    await expect(dashboardPage.recentTransactions.locator('li').first()).toContainText(
      'withdrawal',
    );

    const posts = api.requests.filter(
      (request) => request.method === 'POST' && request.url.endsWith('/api/me/cash-transactions'),
    );
    expect(posts.map((request) => JSON.parse(request.body ?? '{}'))).toEqual([
      { amount: 50.25, reason: 'DEPOSIT' },
      { amount: 25, reason: 'WITHDRAWAL' },
    ]);
    expect(api.fundsOf(EXISTING_USER.email)).toBe(2025.25);
  });
});
