// Stand-in for the NestJS Auth Service, for the Reporting UI integration suite.
//
// It answers the four routes the Reporting UI and the Reporting Service use
// (POST /auth/login, /auth/refresh, /auth/logout and GET
// /.well-known/jwks.json), and signs access tokens with a real RS256 key made
// when it starts. The Reporting Service fetches the public key from the JWKS
// and verifies every token the way it does against the real service, so a
// token this issues is accepted or refused by the service's own checks. Like
// the real service, it signs without a key id.
//
// The people who can sign in are the staff of fixtures/scenario.json. A
// refresh token works once (tokens rotate) and is revoked by logout. A refresh
// reads the account's roles again, which is how a role change reaches a token.
//
// POST /__e2e/roles {email, roles} changes an account's roles for the next
// token. It is the one route the real service lacks and only a test calls it.
//
// Environment: PORT (default 3390), AUTH_JWT_ISSUER.

import { createServer } from 'node:http';
import { createSign, generateKeyPairSync, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const port = Number(process.env.PORT ?? 3390);
const issuer = process.env.AUTH_JWT_ISSUER ?? `http://127.0.0.1:${port}`;
const defaultAccessTokenSeconds = 900;

const scenario = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'scenario.json'),
    'utf8',
  ),
);
const accounts = new Map(
  scenario.staff.map((person) => [person.email.toLowerCase(), { ...person }]),
);
const refreshTokens = new Map();

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwks = {
  keys: [{ ...publicKey.export({ format: 'jwk' }), kid: 'e2e-key', use: 'sig', alg: 'RS256' }],
};

const base64url = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');

function accessToken(account) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const seconds = account.accessTokenSeconds ?? defaultAccessTokenSeconds;
  const unsigned = [
    base64url({ alg: 'RS256', typ: 'JWT' }),
    base64url({
      sub: account.userId,
      email: account.email,
      roles: account.roles,
      iss: issuer,
      iat: issuedAt,
      exp: issuedAt + seconds,
    }),
  ].join('.');
  return `${unsigned}.${createSign('RSA-SHA256').update(unsigned).sign(privateKey).toString('base64url')}`;
}

function issue(account) {
  const refreshToken = randomUUID();
  refreshTokens.set(refreshToken, account.email.toLowerCase());
  return {
    accessToken: accessToken(account),
    refreshToken,
    expiresIn: account.accessTokenSeconds ?? defaultAccessTokenSeconds,
  };
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    return {};
  }
}

function send(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json' });
  response.end(body === undefined ? undefined : JSON.stringify(body));
}

const server = createServer(async (request, response) => {
  const { pathname } = new URL(request.url, 'http://localhost');

  if (request.method === 'GET' && pathname === '/.well-known/jwks.json') {
    return send(response, 200, jwks);
  }
  if (request.method === 'GET' && pathname === '/health') {
    return send(response, 200, { status: 'ok' });
  }
  if (request.method !== 'POST') {
    return send(response, 404, { message: 'Not found' });
  }
  const body = await readJson(request);

  if (pathname === '/auth/login') {
    const account = accounts.get(String(body.email ?? '').toLowerCase());
    if (!account || account.password !== body.password) {
      return send(response, 401, { message: 'Invalid credentials' });
    }
    return send(response, 200, issue(account));
  }
  if (pathname === '/auth/refresh') {
    const email = refreshTokens.get(body.refreshToken);
    refreshTokens.delete(body.refreshToken);
    if (!email) {
      return send(response, 401, { message: 'Invalid refresh token' });
    }
    return send(response, 200, issue(accounts.get(email)));
  }
  if (pathname === '/auth/logout') {
    refreshTokens.delete(body.refreshToken);
    return send(response, 200, {});
  }
  if (pathname === '/__e2e/roles') {
    const account = accounts.get(String(body.email ?? '').toLowerCase());
    if (!account || !Array.isArray(body.roles)) {
      return send(response, 400, { message: 'Unknown account or roles' });
    }
    account.roles = body.roles;
    return send(response, 200, {});
  }
  return send(response, 404, { message: 'Not found' });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Auth stand-in listening on ${port}, issuer ${issuer}`);
});
