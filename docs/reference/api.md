# API Reference

This reference documents the HTTP contracts for each implemented microservice. Each service has independent authentication, response formats, and error handling. Planned endpoints are labeled as such; everything else is implemented and tested.

**Critical: See [Architecture](architecture.md) for the naming mismatch.** Holdings and Trade Service handles orders; Order and Sell Service does not.

## Auth Service (NestJS) — port 3001

Complete implementation. No `/api` prefix.

### Authentication endpoints

| Method | Path | Request | Success response |
| --- | --- | --- | --- |
| POST | /auth/register | JSON: `email` (valid, ≤254 chars), `password` (8–72 chars) | 201: `accessToken`, `refreshToken`, `expiresIn` |
| POST | /auth/login | JSON: `email`, `password` | 201: token response |
| POST | /auth/refresh | JSON: `refreshToken` string | 201: rotated token response |
| POST | /auth/logout | JSON: `refreshToken` string | 201: message; revokes session |
| GET | /.well-known/jwks.json | — (public) | 200: array of public JWK keys |
| GET | /health | — (public) | 200: status, service name, timestamp (liveness only) |

**Tokens:** RS256 JWTs valid for 15 minutes (900 seconds), containing `sub` (user UUID), `email`, `roles` (ADMIN or TRADER), `iss`, `iat`, `exp`. Refresh tokens are opaque random strings with 7-day server-side lifetime; they rotate on use and are revoked by logout.

**Validation:** Global validation pipe rejects unknown properties, mismatched types, and invalid values. Send all tokens as JSON body fields, not cookies.

**Errors:** Standard NestJS exception responses (not the Java `{"error": "..."}` format).
- 400 – validation failed (missing/invalid fields, extra properties)
- 401 – missing/invalid credentials or refresh token
- 409 – email already registered

---

## Holdings and Trade Service (Spring Boot Java 21) — port 8081

## Holdings and Trade Service (Spring Boot Java 21) — port 8081

### Authentication registration

| Method | Path | Request | Success | Notes |
| --- | --- | --- | --- | --- |
| POST | /api/auth/account-exists | Public JSON: `email` | 200: `exists` boolean | Check before register; rate-limit at edge |
| POST | /api/auth/register | Bearer token + JSON profile | 201: `userId`, `email` | Email must match token's `email` claim |
| GET | /api/users/me | Bearer token | 200: user profile | Returns caller only; excludes SSN |

**Registration profile fields:** (all required unless marked optional)
- `email` (must match token; ≤100 chars)
- `firstName`, `lastName`, `address` (nonblank)
- `middleName` (optional)
- `ssn` (XXX-XX-XXXX format)
- `dateOfBirth` (must be in past)
- `traderLevel` (BEGINNER, INTERMEDIATE, or ADVANCED)
- `availableFunds` (≥5000.00; max 2 decimal places)

**Token verification:** Each service caches the auth service's public JWKS independently. Tokens must:
- Use RS256 signature
- Not be expired (check `exp`)
- Have `iss` matching AUTH_JWT_ISSUER config
- Have valid UUID `sub` (becomes `users.user_id`)

**Data scope:** Endpoints resolve the caller from the bearer token's `sub` only. Clients cannot read other users' data even with explicit IDs in the path.

### Market data (public, unauthenticated)

| Method | Path | Query parameters | Success |
| --- | --- | --- | --- |
| GET | /api/market/snapshot | Optional `sessionId` | 200: current market state, all stock prices, trading calendar |
| GET | /api/market/candles | Required: `symbol`, `timeframe` (1D, 5D, 1M, 1Y); optional `sessionId` | 200: array of ≤500 OHLCV bars |
| GET | /api/market/stream | Optional `sessionId`, `Last-Event-ID` header | 200 text/event-stream: continuous price ticks |
| PUT | /api/market/clock | Bearer token + JSON: `timestamp` (ISO-8601); optional `sessionId` | 200: snapshot at nearest seeded tick ≤ timestamp |

