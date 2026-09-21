import { createHash, createHmac, randomUUID } from 'node:crypto';
import type { Page, Route } from '@playwright/test';

/** Origin of the NestJS auth service, matching AUTH_API_URL in the application. */
export const AUTH_ORIGIN = 'http://localhost:3001';

/** Issuer claim the real auth service puts on access tokens. */
const ISSUER = 'https://auth.dualeapa.com';

/** Access token lifetime in seconds, matching AuthService.ACCESS_TOKEN_EXPIRATION. */
const ACCESS_TOKEN_TTL = 900;

/** One request the browser made, captured as it left the page. */
export interface RecordedRequest {
  method: string;
  url: string;
  /** Request body exactly as serialized onto the wire, or null for bodyless methods. */
  body: string | null;
  headers: Record<string, string>;
}

/** One API response the browser received, with its body. */
export interface RecordedResponse {
  url: string;
  status: number;
  body: string;
}

/** Credentials the stub already knows about when a test starts. */
export interface SeedAccount {
  email: string;
  password: string;
  /** Whether the business-backend profile step also completed for this account. */
  hasProfile?: boolean;
}

interface StoredAccount {
  id: string;
  email: string;
  /**
   * SHA-256 of the password. The stub stands in for a service that bcrypts
   * credentials, so it keeps a digest rather than the plaintext; tests assert
   * against the request transcript, never against stored credentials.
   */
  passwordDigest: string;
  profile: Record<string, unknown> | null;
}

export interface StubOptions {
  accounts?: SeedAccount[];
  /**
   * Overrides the access token lifetime. A value of zero expires the token
   * immediately, which is how a test reaches the refresh path the route
   * guards depend on.
   */
  accessTokenTtlSeconds?: number;
  /** Forces the business-backend profile step to fail with this status. */
  failProfileWith?: number;
}

function base64url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function digest(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

/**
 * Mints a structurally valid RS256 access token.
 *
 * The signature is an HMAC, not an RSA signature: the browser never verifies
 * it, and the only component that does verify it, the Java backend, is stubbed
 * here too. The header, claim set and base64url encoding match what the real
 * service issues, which is what the application and these tests read.
 */
function mintAccessToken(account: StoredAccount, ttlSeconds: number): string {
  const issuedAt = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: 'e2e-stub-key' }));
  const payload = base64url(
    JSON.stringify({
      sub: account.id,
      email: account.email,
      roles: ['TRADER'],
      iss: ISSUER,
      iat: issuedAt,
      exp: issuedAt + ttlSeconds,
    }),
  );
  const signature = createHmac('sha256', 'e2e-stub-not-an-rsa-key')
    .update(header + '.' + payload)
    .digest('base64url');
  return header + '.' + payload + '.' + signature;
}

/** Decodes an access token's claim set without verifying the signature. */
export function decodeJwtPayload(token: string): Record<string, unknown> {
  const payload = token.split('.')[1];
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, unknown>;
}

/**
 * In-memory stand-in for the NestJS auth service and the Java business
 * backend, installed on a page through Playwright request interception.
 *
 * It reproduces the status codes and bodies the application branches on: 409
 * on a taken email, 401 on bad credentials, 403 when the profile email differs
 * from the token claim. The Angular side under test is the real one, including
 * its router, guards, forms, HTTP interceptor and token storage.
 *
 * Every request the page makes is recorded, including ones the stub does not
 * answer, which is what the sensitive-data checks assert against.
 */
export class ApiStub {
  readonly requests: RecordedRequest[] = [];

  private readonly accounts = new Map<string, StoredAccount>();
  private readonly refreshTokens = new Map<string, string>();
  private readonly pendingResponses: Promise<RecordedResponse>[] = [];
  private readonly accessTokenTtl: number;
  private readonly failProfileWith: number | null;

  constructor(options: StubOptions = {}) {
    this.accessTokenTtl = options.accessTokenTtlSeconds ?? ACCESS_TOKEN_TTL;
    this.failProfileWith = options.failProfileWith ?? null;
    for (const seed of options.accounts ?? []) {
      this.accounts.set(seed.email.toLowerCase(), {
        id: randomUUID(),
        email: seed.email,
        passwordDigest: digest(seed.password),
        profile: seed.hasProfile ? { email: seed.email } : null,
      });
    }
  }

