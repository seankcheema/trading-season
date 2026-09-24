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

/** A position the business backend already holds in a seeded trading account. */
export interface SeedHolding {
  symbol: string;
  quantity: number;
  averageCost: number;
}

/** A trading account the business backend already holds for a seeded user. */
export interface SeedTradingAccount {
  name: string;
  /** The account's portfolio. */
  holdings?: SeedHolding[];
}

/** Credentials the stub already knows about when a test starts. */
export interface SeedAccount {
  email: string;
  password: string;
  /** Whether the business-backend profile step also completed for this account. */
  hasProfile?: boolean;
  /** Cash the user holds, shared by all of their trading accounts. Defaults to 5000. */
  availableFunds?: number;
  /** Trading accounts the business backend holds for this user. */
  tradingAccounts?: SeedTradingAccount[];
}

/** Trading account as GET /api/me/accounts returns it. */
export interface TradingAccount {
  accountId: number;
  name: string;
  openedDate: string;
}

/** Cash transaction as GET /api/me/cash-transactions returns it. */
export interface StoredCashTransaction {
  cashTransactionId: number;
  amount: number;
  reason: 'DEPOSIT' | 'WITHDRAWAL';
  createdAt: string;
}

interface OwnedTradingAccount extends TradingAccount {
  ownerId: string;
  holdings: SeedHolding[];
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
  /** Forces POST /api/me/accounts to fail with this status. */
  failAccountCreationWith?: number;
}

