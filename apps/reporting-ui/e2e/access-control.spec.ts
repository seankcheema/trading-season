import { createSign, generateKeyPairSync } from 'node:crypto';
import { type APIRequestContext, type Page } from '@playwright/test';
import { AUTH_STANDIN_URL } from './fixtures/ports';
import {
  type Person,
  admin,
  analyst,
  customers,
  demoted,
  shortLived,
  trader,
} from './fixtures/scenario';
import { expect, loginTokens, readSession, test } from './fixtures/test';

/*
 * Who may read what. The Reporting Service decides, from the roles claim of a
 * token it verifies against the Auth Service's JWKS; the UI only chooses what to
 * offer. The first block asks the running service directly, the second drives
 * the screens through the same rules.
 */

const ORDER_ID = 101;
const JANE = customers[0];

async function status(request: APIRequestContext, path: string, token?: string): Promise<number> {
  const response = await request.get(`/api/reporting${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return response.status();
}

/** A well-formed RS256 token for an admin, signed by a key the Auth Service never published. */
function forgedToken(options: { expiresInSeconds?: number } = {}): string {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const issuedAt = Math.floor(Date.now() / 1000);
  const unsigned = [
    encode({ alg: 'RS256', typ: 'JWT' }),
    encode({
      sub: admin.userId,
      email: admin.email,
      roles: ['ADMIN'],
      iss: AUTH_STANDIN_URL,
      iat: issuedAt,
      exp: issuedAt + (options.expiresInSeconds ?? 900),
    }),
  ].join('.');
  return `${unsigned}.${createSign('RSA-SHA256').update(unsigned).sign(privateKey).toString('base64url')}`;
}

async function setRoles(
  request: APIRequestContext,
  person: Person,
  roles: string[],
): Promise<void> {
  const response = await request.post(`${AUTH_STANDIN_URL}/__e2e/roles`, {
    data: { email: person.email, roles },
  });
  expect(response.ok()).toBe(true);
}

/** Waits until the stored access token has expired, so the next call must refresh it. */
async function untilAccessTokenExpires(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const session = JSON.parse(localStorage.getItem('ts.reporting.session') ?? 'null');
    return session !== null && session.expiresAt < Date.now();
  });
}

test.describe('what the Reporting Service answers to each role', () => {
  const runEndpoints = ['/runs', '/runs/latest', `/runs/latest?range=30d&tzOffset=0`];
  const consoleEndpoints = [
    '/activity?range=7d&tzOffset=0',
    '/orders',
    `/orders/${ORDER_ID}`,
    '/customers',
    `/customers/${JANE.userId}`,
  ];

  test('lets an admin read the runs and the whole console', async ({ request }) => {
    const { accessToken } = await loginTokens(request, admin);

    for (const path of [...runEndpoints, ...consoleEndpoints]) {
      expect(await status(request, path, accessToken), path).toBe(200);
    }
  });

  test('lets an analyst read the runs and nothing else', async ({ request }) => {
    const { accessToken } = await loginTokens(request, analyst);

    for (const path of runEndpoints) {
      expect(await status(request, path, accessToken), path).toBe(200);
    }
    for (const path of consoleEndpoints) {
      expect(await status(request, path, accessToken), path).toBe(403);
    }
  });

  test('refuses an account with neither role everything it covers', async ({ request }) => {
    const { accessToken } = await loginTokens(request, trader);

    for (const path of [...runEndpoints, ...consoleEndpoints]) {
      expect(await status(request, path, accessToken), path).toBe(403);
    }
    // A signed-in caller may still ask for their own profile; the service has none for this one.
    expect(await status(request, '/profile', accessToken)).toBe(404);
  });

  test('answers only its own profile to the token it is given', async ({ request }) => {
    const { accessToken } = await loginTokens(request, admin);

    const response = await request.get('/api/reporting/profile', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({
      user_id: admin.userId,
      first_name: 'Ada',
      last_name: 'Admin',
      trader_level: 'ADVANCED',
    });
  });

  test('turns away a caller with no token, a garbled one, and one signed by another key', async ({
    request,
  }) => {
    expect(await status(request, '/runs')).toBe(401);
    expect(await status(request, '/orders')).toBe(401);
    expect(await status(request, '/runs', 'not-a-token')).toBe(401);
    // Right claims, right issuer, wrong signature: the JWKS decides, not the claims.
    expect(await status(request, '/customers', forgedToken())).toBe(401);
  });

  test('turns away a token past its expiry', async ({ request }) => {
    const { accessToken } = await loginTokens(request, shortLived);
    expect(await status(request, '/orders', accessToken)).toBe(200);

    await expect.poll(() => status(request, '/orders', accessToken), { timeout: 10_000 }).toBe(401);
  });

  test('keeps staff out of the customer list and the single-customer route', async ({
    request,
  }) => {
    const { accessToken } = await loginTokens(request, admin);

    const response = await request.get('/api/reporting/customers', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const listed = ((await response.json()) as { customers: { email: string }[] }).customers;
    for (const staff of [admin, analyst, shortLived, demoted]) {
      expect(listed.map((customer) => customer.email)).not.toContain(staff.email);
    }
    expect(await status(request, `/customers/${admin.userId}`, accessToken)).toBe(404);
    expect(await status(request, `/customers/${analyst.userId}`, accessToken)).toBe(404);
  });

  test('is read only', async ({ request }) => {
    const { accessToken } = await loginTokens(request, admin);

    for (const path of ['/orders', '/customers', '/runs']) {
      const response = await request.post(`/api/reporting${path}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        data: {},
      });
      expect(response.status(), path).toBe(405);
    }
  });

  test('names a range or offset it does not understand', async ({ request }) => {
    const { accessToken } = await loginTokens(request, admin);

    expect(await status(request, '/activity?range=forever', accessToken)).toBe(400);
    expect(await status(request, '/activity?range=7d&tzOffset=9999', accessToken)).toBe(400);
    expect(await status(request, '/runs/latest?range=forever', accessToken)).toBe(400);
  });

  test('shows when the last run was made without a token, for monitoring', async ({ request }) => {
    const response = await request.get('/api/reporting/scheduler/status');

    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      latest_run: string | null;
      generated_at: string | null;
    };
    expect(body.latest_run).toMatch(/^\d{8}T\d{6}Z$/);
    expect(body.generated_at).toBeTruthy();
  });
});

