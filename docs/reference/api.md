# API reference

This reference describes implemented controllers unless a section is explicitly labeled as planned or in progress. The Java and NestJS APIs have different identities and response formats; they are not interchangeable.

## Java backend: port 8081

Base path: /api/auth. Source: [controller](../../apps/business-backend/src/main/java/com/neueda/leap/auth/AuthController.java).

| Method and path | Request | Success |
| --- | --- | --- |
| POST /api/auth/register | username, email, password, firstName, optional middleName, lastName, ssn, address, dateOfBirth | 201: userId, username, email |
| POST /api/auth/login | username, password | 200: sessionId, expiresAt |

Registration requires a 3–50 character username, valid email up to 100 characters, password of 8–100 characters, nonblank profile fields, and a past dateOfBirth. See [registration constraints](../../apps/business-backend/src/main/java/com/neueda/leap/auth/RegisterRequest.java).

Errors use an error string: 400 for request validation, 409 for duplicate username/email, and 401 for invalid credentials or inactive/locked accounts. See [exception mapping](../../apps/business-backend/src/main/java/com/neueda/leap/auth/GlobalExceptionHandler.java). Login returns a database session, not a JWT.

## Java stock market API: port 8081

These public endpoints expose seeded stock data for the dashboard market ticker and future stock charts. Account, portfolio, holding, transaction, and order integration remains outside this slice; the dashboard portfolio chart still uses mock data.

The API defaults to the newest completed simulation session when `sessionId` is omitted. Requests that supply a session must identify a completed session. Unknown sessions, symbols, and timeframes are rejected.

### Public stock endpoints

| Method and path | Request | Success |
| --- | --- | --- |
| GET /api/market/snapshot | Optional `sessionId` | Resolved simulation, replay cursor, market status, available clock range, and every seeded stock's company name, current price, current-session change, percentage change, and tick timestamp |
| GET /api/market/candles | Optional `sessionId`; required `symbol` and `timeframe` (`1D`, `5D`, `1M`, or `1Y`) | At most 500 chronological OHLCV buckets ending at the current replay cursor |
| GET /api/market/stream | Optional `sessionId`; optional `Last-Event-ID` request header | Server-sent event stream containing one synchronized price batch per simulated market second |
| PUT /api/market/clock | Optional `sessionId`; JSON `timestamp` as an ISO-8601 instant | Moves the shared replay cursor to the closest seeded tick at or before that time and returns a snapshot; non-trading dates inside an imported month use the nearest loaded trading date in that month, preferring the next trading date; months without seeded trading data return 400 |

Snapshots include a `calendar` object that describes the selectable imported archive range:

```json
{
  "timezone": "America/Chicago",
  "firstTimestamp": "2026-01-05T14:30:00Z",
  "lastTimestamp": "2026-12-31T20:59:59Z",
  "tradingDates": ["2026-01-05", "2026-01-06"]
}
```

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

These endpoints are unauthenticated simulator operations; the clock change affects the shared replay for the selected simulation session. The implementation enforces configured CORS origins, validated and bounded parameters, REST rate limits, per-client and global stream connection limits, parameterized database queries, and sanitized request errors. Filesystem paths are never accepted from a request; Parquet access is derived only from trusted simulation metadata.

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

## Contract maintenance

Update this reference and relevant tests in the same change as endpoint behavior. Proposed endpoints must be clearly labeled as planned or in progress until implemented. Key generation and environment setup belong in the [auth README](../../apps/auth-service/README.md); Java implementation details belong in source Javadocs.
