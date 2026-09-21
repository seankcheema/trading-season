# API reference

This reference describes implemented controllers unless a section is explicitly labeled as planned or in progress. The Java and NestJS APIs have different identities and response formats; they are not interchangeable.

## Java backend: port 8081

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
| POST /api/me/accounts | Bearer token; currency, optional initialDeposit | Created cash account |
| GET /api/accounts/{accountId}/holdings | Bearer token; owned account id | Account holdings with instrument metadata and latest price when available |
| GET /api/accounts/{accountId}/orders | Bearer token; optional status, instrumentId, limit | Account order history |
| GET /api/orders/{orderId} | Bearer token; owned order id | Order, fill if present, and audit events |
| POST /api/orders | Bearer token; accountId, ticker or instrumentId, orderType, quantity, clientReference, optional sessionId | Idempotent simulated order result |
| POST /api/accounts/{accountId}/cash-transactions | Bearer token; amount, reason DEPOSIT or WITHDRAWAL | Posted funding transaction and updated account cash |

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
- While a session is stored, the UI signs the user out after 10 minutes without mouse, keyboard, scroll or touch input, using the same POST /auth/logout call, then shows the login page with `?reason=inactive`. The limit can be set to 5, 10, 15, 30 or 60 minutes in the dashboard's Settings dialog, opened from the profile menu, and is kept per browser. The last activity time is shared between tabs and survives a reload. This is enforced by the UI only; neither service tracks inactivity. See [SessionTimeoutService](../../apps/business-logic-ui/src/app/core/auth/session-timeout.service.ts).

The registration, sign-in and inactivity timeout journeys are covered end to end by the [Playwright suite](../../apps/business-logic-ui/e2e), which drives the real application against a stand-in for both services. Its stand-in reproduces the contracts on this page, so update the two together.

## Contract maintenance

Update this reference and relevant tests in the same change as endpoint behavior. Proposed endpoints must be clearly labeled as planned or in progress until implemented. Key generation and environment setup belong in the [auth README](../../apps/auth-service/README.md); Java implementation details belong in source Javadocs.
