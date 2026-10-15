import { type Page } from '@playwright/test';
import { type Person, admin, analyst, trader } from './fixtures/scenario';
import { expect, readSession, test } from './fixtures/test';

const NO_ACCESS =
  "This account doesn't have access to reporting. Sign in with an analyst or admin account.";

async function signIn(page: Page, person: Pick<Person, 'email' | 'password'>): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(person.email);
  await page.getByLabel('Password', { exact: true }).fill(person.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

const sidebar = (page: Page) => page.getByRole('navigation', { name: 'Reporting' });
// The signed-in user is named at the foot of the sidebar; the print header repeats the name.
const account = (page: Page) => page.locator('aside');

test.describe('signing in as an admin', () => {
  test('lands on Activity and offers every screen', async ({ page }) => {
    await signIn(page, admin);

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: 'Activity', level: 1 })).toBeVisible();
    for (const name of ['Activity', 'Customers', 'Orders', 'Report runs']) {
      await expect(sidebar(page).getByRole('link', { name })).toBeVisible();
    }
  });

  test('names the admin from the profile the Reporting Service holds', async ({ page }) => {
    await signIn(page, admin);

    // First and last name and trader level come from GET /api/reporting/profile, which the
    // service answers from the CUSTOMER_PROFILE record it read, for the token's subject.
    await expect(account(page).getByText('Ada Admin')).toBeVisible();
    await expect(account(page).getByText('Admin · Advanced')).toBeVisible();
  });

  test('keeps the session in this browser, so a reload stays signed in', async ({ page }) => {
    await signIn(page, admin);
    await expect(page.getByRole('heading', { name: 'Activity', level: 1 })).toBeVisible();

    const session = await readSession(page);
    expect(session?.accessToken.split('.')).toHaveLength(3);
    expect(session?.refreshToken).toBeTruthy();
    expect(session?.expiresAt).toBeGreaterThan(Date.now());

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Activity', level: 1 })).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
  });

  test('is sent away from the sign-in page while signed in', async ({ page, openAsAdmin }) => {
    await openAsAdmin('/');
    await expect(page.getByRole('heading', { name: 'Activity', level: 1 })).toBeVisible();

    await page.goto('/login');

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: 'Activity', level: 1 })).toBeVisible();
  });
});

test.describe('signing in as an analyst', () => {
  test('lands on the report runs and offers nothing else', async ({ page }) => {
    await signIn(page, analyst);

    await expect(page).toHaveURL(/\/runs$/);
    await expect(page.getByRole('heading', { name: 'Report runs', level: 1 })).toBeVisible();
    await expect(sidebar(page).getByRole('link')).toHaveCount(1);
    await expect(sidebar(page).getByRole('link', { name: 'Report runs' })).toBeVisible();
  });

  test('shows the email when the service holds no profile for the analyst', async ({ page }) => {
    await signIn(page, analyst);

    // The profile route answers 404 for a subject with no trading profile.
    await expect(page.getByRole('heading', { name: 'Report runs', level: 1 })).toBeVisible();
    await expect(account(page).getByText(analyst.email)).toBeVisible();
  });
});

test.describe('refusing a sign-in', () => {
  test('keeps a wrong password on the sign-in page with a message that names no field', async ({
    page,
  }) => {
    await signIn(page, { email: admin.email, password: 'not-the-password' });

    await expect(page.getByRole('alert')).toContainText('Incorrect email or password');
    await expect(page).toHaveURL(/\/login$/);
    expect(await readSession(page)).toBeNull();
  });

  test('answers an unknown account the same way as a wrong password', async ({ page }) => {
    await signIn(page, { email: 'nobody@e2e.example.com', password: admin.password });

    await expect(page.getByRole('alert')).toContainText('Incorrect email or password');
  });

  test('stops a malformed email before any request is made', async ({ page }) => {
    const logins: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/auth/login')) {
        logins.push(request.url());
      }
    });

    await signIn(page, { email: 'not-an-email', password: admin.password });

    await expect(page.getByText('Enter a valid email address.')).toBeVisible();
    expect(logins).toHaveLength(0);
  });

  test('clears the message when the form is edited', async ({ page }) => {
    await signIn(page, { email: admin.email, password: 'wrong' });
    await expect(page.getByRole('alert')).toBeVisible();

    await page.getByLabel('Password', { exact: true }).fill('typing again');

    await expect(page.getByRole('alert')).toBeHidden();
  });

  test('turns away an account with the right password but no reporting role, and revokes it', async ({
    page,
  }) => {
    const calls: string[] = [];
    page.on('request', (request) => {
      const { pathname } = new URL(request.url());
      if (pathname.startsWith('/auth/')) {
        calls.push(pathname);
      }
    });

    await signIn(page, trader);

    await expect(page.getByRole('alert')).toHaveText(NO_ACCESS);
    await expect(page).toHaveURL(/\/login$/);
    // No token is kept, and the session the Auth Service just issued is revoked at once.
    expect(await readSession(page)).toBeNull();
    expect(calls).toEqual(['/auth/login', '/auth/logout']);
  });
});

test.describe('protecting the screens', () => {
  for (const path of ['/', '/customers', '/orders', '/runs']) {
    test(`sends a visitor who is not signed in from ${path} to sign in`, async ({ page }) => {
      await page.goto(path);

      await expect(page).toHaveURL(/\/login$/);
      await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    });
  }

  test('sends a stored session without a reporting role back with the reason', async ({
    page,
    request,
  }) => {
    const response = await request.post('/auth/login', {
      data: { email: trader.email, password: trader.password },
    });
    const tokens = (await response.json()) as { accessToken: string; refreshToken: string };
    await page.goto('/2b-waves.svg');
    await page.evaluate(
      (session) => localStorage.setItem('ts.reporting.session', JSON.stringify(session)),
      { ...tokens, expiresAt: Date.now() + 600_000 },
    );

    await page.goto('/orders');

    await expect(page).toHaveURL(/\/login\?reason=role$/);
    await expect(page.getByRole('status')).toHaveText(NO_ACCESS);
    expect(await readSession(page)).toBeNull();
  });
});

test.describe('signing out', () => {
  test('ends the session here and at the Auth Service', async ({ page, openAsAdmin }) => {
    await openAsAdmin('/');
    await expect(page.getByRole('heading', { name: 'Activity', level: 1 })).toBeVisible();
    const session = await readSession(page);
    const logout = page.waitForRequest((request) => request.url().endsWith('/auth/logout'));

    await page.getByRole('button', { name: 'Log out' }).click();

    expect(JSON.parse((await logout).postData() ?? '{}')).toEqual({
      refreshToken: session?.refreshToken,
    });
    await expect(page).toHaveURL(/\/login$/);
    expect(await readSession(page)).toBeNull();

    // The refresh token is spent: presenting it again is refused.
    const refused = await page.request.post('/auth/refresh', {
      data: { refreshToken: session?.refreshToken },
    });
    expect(refused.status()).toBe(401);

    await page.goto('/customers');
    await expect(page).toHaveURL(/\/login$/);
  });
});
