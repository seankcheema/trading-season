import { newAccount } from './fixtures/accounts';
import { readStoredSession } from './fixtures/pages';
import { expect, test } from './fixtures/test';

const REGISTERED = newAccount();
const NEW_PASSWORD = 'Rese7-me-please!';

/**
 * The password reset journey (KAN-89), driven through the real application against the
 * contract-accurate stand-in for the auth service.
 *
 * The stub records the link it would have emailed instead of handing it to SMTP, which is
 * what Mailpit does for a developer running the stack: the token is read back out of the
 * "inbox" and opened exactly as a mail client would open it.
 */
test.describe('resetting a password', () => {
  test.use({
    stubOptions: {
      accounts: [{ email: REGISTERED.email, password: REGISTERED.password, hasProfile: true }],
    },
  });

  test('takes a user from the login page to a confirmation', async ({
    page,
    loginPage,
    forgotPasswordPage,
  }) => {
    await loginPage.goto();
    await page.getByRole('link', { name: 'Forgot password?' }).click();

    await expect(page).toHaveURL(/\/forgot-password$/);
    await forgotPasswordPage.request(REGISTERED.email);

    await expect(forgotPasswordPage.confirmation).toContainText('If that email has an account');
    await expect(forgotPasswordPage.confirmation).toContainText('30 minutes');
  });

  test('emails a link that sets a new password and signs the user in with it', async ({
    page,
    api,
    loginPage,
    forgotPasswordPage,
    resetPasswordPage,
  }) => {
    await forgotPasswordPage.goto();
    await forgotPasswordPage.request(REGISTERED.email);
    await expect(forgotPasswordPage.confirmation).toBeVisible();

    const token = api.resetTokenFor(REGISTERED.email);
    expect(token).toBeTruthy();

    await resetPasswordPage.open(token as string);
    await resetPasswordPage.choose(NEW_PASSWORD);

    // The reset ends every session, so it lands on the login page rather than signing in.
    await expect(page).toHaveURL(/\/login\?reason=password-reset$/);
    await expect(page.getByRole('status')).toContainText('Your password has been reset');
    expect(await readStoredSession(page)).toBeNull();

    await loginPage.signIn(REGISTERED.email, NEW_PASSWORD);

    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('leaves the old password unusable', async ({
    page,
    api,
    loginPage,
    forgotPasswordPage,
    resetPasswordPage,
  }) => {
    await forgotPasswordPage.goto();
    await forgotPasswordPage.request(REGISTERED.email);
    await expect(forgotPasswordPage.confirmation).toBeVisible();
    await resetPasswordPage.open(api.resetTokenFor(REGISTERED.email) as string);
    await resetPasswordPage.choose(NEW_PASSWORD);
    await expect(page).toHaveURL(/\/login/);

    await loginPage.signIn(REGISTERED.email, REGISTERED.password);

    await expect(loginPage.error).toContainText('Incorrect email or password');
    expect(await readStoredSession(page)).toBeNull();
  });

  test('refuses a link that has already been used', async ({
    page,
    api,
    forgotPasswordPage,
    resetPasswordPage,
  }) => {
    await forgotPasswordPage.goto();
    await forgotPasswordPage.request(REGISTERED.email);
    await expect(forgotPasswordPage.confirmation).toBeVisible();
    const token = api.resetTokenFor(REGISTERED.email) as string;

    await resetPasswordPage.open(token);
    await resetPasswordPage.choose(NEW_PASSWORD);
    await expect(page).toHaveURL(/\/login/);

    // Someone reopening the email a second time, or a link that leaked afterwards.
    await resetPasswordPage.open(token);
    await resetPasswordPage.choose('Another-password!2');

    await expect(resetPasswordPage.error).toContainText('invalid or has expired');
    await expect(page).toHaveURL(/\/reset-password/);
  });

  test('replaces an earlier link when a second one is requested', async ({
    api,
    forgotPasswordPage,
    resetPasswordPage,
  }) => {
    await forgotPasswordPage.goto();
    await forgotPasswordPage.request(REGISTERED.email);
    await expect(forgotPasswordPage.confirmation).toBeVisible();
    const first = api.resetTokenFor(REGISTERED.email) as string;

    await forgotPasswordPage.goto();
    await forgotPasswordPage.request(REGISTERED.email);
    await expect(forgotPasswordPage.confirmation).toBeVisible();
    const second = api.resetTokenFor(REGISTERED.email) as string;
    expect(second).not.toBe(first);

    // The older mailbox copy must stop working, or it stays live for its full lifetime.
    await resetPasswordPage.open(first);
    await resetPasswordPage.choose(NEW_PASSWORD);

    await expect(resetPasswordPage.error).toContainText('invalid or has expired');
  });

  test('answers an unknown address with the same confirmation and emails nothing', async ({
    api,
    forgotPasswordPage,
  }) => {
    await forgotPasswordPage.goto();
    await forgotPasswordPage.request('nobody@example.com');

    await expect(forgotPasswordPage.confirmation).toContainText('If that email has an account');
    expect(api.resetTokenFor('nobody@example.com')).toBeNull();
    expect(api.resetEmails).toHaveLength(0);
  });

  test('sends no request for a malformed address', async ({ api, page, forgotPasswordPage }) => {
    await forgotPasswordPage.goto();
    await forgotPasswordPage.request('not-an-email');

    await expect(page.getByText('Enter a valid email address.')).toBeVisible();
    expect(
      api.requests.filter((request) => request.url.includes('/auth/forgot-password')),
    ).toHaveLength(0);
  });

  test('never puts the new password in a URL or in browser storage', async ({
    page,
    api,
    forgotPasswordPage,
    resetPasswordPage,
  }) => {
    await forgotPasswordPage.goto();
    await forgotPasswordPage.request(REGISTERED.email);
    await expect(forgotPasswordPage.confirmation).toBeVisible();
    await resetPasswordPage.open(api.resetTokenFor(REGISTERED.email) as string);
    await resetPasswordPage.choose(NEW_PASSWORD);
    await expect(page).toHaveURL(/\/login/);

    for (const request of api.requestsContaining(NEW_PASSWORD)) {
      // The password belongs in the body of the reset call and nowhere else.
      expect(request.url).not.toContain(NEW_PASSWORD);
      expect(request.url).toContain('/auth/reset-password');
    }
    const stored = await page.evaluate(() =>
      JSON.stringify([{ ...localStorage }, { ...sessionStorage }]),
    );
    expect(stored).not.toContain(NEW_PASSWORD);
  });

  test('asks for a fresh link when the URL carries no token', async ({
    page,
    resetPasswordPage,
  }) => {
    await page.goto('/reset-password');

    await expect(resetPasswordPage.notice).toContainText('Open the link from your reset email');
    await resetPasswordPage.requestNewLink.click();

    await expect(page).toHaveURL(/\/forgot-password$/);
  });

  test('refuses a password the form considers too weak', async ({
    api,
    forgotPasswordPage,
    resetPasswordPage,
    page,
  }) => {
    await forgotPasswordPage.goto();
    await forgotPasswordPage.request(REGISTERED.email);
    await expect(forgotPasswordPage.confirmation).toBeVisible();
    await resetPasswordPage.open(api.resetTokenFor(REGISTERED.email) as string);

    await resetPasswordPage.choose('short1!');

    await expect(page).toHaveURL(/\/reset-password/);
    expect(
      api.requests.filter((request) => request.url.includes('/auth/reset-password')),
    ).toHaveLength(0);
  });

  test('refuses a confirmation that does not match', async ({
    api,
    forgotPasswordPage,
    resetPasswordPage,
  }) => {
    await forgotPasswordPage.goto();
    await forgotPasswordPage.request(REGISTERED.email);
    await expect(forgotPasswordPage.confirmation).toBeVisible();
    await resetPasswordPage.open(api.resetTokenFor(REGISTERED.email) as string);

    await resetPasswordPage.password.fill(NEW_PASSWORD);
    await resetPasswordPage.confirmPassword.fill('Something-else!2');
    await resetPasswordPage.submit.click();

    await expect(resetPasswordPage.page.getByText('Passwords do not match.')).toBeVisible();
    expect(
      api.requests.filter((request) => request.url.includes('/auth/reset-password')),
    ).toHaveLength(0);
  });
});

test.describe('an expired reset link', () => {
  test.use({
    stubOptions: {
      accounts: [{ email: REGISTERED.email, password: REGISTERED.password, hasProfile: true }],
      // Expired the moment it is issued, rather than waiting out the real 30 minutes.
      resetLinkTtlSeconds: 0,
    },
  });

  test('is refused with the same message as an invalid one', async ({
    api,
    forgotPasswordPage,
    resetPasswordPage,
  }) => {
    await forgotPasswordPage.goto();
    await forgotPasswordPage.request(REGISTERED.email);
    await expect(forgotPasswordPage.confirmation).toBeVisible();

    await resetPasswordPage.open(api.resetTokenFor(REGISTERED.email) as string);
    await resetPasswordPage.choose(NEW_PASSWORD);

    await expect(resetPasswordPage.error).toContainText('invalid or has expired');
    await expect(resetPasswordPage.requestNewLink).toBeVisible();
  });
});

test.describe('a reset while signed in elsewhere', () => {
  test.use({
    stubOptions: {
      accounts: [{ email: REGISTERED.email, password: REGISTERED.password, hasProfile: true }],
      // Expired on issue, so the next guarded navigation has to refresh — which is what
      // the reset is expected to have made impossible.
      accessTokenTtlSeconds: 0,
    },
  });

  test('ends the existing session instead of leaving it usable', async ({
    page,
    api,
    loginPage,
    forgotPasswordPage,
    resetPasswordPage,
  }) => {
    await loginPage.goto();
    await loginPage.signIn(REGISTERED.email, REGISTERED.password);
    await expect(page).toHaveURL(/\/dashboard$/);
    const session = await readStoredSession(page);
    expect(session).not.toBeNull();

    await forgotPasswordPage.goto();
    await forgotPasswordPage.request(REGISTERED.email);
    await expect(forgotPasswordPage.confirmation).toBeVisible();
    await resetPasswordPage.open(api.resetTokenFor(REGISTERED.email) as string);
    await resetPasswordPage.choose(NEW_PASSWORD);
    await expect(page).toHaveURL(/\/login/);

    // Put the pre-reset session back the way a second tab would still have it, then try to
    // use it: the refresh token it holds was revoked by the reset.
    await page.evaluate(
      ([key, value]) => localStorage.setItem(key, value),
      ['ts.auth.session', JSON.stringify(session)] as const,
    );
    await page.goto('/dashboard');

    await expect(page).toHaveURL(/\/login$/);
  });
});
