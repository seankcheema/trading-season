import { decodeJwtPayload } from './fixtures/api-stub';
import { newAccount } from './fixtures/accounts';
import { readAllBrowserStorage, readStoredSession } from './fixtures/pages';
import { expect, test } from './fixtures/test';

/**
 * Checks on how the password and the SSN are displayed, transmitted and
 * persisted.
 *
 * What these prove: neither secret is shown without the user asking, neither
 * reaches a tier that has no business with it, neither travels in a URL,
 * neither is echoed back in a response, and neither is written to any browser
 * storage. What they do not prove: transport encryption, which is a
 * deployment concern and absent from the HTTP dev server, and encryption at
 * rest, which no browser-side test can observe.
 */

test.describe('masking', () => {
  const REGISTERED = newAccount();

  test.describe('on the login form', () => {
    test.use({
      stubOptions: {
        accounts: [{ email: REGISTERED.email, password: REGISTERED.password, hasProfile: true }],
      },
    });

    test('hides the password until the user asks to see it', async ({ loginPage }) => {
      await loginPage.goto();
      await loginPage.password.fill(REGISTERED.password);

      await expect(loginPage.password).toHaveAttribute('type', 'password');
      await expect(loginPage.passwordToggle).toHaveAttribute('aria-label', 'Show password');

      await loginPage.passwordToggle.click();

      await expect(loginPage.password).toHaveAttribute('type', 'text');
      await expect(loginPage.passwordToggle).toHaveAttribute('aria-label', 'Hide password');

      await loginPage.passwordToggle.click();

      await expect(loginPage.password).toHaveAttribute('type', 'password');
    });
  });

  test.describe('on the registration form', () => {
    test('hides the SSN until the user asks to see it', async ({ registerPage }) => {
      const account = newAccount();

      await registerPage.goto();
      await registerPage.ssn.fill(account.ssn.replaceAll('-', ''));

      await expect(registerPage.ssn).toHaveAttribute('type', 'password');
      await expect(registerPage.ssnToggle).toHaveAttribute('aria-label', 'Show SSN');

      await registerPage.ssnToggle.click();

      await expect(registerPage.ssn).toHaveAttribute('type', 'text');
      await expect(registerPage.ssn).toHaveValue(account.ssn);

      await registerPage.ssnToggle.click();

      await expect(registerPage.ssn).toHaveAttribute('type', 'password');
    });

    test('hides the password and its confirmation until asked', async ({ registerPage }) => {
      const account = newAccount();

      await registerPage.goto();
      await registerPage.fill(account);

      await expect(registerPage.password).toHaveAttribute('type', 'password');
      await expect(registerPage.confirmPassword).toHaveAttribute('type', 'password');

      await registerPage.passwordToggle.click();
      await registerPage.confirmPasswordToggle.click();

      await expect(registerPage.password).toHaveAttribute('type', 'text');
      await expect(registerPage.confirmPassword).toHaveAttribute('type', 'text');
    });

    test('reveals only the field the user asked about', async ({ registerPage }) => {
      const account = newAccount();

      await registerPage.goto();
      await registerPage.fill(account);
      await registerPage.passwordToggle.click();

      await expect(registerPage.password).toHaveAttribute('type', 'text');
      // Revealing one secret must not reveal the others.
      await expect(registerPage.confirmPassword).toHaveAttribute('type', 'password');
      await expect(registerPage.ssn).toHaveAttribute('type', 'password');
    });

    test('starts masked again on a fresh visit', async ({ page, registerPage }) => {
      const account = newAccount();

      await registerPage.goto();
      await registerPage.fill(account);
      await registerPage.ssnToggle.click();
      await registerPage.passwordToggle.click();
      await expect(registerPage.ssn).toHaveAttribute('type', 'text');

      await page.reload();
      await registerPage.email.waitFor();

      await expect(registerPage.ssn).toHaveAttribute('type', 'password');
      await expect(registerPage.password).toHaveAttribute('type', 'password');
    });
  });
});

