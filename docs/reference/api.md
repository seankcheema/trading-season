# API reference

This reference describes implemented controllers unless a section is explicitly labeled as planned or in progress. The Java and NestJS APIs have different identities and response formats; they are not interchangeable.

## Java backend: port 8080

Base path: /api/auth. Spring Boot source is rooted at [apps/business-backend/src/main/java/app](../../apps/business-backend/src/main/java/app), and these endpoints are implemented by [controller](../../apps/business-backend/src/main/java/app/auth/AuthController.java).

| Method and path | Request | Success |
| --- | --- | --- |
| POST /api/auth/register | username, email, password, firstName, optional middleName, lastName, ssn, address, dateOfBirth | 201: userId, username, email |
| POST /api/auth/login | username, password | 200: sessionId, expiresAt |

Registration requires a 3–50 character username, valid email up to 100 characters, password of 8–100 characters, nonblank profile fields, and a past dateOfBirth. See [registration constraints](../../apps/business-backend/src/main/java/app/auth/RegisterRequest.java).

Errors use an error string: 400 for request validation, 409 for duplicate username/email, and 401 for invalid credentials or inactive/locked accounts. See [exception mapping](../../apps/business-backend/src/main/java/app/auth/GlobalExceptionHandler.java). Login returns a database session, not a JWT.

## Trading API plan: status in progress

Status: In progress. These Java business-backend endpoints are planned for the simulated trading platform and are not implemented controllers yet. They are included here to track the intended API structure while development is underway.

Planned protected trading endpoints will use the existing Java session flow: clients authenticate with POST /api/auth/login and send the returned sessionId in an X-Session-Id header. The Java backend will validate that the session exists, is not expired, and is not revoked before allowing access to account or order resources.

### Public/reference endpoints

| Method and path | Request | Planned success |
| --- | --- | --- |
| GET /api/simulations | Optional paging/filter parameters | List simulation sessions, newest first |
| GET /api/simulations/{sessionId} | Path session id | Simulation session metadata and status |
| GET /api/stocks | Optional symbol filter | Seeded simulator stocks |
| GET /api/instruments | Optional assetClass, market, and tradable filters | Tradable instruments and simulator linkage |
| GET /api/market/candles | sessionId, symbol, interval, optional from, to, limit | OHLCV candles ordered by timestamp |
| GET /api/market/prices/latest | sessionId, optional repeated symbol | Latest available candle close per symbol |

### Protected trading endpoints

| Method and path | Request/authentication | Planned success |
| --- | --- | --- |
| GET /api/me/accounts | X-Session-Id | Current user's accounts |
| POST /api/me/accounts | X-Session-Id; currency, optional initialDeposit | Created cash account |
| GET /api/accounts/{accountId}/holdings | X-Session-Id; owned account id | Account holdings with instrument metadata and latest price when available |
| GET /api/accounts/{accountId}/orders | X-Session-Id; optional status, instrumentId, limit | Account order history |
| GET /api/orders/{orderId} | X-Session-Id; owned order id | Order, fill if present, and audit events |
| POST /api/orders | X-Session-Id; accountId, ticker or instrumentId, orderType, quantity, clientReference, optional sessionId | Idempotent simulated order result |
| POST /api/accounts/{accountId}/cash-transactions | X-Session-Id; amount, reason DEPOSIT or WITHDRAWAL | Posted funding transaction and updated account cash |

MVP order execution is planned as an immediate simulated fill or rejection. Supported orders will execute against the latest seeded candle close for the instrument's linked simulator stock. The first slice will not include asynchronous matching, partial fills, or execution for instruments without simulated market data.

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