**Candle aggregation:** Backend aggregates seeded 1-minute candles; does not emit raw 1-second history. Each timeframe caps results at 500 points.

**Clock changes:** Require bearer token (affects shared replay cursor). Non-trading dates within imported months advance to the nearest loaded trading date in that month.

**Stream:** Server-sent events containing synchronized price batches. Retains 30 events for reconnection via `Last-Event-ID`; outside that window, client receives resync event and must reload snapshot.

### Planned trading endpoints

These endpoints are documented in code and tests but **NOT YET IMPLEMENTED**. Do not call them yet.

| Method | Path | Request | Planned response |
| --- | --- | --- | --- |
| GET | /api/me/accounts | Bearer token | 200: array of caller's accounts |
| POST | /api/me/accounts | Bearer token + JSON: `name` only | 201: created account |
| PUT | /api/me/accounts/{accountId} | Bearer token + JSON: `name`; verify owned account | 200: renamed account |
| GET | /api/accounts/{accountId}/holdings | Bearer token; owned account | 200: holdings with instrument metadata |
| POST | /api/orders | Bearer token + JSON: accountId, ticker or instrumentId, orderType, quantity, clientReference, optional sessionId | 201: order result |
| GET | /api/orders/{orderId} | Bearer token; owned order | 200: order, fill if present, audit events |
| GET | /api/me/cash-transactions | Bearer token; optional limit | 200: user's cash transactions, newest first |
| POST | /api/me/cash-transactions | Bearer token + JSON: amount, reason (DEPOSIT or WITHDRAWAL) | 201: transaction and updated availableFunds |

See [Holdings and Trade Service documentation](services/holdings-and-trade-service.md) for what is actually implemented.

### Errors

Standard format: `{"error": "..."}` with HTTP status. Mismatched bearer token and request email produces 403. Always include `WWW-Authenticate: Bearer` challenge on 401.

| Status | Cause |
| --- | --- |
| 400 | Request validation failed; message lists each invalid field |
| 401 | Missing, malformed, expired or untrusted access token |
| 403 | Registration email does not match token's email claim |
| 404 | Resource not found (e.g., GET /api/users/me before registration) |
| 409 | Duplicate account or email; account already registered |

---

## Order and Sell Service (Spring Boot Java 21) — port 8082

**Current reality:** This service is not called by the Client UI. It is documented here for completeness.

**Implemented endpoints:**

| Method | Path | Request | Success |
| --- | --- | --- | --- |
| POST | /api/auth/register | Bearer token + profile (same contract as Holdings and Trade Service) | 201: userId, email |
| GET | /api/users/me | Bearer token | 200: caller's profile only |
| GET | /api/market/snapshot | Optional `sessionId` | 200: market snapshot (same as Holdings and Trade) |
| GET | /api/market/candles | Required: symbol, timeframe; optional sessionId | 200: OHLCV bars (same contract) |
| GET | /api/market/stream | Optional sessionId, Last-Event-ID | 200 text/event-stream (same contract) |

**NOT implemented despite README documentation:**
- Holdings queries
- Order history
- Order submission
- Account management

This service's README lists these as responsibilities, but the endpoints do not exist and repositories are unused.

**Why this gap exists:** The architecture called for splitting order processing from user profile reads, but the split was not completed in code. Holdings and Trade Service does both. See [Order and Sell Service documentation](services/order-and-sell-service.md) for discussion and suggested next steps.

---

## Client UI integration flow

The Angular UI (port 4200) orchestrates these services:

1. **Authentication:** Direct calls to Auth Service
   - POST /auth/register (create account)
   - POST /auth/login (sign in)
   - POST /auth/refresh (rotate expired token)
   - POST /auth/logout (end session)

