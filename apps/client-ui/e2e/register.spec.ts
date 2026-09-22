import { newAccount } from './fixtures/accounts';
import { readStoredSession } from './fixtures/pages';
import { expect, test } from './fixtures/test';

test.describe('registering', () => {
  test('signs the new user in automatically and lands on the dashboard', async ({
    page,
    registerPage,
    api,
  }) => {
    const account = newAccount();

    await registerPage.goto();
    await registerPage.register(account);

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByTestId('dashboard-header-controls')).toBeVisible();

    // Automatic means the session comes from registration itself. A separate
    // sign-in call would still reach the dashboard, and would not be automatic.
    const session = await readStoredSession(page);
    expect(session).not.toBeNull();
    expect(session?.expiresAt).toBeGreaterThan(Date.now());
    expect(api.requests.filter((request) => request.url.endsWith('/auth/login'))).toHaveLength(0);
  });

  test('creates credentials first, then the profile with the returned token', async ({
    page,
    registerPage,
    api,
  }) => {
    const account = newAccount({ middleName: 'Quinn', traderLevel: 'ADVANCED' });

    await registerPage.goto();
    await registerPage.register(account);
    await expect(page).toHaveURL(/\/dashboard$/);

    const calls = api.requests.filter(
      (request) =>
        request.url.endsWith('/auth/register') || request.url.endsWith('/api/auth/register'),
    );
    expect(calls.map((call) => new URL(call.url).pathname)).toEqual([
      '/auth/register',
      '/api/auth/register',
    ]);

    const credentials = JSON.parse(calls[0].body ?? '{}');
    expect(Object.keys(credentials).sort()).toEqual(['email', 'password']);

    const profileCall = calls[1];
    expect(profileCall.headers['authorization']).toMatch(/^Bearer \S+\.\S+\.\S+$/);

    // The backend receives the profile, including the SSN, and no credentials.
    const stored = api.storedProfile(account.email);
    expect(stored).toMatchObject({
      email: account.email,
      firstName: account.firstName,
      middleName: 'Quinn',
      lastName: account.lastName,
      dateOfBirth: account.dateOfBirth,
      ssn: account.ssn,
      address: account.address,
      traderLevel: 'ADVANCED',
      availableFunds: account.availableFunds,
    });
    expect(stored).not.toHaveProperty('password');
    expect(stored).not.toHaveProperty('confirmPassword');
  });

  test('sends an empty middle name as null rather than an empty string', async ({
    page,
    registerPage,
    api,
  }) => {
    const account = newAccount({ middleName: '' });

    await registerPage.goto();
    await registerPage.register(account);
    await expect(page).toHaveURL(/\/dashboard$/);

    expect(api.storedProfile(account.email)?.['middleName']).toBeNull();
  });

  test('offers a route to signing in', async ({ page, registerPage }) => {
    await registerPage.goto();
    await registerPage.loginLink.click();

    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe('registering an email that already has credentials', () => {
  const EXISTING = newAccount();

  test.describe('with the same password', () => {
    test.use({
      stubOptions: {
        // Credentials exist but the profile step never completed, which is the
        // state a failed first attempt leaves behind.
        accounts: [{ email: EXISTING.email, password: EXISTING.password, hasProfile: false }],
      },
    });

    test('resumes from the profile step instead of refusing', async ({
      page,
      registerPage,
      api,
    }) => {
      await registerPage.goto();
      await registerPage.register(EXISTING);

      await expect(page).toHaveURL(/\/dashboard$/);
      // 409 on register, then login with the same credentials, then the profile.
      expect(api.requests.filter((request) => request.url.endsWith('/auth/login'))).toHaveLength(1);
      expect(api.storedProfile(EXISTING.email)).toMatchObject({ ssn: EXISTING.ssn });
    });
  });

  test.describe('with a different password', () => {
    test.use({
      stubOptions: {
        accounts: [{ email: EXISTING.email, password: 'a-different-password!1', hasProfile: true }],
      },
    });

    test('reports that the email is taken and stores no session', async ({
      page,
      registerPage,
    }) => {
      await registerPage.goto();
      await registerPage.register(EXISTING);

      await expect(registerPage.error).toContainText('An account with this email already exists');
      await expect(page).toHaveURL(/\/register$/);
      expect(await readStoredSession(page)).toBeNull();
    });
  });
});

test.describe('when the profile step fails', () => {
  test.use({ stubOptions: { failProfileWith: 400 } });

  test('clears the session rather than leaving a half-registered user signed in', async ({
    page,
    registerPage,
  }) => {
    const account = newAccount();

    await registerPage.goto();
    await registerPage.register(account);

    await expect(registerPage.error).toBeVisible();
    await expect(page).toHaveURL(/\/register$/);
    // Without a profile the account cannot use the dashboard, so no session survives.
    expect(await readStoredSession(page)).toBeNull();

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe('registration form validation', () => {
  test('formats typed digits into XXX-XX-XXXX', async ({ registerPage }) => {
    await registerPage.goto();
    await registerPage.ssn.fill('123456789');

    await expect(registerPage.ssn).toHaveValue('123-45-6789');
  });

  test('rejects an incomplete SSN and sends nothing', async ({ registerPage, api }) => {
    const account = newAccount();

    await registerPage.goto();
    await registerPage.fill(account);
    await registerPage.ssn.fill('12345');
    await registerPage.submit.click();

    await expect(registerPage.ssn).toHaveValue('123-45');
    await expect(registerPage.page.getByText('Enter SSN as XXX-XX-XXXX.')).toBeVisible();
    expect(api.requests.filter((request) => request.url.includes('/auth/register'))).toHaveLength(
      0,
    );
  });

  test('rejects a password that misses a rule and sends nothing', async ({ registerPage, api }) => {
    const account = newAccount({ password: 'alllettersnodigit' });

    await registerPage.goto();
    await registerPage.fill(account);
    await registerPage.submit.click();

    await expect(registerPage.page).toHaveURL(/\/register$/);
    expect(api.requests.filter((request) => request.url.includes('/auth/register'))).toHaveLength(
      0,
    );
  });

  test('requires the confirmation to match', async ({ registerPage, api }) => {
    const account = newAccount();

    await registerPage.goto();
    await registerPage.fill(account);
    await registerPage.confirmPassword.fill(account.password + 'x');
    await registerPage.submit.click();

    await expect(registerPage.page.getByText('Passwords do not match.')).toBeVisible();
    expect(api.requests.filter((request) => request.url.includes('/auth/register'))).toHaveLength(
      0,
    );
  });

  test('rejects funds below the 5000 minimum and sends nothing', async ({ registerPage, api }) => {
    const account = newAccount({ availableFunds: 100 });

    await registerPage.goto();
    await registerPage.fill(account);
    await registerPage.submit.click();

    await expect(registerPage.page.getByText('Enter at least $5,000.')).toBeVisible();
    expect(api.requests.filter((request) => request.url.includes('/auth/register'))).toHaveLength(
      0,
    );
  });
});