  async install(page: Page): Promise<void> {
    page.on('request', (request) => {
      this.requests.push({
        method: request.method(),
        url: request.url(),
        body: request.postData(),
        headers: request.headers(),
      });
    });

    page.on('response', (response) => {
      const url = response.url();
      // Only API traffic: reading every bundle and asset body would be slow
      // and tells us nothing about where the secrets went.
      if (!url.startsWith(AUTH_ORIGIN) && !url.includes('/api/')) {
        return;
      }
      this.pendingResponses.push(
        response.text().then(
          (body) => ({ url, status: response.status(), body }),
          () => ({ url, status: response.status(), body: '' }),
        ),
      );
    });

    await page.route(AUTH_ORIGIN + '/auth/register', (route) => this.registerCredentials(route));
    await page.route(AUTH_ORIGIN + '/auth/login', (route) => this.login(route));
    await page.route(AUTH_ORIGIN + '/auth/refresh', (route) => this.refresh(route));
    await page.route(AUTH_ORIGIN + '/auth/logout', (route) => this.logout(route));
    await page.route('**/api/auth/register', (route) => this.registerProfile(route));
    await page.route('**/api/auth/account-exists', (route) => this.accountExists(route));
    await page.route('**/api/users/me', (route) => this.ownProfile(route));
    await page.route('**/api/market/**', (route) => this.market(route));
  }

  /** Every request whose URL or body contains the value, in wire order. */
  requestsContaining(value: string): RecordedRequest[] {
    return this.requests.filter(
      (request) => request.url.includes(value) || (request.body ?? '').includes(value),
    );
  }

  /** Every API response body the page received, once all of them have been read. */
  async apiResponses(): Promise<RecordedResponse[]> {
    return Promise.all(this.pendingResponses);
  }

  /** The profile the business backend received, or null if it was never called. */
  storedProfile(email: string): Record<string, unknown> | null {
    return this.accounts.get(email.toLowerCase())?.profile ?? null;
  }

  private tokenResponse(account: StoredAccount) {
    const refreshToken = Buffer.from(randomUUID() + randomUUID()).toString('base64url');
    this.refreshTokens.set(refreshToken, account.id);
    return {
      accessToken: mintAccessToken(account, this.accessTokenTtl),
      refreshToken,
      expiresIn: this.accessTokenTtl,
    };
  }

  private async registerCredentials(route: Route): Promise<void> {
    const body = this.body(route);
    const key = String(body['email']).toLowerCase();

    if (this.accounts.has(key)) {
      // Matches UsersService.create. The UI reads this as "credentials already
      // exist", and retries login so it can resume from the profile step.
      await this.json(route, 409, {
        statusCode: 409,
        message: 'Email is already in use',
        error: 'Conflict',
      });
      return;
    }

    const account: StoredAccount = {
      id: randomUUID(),
      email: String(body['email']),
      passwordDigest: digest(String(body['password'])),
      profile: null,
    };
    this.accounts.set(key, account);
    await this.json(route, 201, this.tokenResponse(account));
  }

  private async login(route: Route): Promise<void> {
    const body = this.body(route);
    const account = this.accounts.get(String(body['email']).toLowerCase());

    if (!account || account.passwordDigest !== digest(String(body['password']))) {
      // The real service returns the same generic 401 for every rejection path.
      await this.json(route, 401, {
        statusCode: 401,
        message: 'Invalid credentials',
        error: 'Unauthorized',
      });
      return;
    }
    await this.json(route, 201, this.tokenResponse(account));
  }

  private async refresh(route: Route): Promise<void> {
    const presented = String(this.body(route)['refreshToken']);
    const userId = this.refreshTokens.get(presented);
    const account = [...this.accounts.values()].find((candidate) => candidate.id === userId);

    if (!account) {
      await this.json(route, 401, {
        statusCode: 401,
        message: 'Invalid refresh token',
        error: 'Unauthorized',
      });
      return;
    }
    // Rotation: the presented token is spent whether or not the caller reuses it.
    this.refreshTokens.delete(presented);
    await this.json(route, 201, this.tokenResponse(account));
  }

