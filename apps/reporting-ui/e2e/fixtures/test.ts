import { type APIRequestContext, type Page, test as base } from '@playwright/test';
import { type Person, admin } from './scenario';

export const SESSION_KEY = 'ts.reporting.session';

export interface Tokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/** Signs in through the Auth Service's login route, on the UI's own origin as the browser would. */
export async function loginTokens(request: APIRequestContext, person: Person): Promise<Tokens> {
  const response = await request.post('/auth/login', {
    data: { email: person.email, password: person.password },
  });
  if (!response.ok()) {
    throw new Error(`Sign-in as ${person.email} answered ${response.status()}`);
  }
  return (await response.json()) as Tokens;
}

/** The session the app keeps in local storage, or null when nobody is signed in. */
export async function readSession(
  page: Page,
): Promise<{ accessToken: string; refreshToken: string; expiresAt: number } | null> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }, SESSION_KEY);
}

interface ReportingFixtures {
  /**
   * Opens a screen already signed in as the account. The sign-in is made over
   * the API and its tokens stored as the app stores them, so a spec about a
   * screen does not repeat the login form; sign-in.spec.ts drives that.
   */
  openAs: (person: Person, path?: string) => Promise<void>;
  /** Opens a screen as an admin. */
  openAsAdmin: (path?: string) => Promise<void>;
}

export const test = base.extend<ReportingFixtures>({
  openAs: async ({ page, request }, use) => {
    await use(async (person, path = '/') => {
      const tokens = await loginTokens(request, person);
      // Any file on the origin will do; the app itself is not loaded yet.
      await page.goto('/2b-waves.svg');
      await page.evaluate(([key, session]) => localStorage.setItem(key, JSON.stringify(session)), [
        SESSION_KEY,
        {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: Date.now() + tokens.expiresIn * 1000,
        },
      ] as const);
      await page.goto(path);
    });
  },
  openAsAdmin: async ({ openAs }, use) => {
    await use((path) => openAs(admin, path));
  },
});

export { expect } from '@playwright/test';