test.describe('where the secrets travel', () => {
  test('sends the password only to the auth service, never to the business backend', async ({
    page,
    registerPage,
    api,
  }) => {
    const account = newAccount();

    await registerPage.goto();
    await registerPage.register(account);
    await expect(page).toHaveURL(/\/dashboard$/);

    const carryingPassword = api.requestsContaining(account.password);
    expect(carryingPassword.length).toBeGreaterThan(0);
    for (const request of carryingPassword) {
      // The Java backend has no use for a password and must never receive one.
      expect(new URL(request.url).pathname).toBe('/auth/register');
      expect(request.url.startsWith('http://localhost:3001/')).toBe(true);
    }
  });

  test('sends the SSN only to the business backend, never to the auth service', async ({
    page,
    registerPage,
    api,
  }) => {
    const account = newAccount();

    await registerPage.goto();
    await registerPage.register(account);
    await expect(page).toHaveURL(/\/dashboard$/);

    const carryingSsn = api.requestsContaining(account.ssn);
    expect(carryingSsn.length).toBeGreaterThan(0);
    for (const request of carryingSsn) {
      expect(new URL(request.url).pathname).toBe('/api/auth/register');
      expect(request.url.startsWith('http://localhost:3001/')).toBe(false);
    }
  });

  test('puts neither secret in a URL, where it would reach logs and history', async ({
    page,
    registerPage,
    api,
  }) => {
    const account = newAccount();

    await registerPage.goto();
    await registerPage.register(account);
    await expect(page).toHaveURL(/\/dashboard$/);

    for (const secret of [account.password, account.ssn]) {
      expect(api.requests.filter((request) => request.url.includes(secret))).toHaveLength(0);
      expect(api.requests.filter((request) => request.url.includes(encodeURIComponent(secret))))
        .toHaveLength(0);
    }
    expect(page.url()).not.toContain(account.ssn);
    expect(page.url()).not.toContain(account.password);
  });

  test('carries both secrets in a request body, never in a GET', async ({
    page,
    registerPage,
    api,
  }) => {
    const account = newAccount();

    await registerPage.goto();
    await registerPage.register(account);
    await expect(page).toHaveURL(/\/dashboard$/);

    for (const secret of [account.password, account.ssn]) {
      for (const request of api.requestsContaining(secret)) {
        expect(request.method).toBe('POST');
        expect(request.body).toContain(secret);
      }
    }
  });

  test('never echoes either secret back in a response', async ({ page, registerPage, api }) => {
    const account = newAccount();

    await registerPage.goto();
    await registerPage.register(account);
    await expect(page).toHaveURL(/\/dashboard$/);

    const responses = await api.apiResponses();
    expect(responses.length).toBeGreaterThan(0);
    for (const response of responses) {
      expect(response.body).not.toContain(account.password);
      expect(response.body).not.toContain(account.ssn);
    }
  });

  test('leaves the SSN out of the profile the backend returns', async ({
    page,
    registerPage,
    api,
  }) => {
    const account = newAccount();

    await registerPage.goto();
    await registerPage.register(account);
    await expect(page).toHaveURL(/\/dashboard$/);

    // The backend holds the SSN it was given...
    expect(api.storedProfile(account.email)).toMatchObject({ ssn: account.ssn });

    // ...and still does not return it to the caller who owns it.
    const session = await readStoredSession(page);
    const profile = await page.evaluate(async (accessToken) => {
      const response = await fetch('/api/users/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      return (await response.json()) as Record<string, unknown>;
    }, session?.accessToken ?? '');

    expect(profile).toMatchObject({ email: account.email, firstName: account.firstName });
    expect(profile).not.toHaveProperty('ssn');
  });
});

test.describe('what the browser keeps', () => {
  test('writes neither secret to local storage, session storage or cookies', async ({
    page,
    registerPage,
  }) => {
    const account = newAccount();

    await registerPage.goto();
    await registerPage.register(account);
    await expect(page).toHaveURL(/\/dashboard$/);

    const stored = await readAllBrowserStorage(page);
    expect(stored).not.toContain(account.password);
    expect(stored).not.toContain(account.ssn);
    // The SSN without its separators must not be there either.
    expect(stored).not.toContain(account.ssn.replaceAll('-', ''));
  });

  test('keeps only opaque tokens in the stored session', async ({ page, registerPage }) => {
    const account = newAccount();

    await registerPage.goto();
    await registerPage.register(account);
    await expect(page).toHaveURL(/\/dashboard$/);

    const session = await readStoredSession(page);
    expect(session).not.toBeNull();
    expect(Object.keys(session ?? {}).sort()).toEqual([
      'accessToken',
      'expiresAt',
      'refreshToken',
    ]);
  });

  test('issues an access token whose claims carry neither secret', async ({
    page,
    registerPage,
  }) => {
    const account = newAccount();

    await registerPage.goto();
    await registerPage.register(account);
    await expect(page).toHaveURL(/\/dashboard$/);

    const session = await readStoredSession(page);
    const claims = decodeJwtPayload(session?.accessToken ?? '');

    // The claim set identifies the account; it does not restate its secrets.
    expect(Object.keys(claims).sort()).toEqual(['email', 'exp', 'iat', 'iss', 'roles', 'sub']);
    expect(JSON.stringify(claims)).not.toContain(account.password);
    expect(JSON.stringify(claims)).not.toContain(account.ssn);
  });

  test('leaves neither secret in the page once registration completes', async ({
    page,
    registerPage,
  }) => {
    const account = newAccount();

    await registerPage.goto();
    await registerPage.register(account);
    await expect(page).toHaveURL(/\/dashboard$/);

    const markup = await page.content();
    expect(markup).not.toContain(account.password);
    expect(markup).not.toContain(account.ssn);
  });
});
