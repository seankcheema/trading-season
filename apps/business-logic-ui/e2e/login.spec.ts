import { newAccount } from './fixtures/accounts';
import { readStoredSession } from './fixtures/pages';
import { expect, test } from './fixtures/test';

const REGISTERED = newAccount();

test.describe('signing in', () => {
  test.use({
    stubOptions: {
      accounts: [{ email: REGISTERED.email, password: REGISTERED.password, hasProfile: true }],
    },
  });

  test('takes a registered user to the dashboard', async ({ page, loginPage }) => {
    await loginPage.goto();
    await loginPage.signIn(REGISTERED.email, REGISTERED.password);

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByTestId('dashboard-header-controls')).toBeVisible();
  });

  test('stores the session returned by the auth service', async ({ page, loginPage }) => {
    await loginPage.goto();
    await loginPage.signIn(REGISTERED.email, REGISTERED.password);
    await expect(page).toHaveURL(/\/dashboard$/);

    const session = await readStoredSession(page);
    expect(session).not.toBeNull();
    expect(session?.accessToken.split('.')).toHaveLength(3);
    expect(session?.refreshToken).toBeTruthy();
    // 900-second access token, so the stored expiry must be in the future.
    expect(session?.expiresAt).toBeGreaterThan(Date.now());
  });

  test('keeps a rejected sign-in on the login page with a generic message', async ({
    page,
    loginPage,
  }) => {
    await loginPage.goto();
    await loginPage.signIn(REGISTERED.email, 'not-the-right-password!1');

    await expect(loginPage.error).toContainText('Incorrect email or password');
    await expect(page).toHaveURL(/\/login$/);
    expect(await readStoredSession(page)).toBeNull();
  });

  test('gives the same message for an unknown account as for a wrong password', async ({
    loginPage,
  }) => {
    await loginPage.goto();
    await loginPage.signIn('nobody@example.com', REGISTERED.password);

    // The message must not distinguish the two, or it becomes an enumeration oracle.
    await expect(loginPage.error).toContainText('Incorrect email or password');
  });

  test('clears the error as soon as the user edits the form', async ({ loginPage }) => {
    await loginPage.goto();
    await loginPage.signIn(REGISTERED.email, 'wrong-password!1');
    await expect(loginPage.error).toBeVisible();

    await loginPage.password.fill('typing-again!1');

    await expect(loginPage.error).toBeHidden();
  });

  test('refuses to submit a malformed email', async ({ page, loginPage, api }) => {
    await loginPage.goto();
    await loginPage.signIn('not-an-email', REGISTERED.password);

    await expect(page.getByText('Enter a valid email address.')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
    // Client-side validation must stop the request, not just annotate the form.
    expect(api.requests.filter((request) => request.url.includes('/auth/login'))).toHaveLength(0);
  });

  test('sends an already signed-in user straight to the dashboard', async ({ page, loginPage }) => {
    await loginPage.goto();
    await loginPage.signIn(REGISTERED.email, REGISTERED.password);
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.goto('/login');

    // guestGuard keeps signed-in users off the login page.
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('sends a visitor without a session from the dashboard to the login page', async ({
    page,
  }) => {
    await page.goto('/dashboard');

    await expect(page).toHaveURL(/\/login$/);
  });

  test('offers a route to registration', async ({ page, loginPage }) => {
    await loginPage.goto();
    await loginPage.registerLink.click();

    await expect(page).toHaveURL(/\/register$/);
  });
});

test.describe('an expired access token', () => {
  test.use({
    stubOptions: {
      accounts: [{ email: REGISTERED.email, password: REGISTERED.password, hasProfile: true }],
      // Expired the moment it is issued, so the next guarded navigation has to refresh.
      accessTokenTtlSeconds: 0,
    },
  });

  test('is refreshed rather than signing the user out', async ({ page, loginPage, api }) => {
    await loginPage.goto();
    await loginPage.signIn(REGISTERED.email, REGISTERED.password);
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.reload();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByTestId('dashboard-header-controls')).toBeVisible();
    expect(
      api.requests.filter((request) => request.url.endsWith('/auth/refresh')).length,
    ).toBeGreaterThan(0);
  });
});
