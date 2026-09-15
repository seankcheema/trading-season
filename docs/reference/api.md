# API reference

This reference describes implemented controllers unless a section is explicitly labeled as planned or in progress. The Java and NestJS APIs have different identities and response formats; they are not interchangeable.

## Java backend: port 8080

Base path: /api/auth. Source: [controller](../../apps/business-backend/src/main/java/com/neueda/leap/auth/AuthController.java).

| Method and path | Request | Success |
| --- | --- | --- |
| POST /api/auth/register | username, email, password, firstName, optional middleName, lastName, ssn, address, dateOfBirth | 201: userId, username, email |
| POST /api/auth/login | username, password | 200: sessionId, expiresAt |

Registration requires a 3–50 character username, valid email up to 100 characters, password of 8–100 characters, nonblank profile fields, and a past dateOfBirth. See [registration constraints](../../apps/business-backend/src/main/java/com/neueda/leap/auth/RegisterRequest.java).

Errors use an error string: 400 for request validation, 409 for duplicate username/email, and 401 for invalid credentials or inactive/locked accounts. See [exception mapping](../../apps/business-backend/src/main/java/com/neueda/leap/auth/GlobalExceptionHandler.java). Login returns a database session, not a JWT.

## Trading API plan: status in progress

Status: In progress. This plan covers only the public, read-only stock data required by the dashboard market ticker and selected-stock price chart. These endpoints are not implemented controllers yet. Account, portfolio, holding, transaction, and order integration is outside this slice.

The API will default to the newest completed simulation session when `sessionId` is omitted. Requests that supply a session must identify a completed session. Unknown sessions, symbols, and timeframes will be rejected.

### Public stock endpoints

| Method and path | Request | Planned success |
| --- | --- | --- |
| GET /api/market/snapshot | Optional `sessionId` | Resolved simulation, replay cursor, market status, and every seeded stock's company name, current price, current-session change, percentage change, and tick timestamp |
| GET /api/market/candles | Optional `sessionId`; required `symbol` and `timeframe` (`1D`, `5D`, `1W`, `1M`, or `1Y`) | At most 500 chronological OHLCV buckets ending at the current replay cursor |
| GET /api/market/stream | Optional `sessionId`; optional `Last-Event-ID` request header | Server-sent event stream containing one synchronized price batch per simulated market second |

### Candle aggregation

The chart API will query the seeded one-minute candles rather than returning raw one-second history. Aggregation happens in the backend after filtering by simulation session, symbol, and the bounded timeframe.

| Timeframe | Planned buckets |
| --- | --- |
| `1D` | One-minute candles for the current trading session, up to 390 points |
| `5D` | Five-minute buckets over the latest five trading sessions, up to 390 points |
| `1W` | Thirty-minute buckets for trading sessions in the preceding seven calendar days |
| `1M` | One-hour buckets over the preceding month |
| `1Y` | One daily bucket per trading session, up to 261 points |

Each aggregate uses the first open, maximum high, minimum low, final close, and summed volume in its bucket. Responses are always capped at 500 points. The current bucket is updated from live ticks every second instead of adding one chart point for every raw tick.

### Live stream

`GET /api/market/stream` will use `text/event-stream`. A `market-tick` event represents one simulated timestamp and contains the current tick for every available stock:

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

One shared replay cursor will advance at one simulated second per real second. It will use the current `America/Chicago` date and market time when that timestamp exists in the seed, choose the nearest applicable seeded session otherwise, skip overnight and weekend gaps, and loop after the final seeded session. A configured start timestamp may override this behavior for deterministic tests and demonstrations. `marketTimestamp` is the simulated market time; `serverTimestamp` records delivery time.

The stream will send a heartbeat every 15 seconds and retain 30 seconds of events for reconnection by `Last-Event-ID`. A client outside that window will receive a resynchronization event and reload the snapshot and candle history.

### Data access and safeguards

The replay service will support ticks stored either in PostgreSQL or in the archive location recorded in simulation metadata. It will load only the current trading day's required tick columns into a bounded server-side buffer, so emitting each second does not issue another database query or rescan a Parquet file.

These endpoints remain unauthenticated reference-data reads. The implementation will enforce configured CORS origins, validated and bounded parameters, REST rate limits, per-client and global stream connection limits, parameterized database queries, and sanitized error responses. Filesystem paths will never be accepted from a request; Parquet access will be derived only from trusted simulation metadata.

## NestJS auth service: port 3001

There is no /api prefix. Source: [controller](../../apps/auth-service/src/auth/auth.controller.ts).

| Method and path | Request/authentication | Success |
| --- | --- | --- |
| POST /auth/register | JSON: username, email, password, firstName, lastName | 201: accessToken, refreshToken, expiresIn |
| POST /auth/login | JSON: email, password | 201: same token response |
| POST /auth/refresh | JSON: refreshToken; no access JWT required | 201: rotated token response |
| GET /auth/verify | Authorization: Bearer accessToken | 200: valid and user claims |
| POST /auth/logout | Authorization: Bearer accessToken | 201: message; see revocation limitation below |
| GET /.well-known/jwks.json | Public | 200: keys array of public JWKs |
| GET /health | Public | 200: status, service, timestamp; liveness only |

Token response fields are defined in [AuthTokenDto](../../apps/auth-service/src/auth/dto/auth-token.dto.ts). Access tokens use RS256, expire after 900 seconds, and contain sub, email, roles, iss, iat, and exp. Roles are ADMIN or TRADER. Refresh tokens are opaque random strings with a seven-day server-side lifetime; they are not JWTs.

Registration checks required fields and a minimum password length of eight in the service. Missing/invalid credentials and invalid refresh tokens produce 401; missing registration fields or short passwords produce 400. Do not infer validation from DTO property declarations: no global validation pipe is installed. Error bodies use NestJS exception responses rather than the Java error envelope.

Refresh rotates the stored token; replay of an unusable stored token revokes the user's live refresh sessions. Send refreshToken in JSON: cookie parsing is not installed in bootstrap.

### Current logout limitation

The controller passes the access JWT to a service that looks up refresh-token hashes. Its success message does not establish refresh-token revocation. Access JWTs remain valid until expiry. This documentation records the mismatch without changing behavior.

## Contract maintenance

Update this reference and relevant tests in the same change as endpoint behavior. Proposed endpoints must be clearly labeled as planned or in progress until implemented. Key generation and environment setup belong in the [auth README](../../apps/auth-service/README.md); Java implementation details belong in source Javadocs.