2. **Profile and trading:** Calls to Holdings and Trade Service
   - Use dev proxy (proxy.conf.json) which forwards all `/api/*` to port 8081
   - Bearer token from Auth Service is sent in `Authorization: Bearer` header
   - POST /api/auth/register (submit profile after auth registration)
   - GET /api/users/me (verify profile)
   - GET /api/market/snapshot (dashboard ticker)
   - GET /api/market/candles (dashboard charts)
   - GET /api/market/stream (real-time prices)

3. **No calls to Order and Sell Service**
   - UI routing contains no `/api/orders` endpoint
   - Portfolio data is mock-only (not calling planned account endpoints)

Session management, inactivity timeout, and token refresh are handled by [SessionTimeoutService](../../apps/business-logic-ui/src/app/core/auth/session-timeout.service.ts) and [AuthService](../../apps/business-logic-ui/src/app/core/auth/auth.service.ts). Inactivity timeout (5–60 minutes, default 10) is UI-only; neither backend service implements it.

---

## E2E test coverage

The [Playwright suite](../../apps/business-logic-ui/e2e) covers:
- Full registration flow (auth service + Holdings and Trade Service profile registration)
- Sign-in and inactivity timeout
- Dashboard access and session persistence

Tests use a stand-in server that reproduces the contracts documented above. Update this reference and test expectations together.

---

## Contract maintenance

Update this reference in the same commit as endpoint changes. Proposed endpoints must be explicitly labeled. Key generation and environment setup belong in [Auth Service README](../../apps/auth-service/README.md); Java implementation details belong in source Javadocs.

Base path: /api/auth. Spring Boot source is rooted at [apps/business-backend/src/main/java/app](../../apps/business-backend/src/main/java/app), and these endpoints are implemented by [controller](../../apps/business-backend/src/main/java/app/auth/AuthController.java).

The Java backend has no login and never receives a password. Sign-up and sign-in happen at the NestJS auth service. User-specific endpoints and market mutations require its access token in an `Authorization: Bearer` header; the account existence check and read-only simulated market endpoints are public.

| Method and path | Request/authentication | Success |
| --- | --- | --- |
| POST /api/auth/account-exists | Public. JSON: email | 200: exists |
| POST /api/auth/register | Bearer access token. JSON: email, firstName, optional middleName, lastName, ssn, address, dateOfBirth, traderLevel, availableFunds | 201: userId, email |
| GET /api/users/me | Bearer access token | 200: caller's profile without ssn |

Registration takes no username and no password; the caller is identified by the bearer token. It requires a valid email up to 100 characters, nonblank firstName, lastName and address, an ssn in XXX-XX-XXXX form, a past dateOfBirth, a traderLevel of BEGINNER, INTERMEDIATE or ADVANCED, and availableFunds of at least 5000.00 with at most two decimal places. See [registration constraints](../../apps/business-backend/src/main/java/app/auth/RegisterRequest.java).

Errors use an error string: 400 for request validation, 409 for a duplicate account or email, 403 when the request email differs from the token's email claim, and 401 for a missing or untrusted token. See [exception mapping](../../apps/business-backend/src/main/java/app/auth/GlobalExceptionHandler.java).

### Token verification