  private async logout(route: Route): Promise<void> {
    this.refreshTokens.delete(String(this.body(route)['refreshToken']));
    await this.json(route, 201, { message: 'Logged out successfully' });
  }

  private async registerProfile(route: Route): Promise<void> {
    const authorization = route.request().headers()['authorization'];
    if (!authorization || !authorization.startsWith('Bearer ')) {
      await this.json(route, 401, { error: 'Missing access token' });
      return;
    }
    if (this.failProfileWith !== null) {
      await this.json(route, this.failProfileWith, { error: 'Profile step rejected' });
      return;
    }

    const claims = decodeJwtPayload(authorization.slice('Bearer '.length));
    const profile = this.body(route);
    const email = String(profile['email']);

    if (String(claims['email']).toLowerCase() !== email.toLowerCase()) {
      await this.json(route, 403, { error: 'Email does not match the signed-in account' });
      return;
    }

    const account = this.accounts.get(email.toLowerCase());
    if (!account || account.profile) {
      await this.json(route, 409, { error: 'Account is already registered' });
      return;
    }

    account.profile = profile;
    await this.json(route, 201, { userId: account.id, email: account.email });
  }

  private async accountExists(route: Route): Promise<void> {
    const email = String(this.body(route)['email']).toLowerCase();
    await this.json(route, 200, { exists: this.accounts.has(email) });
  }

  private async ownProfile(route: Route): Promise<void> {
    const authorization = route.request().headers()['authorization'];
    if (!authorization || !authorization.startsWith('Bearer ')) {
      await this.json(route, 401, { error: 'Missing access token' });
      return;
    }

    const claims = decodeJwtPayload(authorization.slice('Bearer '.length));
    const account = this.accounts.get(String(claims['email']).toLowerCase());
    if (!account || !account.profile) {
      await this.json(route, 404, { error: 'Account not found' });
      return;
    }

    // Mirrors UserProfileResponse, which deliberately omits the SSN.
    const { ssn: _ssn, ...withoutSsn } = account.profile;
    await this.json(route, 200, {
      userId: account.id,
      userRole: 'TRADER',
      accountStatus: 'ACTIVE',
      createdAt: new Date().toISOString(),
      ...withoutSsn,
    });
  }

  /**
   * Answers the dashboard's market calls with the smallest valid payloads. The
   * dashboard is the destination of both journeys under test, not the subject
   * of them, so this only needs to keep it from erroring on load.
   */
  private async market(route: Route): Promise<void> {
    const url = new URL(route.request().url());

    if (url.pathname.endsWith('/market/stream')) {
      // Server-sent events cannot be usefully faked through a fulfilled route;
      // closing the stream immediately makes the dashboard report it offline.
      await route.fulfill({ status: 204, contentType: 'text/event-stream', body: '' });
      return;
    }
    if (url.pathname.endsWith('/market/candles')) {
      await this.json(route, 200, {
        sessionId: 1,
        symbol: url.searchParams.get('symbol') ?? 'AAPL',
        timeframe: url.searchParams.get('timeframe') ?? '1D',
        marketTimestamp: '2026-01-05T15:00:00Z',
        points: [],
      });
      return;
    }
    await this.json(route, 200, {
      sessionId: 1,
      status: 'OPEN',
      marketTimestamp: '2026-01-05T15:00:00Z',
      serverTimestamp: new Date().toISOString(),
      calendar: {
        timezone: 'America/Chicago',
        firstTimestamp: '2026-01-05T14:30:00Z',
        lastTimestamp: '2026-01-05T20:59:59Z',
        tradingDates: ['2026-01-05'],
      },
      stocks: [],
    });
  }

  private body(route: Route): Record<string, unknown> {
    return JSON.parse(route.request().postData() ?? '{}') as Record<string, unknown>;
  }

  private async json(route: Route, status: number, body: unknown): Promise<void> {
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  }
}