const ACCOUNT_PATH = /\/api\/me\/accounts\/(\d+)$/;
const HOLDINGS_PATH = /\/api\/accounts\/(\d+)\/holdings$/;
const NAME_MAX_LENGTH = 60;
const MAX_CASH_AMOUNT = 1_000_000;
const DEFAULT_FUNDS = 5000;

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
  private readonly failAccountCreationWith: number | null;

  // Business backend trading data. Account ids are sequential across users, as database keys
  // are, so a test can aim a request at another user's id. Cash lives on each user's profile
  // as availableFunds and is shared by all of that user's accounts.
  private readonly tradingAccounts: OwnedTradingAccount[] = [];
  private readonly cashTransactions = new Map<string, StoredCashTransaction[]>();
  private nextId = 1;

  constructor(options: StubOptions = {}) {
    this.accessTokenTtl = options.accessTokenTtlSeconds ?? ACCESS_TOKEN_TTL;
    this.failProfileWith = options.failProfileWith ?? null;
    this.failAccountCreationWith = options.failAccountCreationWith ?? null;
    for (const seed of options.accounts ?? []) {
      const account: StoredAccount = {
        id: randomUUID(),
        email: seed.email,
        passwordDigest: digest(seed.password),
        profile: seed.hasProfile
          ? { email: seed.email, availableFunds: seed.availableFunds ?? DEFAULT_FUNDS }
          : null,
      };
      this.accounts.set(seed.email.toLowerCase(), account);
      for (const trading of seed.tradingAccounts ?? []) {
        this.openTradingAccount(account.id, trading.name).holdings.push(
          ...(trading.holdings ?? []),
        );
      }
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
    await page.route('**/api/me/accounts', (route) => this.meAccounts(route));
    await page.route(ACCOUNT_PATH, (route) => this.renameAccount(route));
    await page.route(
      (url) => HOLDINGS_PATH.test(url.pathname),
      (route) => this.accountHoldings(route),
    );
    await page.route('**/api/me/cash-transactions**', (route) => this.meCashTransactions(route));
  }

  /** Trading accounts the business backend holds for a user, oldest first. */
  tradingAccountsOf(email: string): TradingAccount[] {
    const ownerId = this.accounts.get(email.toLowerCase())?.id;
    return this.tradingAccounts.filter((account) => account.ownerId === ownerId).map(publicAccount);
  }

  /** A trading account's holdings, which make up its portfolio. */
  holdingsOf(accountId: number): SeedHolding[] {
    return this.tradingAccounts.find((account) => account.accountId === accountId)?.holdings ?? [];
  }

  /** A user's cash, shared by all of their trading accounts. */
  fundsOf(email: string): number {
    return Number(this.accounts.get(email.toLowerCase())?.profile?.['availableFunds'] ?? 0);
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
        points: [
          {
            timestamp: '2026-01-05T15:00:00Z',
            open: 224.5,
            high: 226.2,
            low: 224.1,
            close: 225.8,
            volume: 1200,
          },
        ],
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
      stocks: [
        {
          symbol: 'AAPL',
          companyName: 'Apple Inc.',
          price: 225.8,
          change: 2.04,
          changePercent: 0.91,
          timestamp: '2026-01-05T15:00:00Z',
        },
      ],
    });
  }

  /** GET lists the caller's trading accounts; POST opens an empty one. */
  private async meAccounts(route: Route): Promise<void> {
    const ownerId = await this.caller(route);
    if (!ownerId) {
      return;
    }
    if (route.request().method() === 'GET') {
      await this.json(route, 200, this.ownedAccounts(ownerId).map(publicAccount));
      return;
    }
    if (this.failAccountCreationWith !== null) {
      await this.json(route, this.failAccountCreationWith, { error: 'Account creation rejected' });
      return;
    }

    const body = this.body(route);
    // A new account holds nothing: there is no opening deposit or balance to send.
    const unknown = Object.keys(body).filter((key) => key !== 'name');
    if (unknown.length) {
      await this.json(route, 400, { error: `Unrecognized field: ${unknown.join(', ')}` });
      return;
    }
    const name = accountName(body);
    if (!name) {
      await this.json(route, 400, { error: 'name: must be 1 to 60 characters' });
      return;
    }
    if (this.ownedAccounts(ownerId).some((account) => sameName(account.name, name))) {
      await this.json(route, 409, { error: 'An account with this name already exists' });
      return;
    }
    await this.json(route, 201, publicAccount(this.openTradingAccount(ownerId, name)));
  }

  /** PUT renames one of the caller's trading accounts. */
  private async renameAccount(route: Route): Promise<void> {
    const ownerId = await this.caller(route);
    if (!ownerId) {
      return;
    }
    const accountId = Number(ACCOUNT_PATH.exec(new URL(route.request().url()).pathname)?.[1]);
    const account = this.ownedAccounts(ownerId).find(
      (candidate) => candidate.accountId === accountId,
    );
    if (route.request().method() !== 'PUT' || !account) {
      await this.json(route, 404, { error: 'Account not found' });
      return;
    }
    const name = accountName(this.body(route));
    if (!name) {
      await this.json(route, 400, { error: 'name: must be 1 to 60 characters' });
      return;
    }
    if (
      this.ownedAccounts(ownerId).some(
        (other) => other.accountId !== accountId && sameName(other.name, name),
      )
    ) {
      await this.json(route, 409, { error: 'An account with this name already exists' });
      return;
    }
    account.name = name;
    await this.json(route, 200, publicAccount(account));
  }

  /** GET lists an owned account's holdings: its portfolio. */
  private async accountHoldings(route: Route): Promise<void> {
    const ownerId = await this.caller(route);
    if (!ownerId) {
      return;
    }
    const accountId = Number(HOLDINGS_PATH.exec(new URL(route.request().url()).pathname)?.[1]);
    const account = this.ownedAccounts(ownerId).find(
      (candidate) => candidate.accountId === accountId,
    );
    if (!account) {
      await this.json(route, 404, { error: 'Account not found' });
      return;
    }
    await this.json(route, 200, account.holdings);
  }

  /** GET lists the caller's cash transactions, newest first; POST deposits or withdraws. */
  private async meCashTransactions(route: Route): Promise<void> {
    const ownerId = await this.caller(route);
    if (!ownerId) {
      return;
    }
    const user = [...this.accounts.values()].find((candidate) => candidate.id === ownerId);
    if (!user?.profile) {
      await this.json(route, 404, { error: 'Account not found' });
      return;
    }
    const ledger = this.cashTransactions.get(ownerId) ?? [];

    if (route.request().method() === 'GET') {
      const limit = Number(new URL(route.request().url()).searchParams.get('limit') ?? 50);
      await this.json(route, 200, [...ledger].reverse().slice(0, limit));
      return;
    }

    const body = this.body(route);
    const amount = body['amount'];
    const reason = body['reason'];
    const funds = Number(user.profile['availableFunds'] ?? 0);
    if (typeof amount !== 'number' || amount <= 0 || amount > MAX_CASH_AMOUNT) {
      await this.json(route, 400, { error: 'amount: must be greater than 0' });
      return;
    }
    if (reason !== 'DEPOSIT' && reason !== 'WITHDRAWAL') {
      await this.json(route, 400, { error: 'reason: must be DEPOSIT or WITHDRAWAL' });
      return;
    }
    if (reason === 'WITHDRAWAL' && amount > funds) {
      await this.json(route, 422, { error: 'Insufficient funds' });
      return;
    }
    const transaction: StoredCashTransaction = {
      cashTransactionId: this.nextId++,
      amount,
      reason,
      createdAt: new Date().toISOString(),
    };
    this.cashTransactions.set(ownerId, [...ledger, transaction]);
    user.profile['availableFunds'] =
      Math.round((funds + (reason === 'DEPOSIT' ? amount : -amount)) * 100) / 100;
    await this.json(route, 201, transaction);
  }

  /** The token subject of an authenticated request, or null after answering it with 401. */
  private async caller(route: Route): Promise<string | null> {
    const authorization = route.request().headers()['authorization'];
    if (!authorization || !authorization.startsWith('Bearer ')) {
      await this.json(route, 401, { error: 'Missing access token' });
      return null;
    }
    return String(decodeJwtPayload(authorization.slice('Bearer '.length))['sub']);
  }

  private ownedAccounts(ownerId: string): OwnedTradingAccount[] {
    return this.tradingAccounts.filter((account) => account.ownerId === ownerId);
  }

  private openTradingAccount(ownerId: string, name: string): OwnedTradingAccount {
    const account: OwnedTradingAccount = {
      accountId: this.nextId++,
      ownerId,
      name,
      openedDate: new Date().toISOString().slice(0, 10),
      holdings: [],
    };
    this.tradingAccounts.push(account);
    return account;
  }

  private body(route: Route): Record<string, unknown> {
    return JSON.parse(route.request().postData() ?? '{}') as Record<string, unknown>;
  }

  private async json(route: Route, status: number, body: unknown): Promise<void> {
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  }
}

function publicAccount({ accountId, name, openedDate }: OwnedTradingAccount): TradingAccount {
  return { accountId, name, openedDate };
}

function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** The trimmed account name from a request body, or null when it is missing or too long. */
function accountName(body: Record<string, unknown>): string | null {
  const name = typeof body['name'] === 'string' ? body['name'].trim() : '';
  return name && name.length <= NAME_MAX_LENGTH ? name : null;
}
