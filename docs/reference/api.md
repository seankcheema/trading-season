# API reference

This reference describes implemented controllers unless a section is explicitly labeled as planned or in progress. The Java and NestJS APIs have different identities and response formats; they are not interchangeable.

## Java backend: port 8080

Sources: [auth controller](../../apps/business-backend/src/main/java/com/neueda/leap/auth/AuthController.java), [user controller](../../apps/business-backend/src/main/java/com/neueda/leap/user/UserController.java), [security configuration](../../apps/business-backend/src/main/java/com/neueda/leap/auth/SecurityConfig.java).

The Java backend has no login and never receives a password. Sign-up and sign-in happen at the NestJS auth service; every Java endpoint except the account existence check requires its access token in an `Authorization: Bearer` header.

| Method and path | Request/authentication | Success |
| --- | --- | --- |
| POST /api/auth/account-exists | Public. JSON: email | 200: exists |
| POST /api/auth/register | Bearer access token. JSON: email, firstName, optional middleName, lastName, ssn, address, dateOfBirth, traderLevel, availableFunds | 201: userId, email |
| GET /api/users/me | Bearer access token | 200: caller's profile without ssn |

### Token verification

Tokens must be RS256 JWTs signed by the auth service. The backend fetches the public key from AUTH_JWK_SET_URI (the auth service's /.well-known/jwks.json) on the first authenticated request and caches it, so it does not call the auth service per request. A token is rejected with 401 when the signature does not verify, exp has passed, iss differs from AUTH_JWT_ISSUER, or sub is not a UUID. The roles claim becomes ROLE_ADMIN or ROLE_TRADER authorities.

The token's sub is the only identifier shared with the auth service. It becomes users.user_id at registration, and endpoints resolve the caller's data from sub rather than from ids in the path or body, so a client can only read its own account.

### Registration flow

1. Optionally call POST /api/auth/account-exists to warn that the email is already registered. The check ignores case and is a convenience only: it reveals whether an email is registered, so rate-limit it at the edge, and registration still enforces uniqueness.
2. Create credentials with POST /auth/register on the auth service and keep the returned accessToken.
3. Call POST /api/auth/register on the Java backend with that token and the profile fields. The password and confirmation stay with step 2.

Registration requires an email up to 100 characters that equals the token's email claim, ignoring case; nonblank names and address; ssn in XXX-XX-XXXX form; a past dateOfBirth; traderLevel BEGINNER, INTERMEDIATE or ADVANCED; and availableFunds of at least 5000.00 with at most two decimal places. See [registration constraints](../../apps/business-backend/src/main/java/com/neueda/leap/auth/RegisterRequest.java).

### Errors

Errors use an `{"error": "..."}` body. See [exception mapping](../../apps/business-backend/src/main/java/com/neueda/leap/auth/GlobalExceptionHandler.java) and [security error handling](../../apps/business-backend/src/main/java/com/neueda/leap/auth/SecurityErrorHandler.java).

| Status | Cause |
| --- | --- |
| 400 | Request validation failed; the message lists each invalid field |
| 401 | Missing, malformed, expired or untrusted access token; includes a WWW-Authenticate: Bearer header |
| 403 | Registration email does not match the token's email claim |
| 404 | GET /api/users/me before the caller has registered |
| 409 | The caller already registered, or the email belongs to another account |

## Trading API plan: status in progress

Status: In progress. These Java business-backend endpoints are planned for the simulated trading platform and are not implemented controllers yet. They are included here to track the intended API structure while development is underway.

Planned protected trading endpoints will use the [token verification](#token-verification) described above: clients send the auth service access token as a bearer token, and the Java backend scopes account and order resources to the token's sub.

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
| GET /api/me/accounts | Bearer token | Current user's accounts |
| POST /api/me/accounts | Bearer token; currency, optional initialDeposit | Created cash account |
| GET /api/accounts/{accountId}/holdings | Bearer token; owned account id | Account holdings with instrument metadata and latest price when available |
| GET /api/accounts/{accountId}/orders | Bearer token; optional status, instrumentId, limit | Account order history |
| GET /api/orders/{orderId} | Bearer token; owned order id | Order, fill if present, and audit events |
| POST /api/orders | Bearer token; accountId, ticker or instrumentId, orderType, quantity, clientReference, optional sessionId | Idempotent simulated order result |
| POST /api/accounts/{accountId}/cash-transactions | Bearer token; amount, reason DEPOSIT or WITHDRAWAL | Posted funding transaction and updated account cash |

MVP order execution is planned as an immediate simulated fill or rejection. Supported orders will execute against the latest seeded candle close for the instrument's linked simulator stock. The first slice will not include asynchronous matching, partial fills, or execution for instruments without simulated market data.

## NestJS auth service: port 3001

There is no /api prefix. Source: [controller](../../apps/auth-service/src/auth/auth.controller.ts).

| Method and path | Request/authentication | Success |
| --- | --- | --- |
| POST /auth/register | JSON: email, password | 201: accessToken, refreshToken, expiresIn |
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