Tokens must be RS256 JWTs signed by the auth service. The backend fetches the public key from AUTH_JWK_SET_URI (the auth service's /.well-known/jwks.json) on the first authenticated request and caches it, so it does not call the auth service per request. A token is rejected with 401 when the signature does not verify, exp has passed, iss differs from AUTH_JWT_ISSUER, or sub is not a UUID. The roles claim becomes ROLE_ADMIN or ROLE_TRADER authorities.

The token's sub is the only identifier shared with the auth service. It becomes users.user_id at registration, and endpoints resolve the caller's data from sub rather than from ids in the path or body, so a client can only read its own account.

### Registration flow

1. Optionally call POST /api/auth/account-exists to warn that the email is already registered. The check ignores case and is a convenience only: it reveals whether an email is registered, so rate-limit it at the edge, and registration still enforces uniqueness.
2. Create credentials with POST /auth/register on the auth service and keep the returned accessToken.
3. Call POST /api/auth/register on the Java backend with that token and the profile fields. The password and confirmation stay with step 2.

Registration requires an email up to 100 characters that equals the token's email claim, ignoring case; nonblank names and address; ssn in XXX-XX-XXXX form; a past dateOfBirth; traderLevel BEGINNER, INTERMEDIATE or ADVANCED; and availableFunds of at least 5000.00 with at most two decimal places. See [registration constraints](../../apps/business-backend/src/main/java/app/auth/RegisterRequest.java).

### Errors

Errors use an `{"error": "..."}` body. See [exception mapping](../../apps/business-backend/src/main/java/app/auth/GlobalExceptionHandler.java) and [security error handling](../../apps/business-backend/src/main/java/app/auth/SecurityErrorHandler.java).

| Status | Cause |
| --- | --- |
| 400 | Request validation failed; the message lists each invalid field |
| 401 | Missing, malformed, expired or untrusted access token; includes a WWW-Authenticate: Bearer header |
| 403 | Registration email does not match the token's email claim |
| 404 | GET /api/users/me before the caller has registered |
| 409 | The caller already registered, or the email belongs to another account |

## Java stock market API: port 8081

These public endpoints expose seeded stock data for the dashboard market ticker and future stock charts. Account, portfolio, holding, transaction, and order integration remains outside this slice; the dashboard portfolio chart still uses mock data.

Planned protected trading endpoints will use the [token verification](#token-verification) described above: clients send the auth service access token as a bearer token, and the Java backend scopes account and order resources to the token's sub.

### Stock endpoints

| Method and path | Request | Success |
| --- | --- | --- |
| GET /api/market/snapshot | Optional `sessionId` | Resolved simulation, replay cursor, market status, available clock range, and every seeded stock's company name, current price, current-session change, percentage change, and tick timestamp |
| GET /api/market/candles | Optional `sessionId`; required `symbol` and `timeframe` (`1D`, `5D`, `1M`, or `1Y`) | At most 500 chronological OHLCV buckets ending at the current replay cursor |
| GET /api/market/stream | Optional `sessionId`; optional `Last-Event-ID` request header | Server-sent event stream containing one synchronized price batch per simulated market second |
| PUT /api/market/clock | Bearer access token; optional `sessionId`; JSON `timestamp` as an ISO-8601 instant | Moves the shared replay cursor to the closest seeded tick at or before that time and returns a snapshot; non-trading dates inside an imported month use the nearest loaded trading date in that month, preferring the next trading date; months without seeded trading data return 400 |

Snapshots include a `calendar` object that describes the selectable imported archive range:

| Method and path | Request/authentication | Planned success |
| --- | --- | --- |
| GET /api/me/accounts | Bearer token | Current user's accounts |
| POST /api/me/accounts | Bearer token; name only | Created account with no holdings |
| PUT /api/me/accounts/{accountId} | Bearer token; owned account id; name | Renamed account |
| GET /api/accounts/{accountId}/holdings | Bearer token; owned account id | Account holdings with instrument metadata and latest price when available |
| GET /api/accounts/{accountId}/orders | Bearer token; optional status, instrumentId, limit | Account order history |
| GET /api/orders/{orderId} | Bearer token; owned order id | Order, fill if present, and audit events |
| POST /api/orders | Bearer token; accountId, ticker or instrumentId, orderType, quantity, clientReference, optional sessionId | Idempotent simulated order result |
| GET /api/me/cash-transactions | Bearer token; optional limit | Current user's cash transactions, newest first |
| POST /api/me/cash-transactions | Bearer token; amount, reason DEPOSIT or WITHDRAWAL | Posted funding transaction and updated availableFunds |

Manual clock changes are limited to the months imported for the resolved simulation session. A local development database can contain a small date range rather than the full generated dataset, so clients should validate against `tradingDates`, `firstTimestamp`, and `lastTimestamp` before calling `PUT /api/market/clock`. If a user selects a weekend or other non-trading date inside an imported month, clients may adjust to the nearest loaded trading date in that month before sending the request; the backend applies the same rule for direct API callers.

### Candle aggregation

The chart API queries the seeded one-minute candles rather than returning raw one-second history. Aggregation happens in the backend after filtering by simulation session, symbol, and the bounded timeframe.

| Timeframe | Planned buckets |
| --- | --- |
| `1D` | One-minute candles for the current trading session, up to 390 points |
| `5D` | Five-minute buckets over the latest five trading sessions, up to 390 points |
| `1M` | One-hour buckets over the preceding month |
| `1Y` | One daily bucket per trading session, up to 261 points |

Each aggregate uses the first open, maximum high, minimum low, final close, and summed volume in its bucket. Responses are always capped at 500 points. The current bucket is updated from live ticks every second instead of adding one chart point for every raw tick.

### Live stream

`GET /api/market/stream` uses `text/event-stream`. A `market-tick` event represents one simulated timestamp and contains the current tick for every available stock:

```json
{
  "eventId": 123456,
  "marketTimestamp": "2026-09-15T15:42:08Z",
  "serverTimestamp": "2026-09-15T20:42:08Z",
  "prices": [
    {
      "symbol": "AAPL",
      "price": 221.123456,
      "sequenceNumber": 48192
    }
  ]
}
```

One shared replay cursor per requested simulation advances at one simulated second per real second. The dashboard staggers the stocks in each synchronized batch across the following 0–1 second window so multiple prices visibly change without rerendering the entire row at once. It uses the current `America/Chicago` date and market time when that timestamp exists in the seed, chooses the nearest applicable seeded session otherwise, skips overnight and weekend gaps, and loops after the final seeded session. `MARKET_REPLAY_START_AT` may override this behavior with an ISO-8601 instant for deterministic tests and demonstrations. `marketTimestamp` is the simulated market time; `serverTimestamp` records delivery time.

The stream sends a heartbeat every 15 events and retains the latest 30 events for reconnection by `Last-Event-ID`. A client outside that window receives a resynchronization event and reloads the snapshot.

### Data access and safeguards

The replay service supports ticks stored either in PostgreSQL or in the archive location recorded in simulation metadata. It loads only the current trading day's required tick columns into a bounded server-side buffer, so emitting each second does not issue another database query or rescan a Parquet file. When a Parquet tick partition is unavailable but one-minute candles exist for the selected day, replay falls back to candle-close frames so manual clock changes still work at minute granularity.

The three GET endpoints are unauthenticated, read-only simulator operations. Clock changes require a bearer access token because they affect the shared replay for the selected simulation session. The implementation enforces configured CORS origins, validated and bounded parameters, REST rate limits, per-client and global stream connection limits, parameterized database queries, and sanitized request errors. Filesystem paths are never accepted from a request; Parquet access is derived only from trusted simulation metadata.

## NestJS auth service: port 3001

There is no /api prefix. Source: [controller](../../apps/auth-service/src/auth/auth.controller.ts).

| Method and path | Request/authentication | Success |
| --- | --- | --- |
| POST /auth/register | JSON: email, password | 201: accessToken, refreshToken, expiresIn |
| POST /auth/login | JSON: email, password | 201: same token response |
| POST /auth/refresh | JSON: refreshToken; no access JWT required | 201: rotated token response |
| POST /auth/logout | JSON: refreshToken; no access JWT required | 201: message after refresh-token revocation |
| GET /.well-known/jwks.json | Public | 200: keys array of public JWKs |
| GET /health | Public | 200: status, service, timestamp; liveness only |

Token response fields are defined in [AuthTokenDto](../../apps/auth-service/src/auth/dto/auth-token.dto.ts). Access tokens use RS256, expire after 900 seconds, and contain sub, email, roles, iss, iat, and exp. Roles are ADMIN or TRADER. Refresh tokens are opaque random strings with a seven-day server-side lifetime; they are not JWTs. Token verification is delegated to clients and services using the published JWKS document; there is no `/auth/verify` endpoint.

The auth service installs a global validation pipe with whitelisting, unknown-property rejection, and request transformation. Registration accepts only email and password: email must be a valid address up to 254 characters, and password must be 8-72 characters. Login accepts a valid email plus any non-empty password up to 72 characters. Refresh and logout accept only a non-empty `refreshToken` string up to 512 characters. Missing or invalid request fields produce 400, missing/invalid credentials and invalid refresh tokens produce 401, and extra JSON properties are rejected instead of silently stripped. Error bodies use NestJS exception responses rather than the Java error envelope.

Refresh rotates the stored token; replay of an unusable stored token revokes the user's live refresh sessions. Logout revokes the supplied refresh token and is deliberately unguarded so clients can end a session even after the access token expires. Send `refreshToken` in JSON for refresh and logout: cookie parsing is not installed in bootstrap. Access JWTs remain valid until expiry.

## UI integration

The Angular UI authenticates only against the NestJS auth service. See [AuthService](../../apps/business-logic-ui/src/app/core/auth/auth.service.ts).

- Sign-in posts email and password to POST /auth/login and stores the token response in browser localStorage.
- Registration first posts email and password to POST /auth/register. If that returns 409, the UI tries POST /auth/login with the same credentials, so a user whose earlier profile step failed can resubmit. Once it has tokens, the UI posts the profile to Java POST /api/auth/register with a Bearer access token: email, firstName, middleName, lastName, dateOfBirth, ssn, address, traderLevel, availableFunds. It sends no password or username. If the profile step fails, the UI clears the stored session.
- The dashboard route requires a stored session and refreshes an expired access token through POST /auth/refresh. Sign-out posts the refresh token to POST /auth/logout.
- The dashboard reads and changes the signed-in user's accounts and cash through the planned account endpoints above, which the Java backend does not serve yet; see [AccountStore](../../apps/business-logic-ui/src/app/dashboard/accounts/account-store.service.ts) and [the models it expects](../../apps/business-logic-ui/src/app/dashboard/accounts/account.models.ts). Cash belongs to the user, not to an account: it is availableFunds from GET /api/users/me, every account shares it, and deposits and withdrawals move it through /api/me/cash-transactions without naming an account. An account holds positions only, and its portfolio is exactly its holdings, so an account has one portfolio and a new account starts with none. Net worth is availableFunds plus the value of every account's holdings; the Portfolio Value card and assets table show the selected account's holdings. An account is returned as accountId, name and openedDate; a holding as symbol, quantity and averageCost, valued at the live price or at averageCost when there is none; a cash transaction as cashTransactionId, a positive amount, reason and createdAt. After every successful change the UI reloads the affected data rather than trusting the response body. It maps 400 to the backend's error string, 403 and 404 to an unavailable account, and 409 or 422 to a duplicate account name or, for withdrawals, insufficient funds. The UI lists only the accounts these endpoints return for the caller, requests holdings only for those, and sends no change for an account id outside that set; the backend must still enforce ownership from the token's sub.
- While a session is stored, the UI signs the user out after 10 minutes without mouse, keyboard, scroll or touch input, using the same POST /auth/logout call, then shows the login page with `?reason=inactive`. The limit can be set to 5, 10, 15, 30 or 60 minutes in the dashboard's Settings dialog, opened from the profile menu, and is kept per browser. The last activity time is shared between tabs and survives a reload. This is enforced by the UI only; neither service tracks inactivity. See [SessionTimeoutService](../../apps/business-logic-ui/src/app/core/auth/session-timeout.service.ts).

The registration, sign-in and inactivity timeout journeys are covered end to end by the [Playwright suite](../../apps/business-logic-ui/e2e), which drives the real application against a stand-in for both services. Its stand-in reproduces the contracts on this page, so update the two together.