test.describe('what the screens do with the answers', () => {
  for (const path of ['/', '/customers', `/customers/${JANE.userId}`, '/orders']) {
    test(`takes an analyst who asks for ${path} to the report runs`, async ({ page, openAs }) => {
      await openAs(analyst, path);

      await expect(page).toHaveURL(/\/runs$/);
      await expect(page.getByRole('heading', { name: 'Report runs', level: 1 })).toBeVisible();
    });
  }

  test('asks the service for nothing an analyst may not read', async ({ page, openAs }) => {
    const refused: string[] = [];
    page.on('response', (response) => {
      if (response.url().includes('/api/reporting/') && response.status() === 403) {
        refused.push(response.url());
      }
    });

    await openAs(analyst, '/runs');
    await expect(page.getByRole('heading', { name: 'Report runs', level: 1 })).toBeVisible();
    await expect(page.getByText('Trades per day')).toBeVisible();

    expect(refused).toEqual([]);
  });

  test('renews an expired access token with the refresh token and carries on', async ({
    page,
    openAs,
  }) => {
    await openAs(shortLived, '/orders');
    await expect(page.getByRole('heading', { name: 'Orders', level: 1 })).toBeVisible();
    const before = await readSession(page);
    await untilAccessTokenExpires(page);

    const refreshed = page.waitForResponse((response) => response.url().endsWith('/auth/refresh'));
    await page
      .getByRole('navigation', { name: 'Reporting' })
      .getByRole('link', { name: 'Customers' })
      .click();

    expect((await refreshed).status()).toBe(200);
    await expect(page.getByRole('heading', { name: 'Customers', level: 1 })).toBeVisible();
    await expect(page.getByText(/\d+ of \d+ customers/)).toBeVisible();
    const after = await readSession(page);
    expect(after?.accessToken).not.toBe(before?.accessToken);
    // Refresh tokens rotate: the new session holds a new one.
    expect(after?.refreshToken).not.toBe(before?.refreshToken);
  });

  test('signs out and says why when the refresh token is no longer good', async ({
    page,
    openAs,
  }) => {
    await openAs(shortLived, '/orders');
    await expect(page.getByRole('heading', { name: 'Orders', level: 1 })).toBeVisible();
    // Spend the refresh token elsewhere, as a second sign-in of the same session would.
    const session = await readSession(page);
    expect(
      (
        await page.request.post('/auth/refresh', { data: { refreshToken: session?.refreshToken } })
      ).ok(),
    ).toBe(true);
    await untilAccessTokenExpires(page);

    await page
      .getByRole('navigation', { name: 'Reporting' })
      .getByRole('link', { name: 'Customers' })
      .click();

    await expect(page).toHaveURL(/\/login$/);
    expect(await readSession(page)).toBeNull();
  });

  test('signs an admin out when a refresh brings a token for a lesser role', async ({
    page,
    request,
    openAs,
  }) => {
    await setRoles(request, demoted, ['ADMIN']);
    await openAs(demoted, '/');
    await expect(page.getByRole('heading', { name: 'Activity', level: 1 })).toBeVisible();
    await expect(page.getByText('Notional traded')).toBeVisible();
    try {
      // The role change reaches the account's next token, which the expiry forces now.
      await setRoles(request, demoted, ['ANALYST']);
      await untilAccessTokenExpires(page);

      await page.getByRole('button', { name: '30D' }).click();

      // The service answers 403 to the analyst token on the console route; the app takes it as
      // a sign-in it no longer understands, ends it and says the account has no access.
      await expect(page).toHaveURL(/\/login\?reason=role$/);
      await expect(page.getByRole('status')).toContainText("doesn't have access to reporting");
      expect(await readSession(page)).toBeNull();
    } finally {
      await setRoles(request, demoted, ['ADMIN']);
    }
  });
});
