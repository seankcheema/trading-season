# API Reference

This reference documents the HTTP contracts for each implemented microservice. Each service has independent authentication, response formats, and error handling. Planned endpoints are labeled as such; everything else is implemented and tested.

**Critical:** See [Architecture](architecture.md) for service responsibilities after the KAN-47/KAN-139 restructuring fix. Order and Sell Service (port 8081) handles order operations and is called by Client UI. Holdings and Trade Service (port 8082) provides user profile and account queries.

## Auth Service (NestJS) - port 3001

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

## Order and Sell Service (Spring Boot Java 21) — port 8081

This service is the primary backend for Client UI. It implements order operations and validates all trades.

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
- `ssn` (NNN-NN-NNNN format)
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

### Trading endpoints

| Method | Path | Request | Success |
| --- | --- | --- | --- |
| POST | /api/orders | Bearer token + JSON: `accountId`, `instrumentId`, `orderType` (BUY or SELL), `quantity` (> 0), `indicativePrice` (> 0), optional `bufferPercent` (>= 0), `clientReference` (UUID idempotency key), optional `simulatedAt` (ISO-8601 timestamp with offset) | 201: `orderId`, `instrumentId`, `accountId`, `status`, `orderType`, `quantity`, `indicativePrice`, `rejectionReason`, `submittedAt`, `resolvedAt`, `simulatedAt` |
| GET | /api/orders | Bearer token | 200: array of the caller's orders, newest first, each in the same shape as the POST response |
| GET | /api/instruments | Bearer token | 200: array of every instrument by ticker, each with `instrumentId`, `ticker`, `name`, `assetClass`, `market`, `currency`, `tradable`, `simulatedStockSymbol` |

**Order lifecycle (KAN-93):** an order is created `PENDING`, then the trading rules run: the caller still has a credential record, a buy is affordable, a sell is covered by holdings, and the instrument is tradable. A failed rule leaves the order `REJECTED` with a `rejectionReason`. Otherwise the fill is written and the order moves to `FILLED`, its final state. Every transition is recorded in `audit_trail`. A rejection is still a 201 response: it describes a failed trade, not a failed request. A missing credential record rejects the trade without fill, cash-transaction, or holding-movement rows. Account activation status remains removed. Persistence failures roll back the submission and its ledger writes together; integrity conflicts return 409.

Orders record optional `simulatedAt` from the ticket's current selected replay time. Moving the simulation backward is supported. Real `submittedAt`, `resolvedAt`, and `fills.filled_at` remain server-generated audit times. Old clients and historical orders may omit simulated time; recent activity then uses real execution time. Idempotent retries preserve the original timestamp. The [canonical schema](../../apps/market-data/db/migrations/V001__Initialize_database.sql) includes this column. Persisted portfolio observations continue to use real audit dates. When a simulation clock is available, the dashboard projects holdings, shared cash, net worth, and portfolio history at that selected clock instead. Future filled trades are hidden and their effects are reversed from the displayed balances; rewinding never executes an order again. Current funding is the starting budget, so deposits and withdrawals do not rewind. History combines effective share quantities with replay candles, with acquisition cost as the fallback where no earlier quote exists. Positions without dated orders are starting positions. The server still owns the actual balances and validates new submissions against them; navigation changes only the view.

**Funds:** cash belongs to the user, not to an account. A buy is rejected when `quantity * indicativePrice` exceeds the caller's `availableFunds`, the value returned by `GET /api/users/me`. A filled buy decreases `availableFunds` by that amount and a filled sell increases it. `accounts.cash_balance` is not moved. Orders currently fill at `indicativePrice`; see [OrderExecutionService](../../apps/order-and-sell-service/src/main/java/app/order/execution/OrderExecutionService.java).

The dashboard recent transactions merges cash transfers with filled orders across the caller's accounts, ordered by `simulatedAt` for executions (falling back to `resolvedAt` when absent) and `createdAt` for cash transfers. It shows the latest 20 entries, excluding trades whose effective time is later than the simulation cursor. Cash transfers remain visible as changes to the starting budget. Instrument reference data supplies the stock symbol; trade amounts are `quantity * indicativePrice`, negative for buys and positive for sells. Pending and rejected orders are excluded. Order history already stores these timestamps; showing cash and executions requires no additional migration. Selected replay time is stored separately in `orders.simulated_at`.

**Order history:** `GET /api/orders` returns every order placed on any account the caller owns, newest `submittedAt` first, ties broken by descending `orderId`. The owner comes from the token's `sub`, so there is no parameter that can name another user's orders; a caller who has never traded gets `[]`, not a 404.

**Idempotency:** resubmitting the same `accountId` and `clientReference` returns the original order's outcome without executing again.

**Ownership:** `accountId` stays in the request body, because a user may own several accounts and has to say which one the order is for, but submission now refuses an account the caller does not own. A `accountId` belonging to another user is a 403 and an `accountId` that does not exist is a 404; neither writes an order row. Ownership is settled before the idempotency lookup, so a caller cannot read back the outcome of an order on an account that is not theirs. An `instrumentId` that does not exist is a 400 — distinct from an instrument that exists but is closed to trading, which is a 201 carrying a `REJECTED` order. See [OrderController](../../apps/order-and-sell-service/src/main/java/app/order/OrderController.java).

**Instrument lookup:** an order names an `instrumentId`, but market data is keyed by symbol and holdings come back by symbol, so `GET /api/instruments` is how a client turns the symbol a trader picked into the id to submit. Non-tradable instruments are listed and flagged rather than hidden, because a position can outlive its instrument being suspended. Match on `simulatedStockSymbol` first, which is the symbol `GET /api/market/snapshot` reports, and fall back to `ticker` for an instrument nothing simulates.

### Planned trading endpoints

These endpoints are **NOT YET IMPLEMENTED**. [OrderController](../../apps/order-and-sell-service/src/main/java/app/order/OrderController.java) exposes only `POST /api/orders` and `GET /api/orders`. Do not call them yet.

| Method | Path | Request | Planned response |
| --- | --- | --- | --- |
| GET | /api/orders/{orderId} | Bearer token; owned order | 200: order, fill if present, audit events |

Cash movements are not served here. They belong to the Holdings and Trade Service, which owns the balance they move; see [Cash](#cash).

See [Order and Sell Service documentation](../../apps/order-and-sell-service/README.md) for implementation status.

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

## Holdings and Trade Service (Spring Boot Java 21) — port 8082

This service provides user registration, profile queries, account and holdings queries, cash movements, and market data. It is the backend Client UI calls: the dev server proxies `/api` to this service (see [proxy.conf.json](../../apps/client-ui/proxy.conf.json)).

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
- `ssn` (NNN-NN-NNNN format)
- `dateOfBirth` (must be in past)
- `traderLevel` (BEGINNER, INTERMEDIATE, or ADVANCED)
- `availableFunds` (≥5000.00; max 2 decimal places)

**Token verification:** Each service caches the auth service's public JWKS independently. Tokens must:
- Use RS256 signature
- Not be expired (check `exp`)
- Have `iss` matching AUTH_JWT_ISSUER config
- Have valid UUID `sub` (becomes `users.user_id`)

**Data scope:** Endpoints resolve the caller from the bearer token's `sub` only. Clients cannot read other users' data even with explicit IDs in the path.

### Accounts and holdings

Every endpoint resolves the owner from the token's `sub`. An account id in a path is checked against that owner: an account belonging to someone else is 403, one that does not exist is 404. See [AccountController](../../apps/holdings-and-trade-service/src/main/java/app/account/AccountController.java).

| Method | Path | Request | Success |
| --- | --- | --- | --- |
| GET | /api/me/accounts | Bearer token | 200: caller's accounts, newest first |
| POST | /api/me/accounts | Bearer token + JSON: `name` | 201: the new account, with no holdings |
| PUT | /api/me/accounts/{accountId} | Bearer token; owned account; JSON: `name` | 200: the renamed account |
| GET | /api/accounts/{accountId} | Bearer token; owned account | 200: the account |
| GET | /api/accounts/{accountId}/holdings | Bearer token; owned account | 200: holdings with instrument metadata |

An account is returned as `accountId`, `userId`, `name`, `cashBalance`, `openedDate` and `currency`. Registration opens a default account named `Main Account`, so a new user starts with one empty account rather than none.

A holding is returned as `holdingId`, `accountId`, `instrumentId`, `symbol`, `name`, `quantity`, `averageCost` and `updatedAt`. Neither `symbol` nor `averageCost` is stored on the holding row: the symbol comes from the instrument, preferring `simulated_stock_symbol` so it matches what the market endpoints report, and `averageCost` is derived from `holding_movements` joined to `fills`, weighted by quantity over acquisitions only. An instrument that cannot be resolved reports its id as the symbol, and a position with no acquisition history reports an average cost of 0.

### Portfolio valuation history

These authenticated endpoints use the same account ownership checks as holdings (403 for another user's account, 404 for a missing account). See [PortfolioValuationController](../../apps/holdings-and-trade-service/src/main/java/app/account/PortfolioValuationController.java).

| Method | Path | Request | Success |
| --- | --- | --- | --- |
| GET | /api/accounts/{accountId}/portfolio-history | Bearer token; optional `timeframe` (default `1D`; `1D`, `5D`, `1W`, `1M`, `1Y`) | 200: chronological `{timestamp, value}` observations |
| POST | /api/accounts/{accountId}/portfolio-valuations | Bearer token; no valuation data required | 200: server-calculated `{timestamp, value}`, or an empty body before any purchase |

`timestamp` is the actual UTC observation time, independent of the simulated market timestamp. Value is the sum of held quantities multiplied by current replay prices, with average acquisition cost as the fallback for unavailable quotes; shared cash is excluded. Without an active simulation context, the dashboard requests capture after a filled order. In simulation mode it recalculates the projected chart; the background job continues capturing real observations. A background job also records eligible accounts once per minute, including liquidated accounts at zero; scheduled captures in a minute already recorded are coalesced. Rejected orders do not trigger capture.

History begins with the first capture after deployment, including a current baseline for existing portfolios. No historical prices are fabricated from replay candles. Empty accounts have no observations until the ledger contains an acquisition. Lookbacks and buckets follow [MarketTimeframe](../../apps/holdings-and-trade-service/src/main/java/app/market/MarketTimeframe.java), ending at real current time; each bucket retains its latest observation and actual timestamp. The chart connects recorded values into a continuous line and carries the latest value forward to the current time. When the first acquisition falls within the selected range, history includes zero from the range start until immediately before that execution, using the existing `fills.filled_at` timestamp. These baseline and carry-forward endpoints are presentation values, not additional stored observations. Earlier investments outside the selected range do not receive a zero baseline. Unsupported timeframes return 400. The dashboard refreshes each minute, on selection/range changes, and after filled orders; capture failures are displayed separately from successful trades and retried on the next refresh. Net Worth and Portfolio Value display exactly two decimal places.

The [canonical schema](../../apps/market-data/db/migrations/V001__Initialize_database.sql) includes the portfolio observations table. There is no automatic Java migration runner.

### Cash

Cash belongs to the user, not to an account: the balance is `availableFunds` from `GET /api/users/me` and every account of theirs shares it. No request names an account, so these endpoints cannot be pointed at another user's money. Each movement writes the balance and appends a `cash_transactions` row in one transaction; the row is booked against the caller's first account, and the balance row is locked before it is read so two concurrent withdrawals cannot both pass the funds check. See [CashTransactionController](../../apps/holdings-and-trade-service/src/main/java/app/cash/CashTransactionController.java).

| Method | Path | Request | Success |
| --- | --- | --- | --- |
| GET | /api/me/cash-transactions | Bearer token; optional `limit` (default 50, capped at 200) | 200: caller's deposits and withdrawals, newest first |
| POST | /api/me/cash-transactions | Bearer token + JSON: `amount` (positive, whole cents, ≤1000000), `reason` (DEPOSIT or WITHDRAWAL) | 201: the recorded transaction |

A transaction is returned as `cashTransactionId`, `amount`, `reason` and `createdAt`. The stored ledger amount is signed so it sums to the balance it backs; the response reports `amount` positive either way, because `reason` already carries the direction. `ORDER_FILL` rows are left out of the history: they are trades rather than funding.

### Market data (public, unauthenticated)

| Method | Path | Query parameters | Success |
| --- | --- | --- | --- |
| GET | /api/market/snapshot | Optional `sessionId` | 200: current market state, all stock prices, trading calendar |
| GET | /api/market/candles | Required: `symbol`, `timeframe` (1D, 5D, 1M, 1Y); optional `sessionId` | 200: array of ≤500 OHLCV bars |
| GET | /api/market/stream | Optional `sessionId`, `Last-Event-ID` header | 200 text/event-stream: continuous price ticks |
| PUT | /api/market/clock | Bearer token + JSON: `timestamp` (ISO-8601); optional `sessionId` | 200: snapshot at nearest seeded tick ≤ timestamp |

**Candle aggregation:** Backend aggregates seeded 1-minute candles; does not emit raw 1-second history. Each timeframe caps results at 500 points.

**Stream:** Server-sent events containing synchronized price batches. Retains 30 events for reconnection via `Last-Event-ID`; outside that window, client receives resync event and must reload snapshot.

### Errors

Standard format: `{"error": "..."}` with HTTP status. Mismatched bearer token and request email produces 403. Always include `WWW-Authenticate: Bearer` challenge on 401.

| Status | Cause |
| --- | --- |
| 400 | Request validation failed; message lists each invalid field |
| 401 | Missing, malformed, expired or untrusted access token |
| 403 | Registration email does not match token's email claim |
| 404 | Resource not found (e.g., GET /api/users/me before registration) |
| 409 | Duplicate account or email; account already registered |
| 422 | Withdrawal exceeds the caller's available funds |

---

## Client UI integration flow

The Angular UI (port 4200) orchestrates these services:

1. **Authentication:** Direct calls to Auth Service
   - POST /auth/register (create account)
   - POST /auth/login (sign in)
   - POST /auth/refresh (rotate expired token)
   - POST /auth/logout (end session)

2. **Profile, accounts, cash and market data:** Calls to Holdings and Trade Service
   - Use dev proxy ([proxy.conf.json](../../apps/client-ui/proxy.conf.json)), which forwards `/api/*` to port 8082 except the trading paths below
   - Bearer token from Auth Service is sent in `Authorization: Bearer` header
   - POST /api/auth/register (submit profile after auth registration)
   - GET /api/users/me (profile: the shared cash balance and the name the header initials come from)
   - GET /api/me/accounts, POST /api/me/accounts, PUT /api/me/accounts/{accountId}
   - GET /api/accounts/{accountId}/holdings (per-account portfolio)
   - GET /api/me/cash-transactions, POST /api/me/cash-transactions (deposits and withdrawals)
   - GET /api/market/snapshot (dashboard ticker)
   - GET /api/market/candles (dashboard charts)
   - GET /api/market/stream (real-time prices)

3. **Trading:** Calls to Order and Sell Service
   - The dev proxy forwards `/api/orders` and `/api/instruments` to port 8081; everything else under `/api` goes to port 8082. In containers [nginx.conf](../../apps/client-ui/nginx.conf) splits the same two paths off to `order-and-sell-service:8081`.
   - GET /api/instruments (resolves the trader's symbol to an `instrumentId`)
   - POST /api/orders (submit a buy or sell from the dashboard dialog or full-screen market ticket)
   - GET /api/orders (the caller's order history)
   - The full-screen market page at `/dashboard/markets/:symbol` uses the same OrderService, account data, simulation projections, and shared account/time controls as the dashboard. An owned `accountId` query parameter preserves selection; direct visits default to the first owned account. Available cash previews the displayed balance minus the selected buy quantity's estimated cost, floored at zero; changing the slider or quantity updates the preview without changing account balances or the ticket's buying limit. Sell drafts show the displayed balance. Its Recent Orders tab shows the selected account's latest 20 orders across all stocks at or before the simulated cursor, including pending and rejected orders; deposits and withdrawals are excluded.

The market page header places a notification bell and the dashboard-style profile menu after the time control. The profile menu opens the shared Settings dialog or logs out through AuthService. The notification panel currently shows an empty state; no persistent notification feed is connected.

Market prices and instrument names are shared simulation data. Everything else the dashboard shows is the signed-in user's own: accounts, each account's holdings, the shared cash balance and the funding history all come from the endpoints above, scoped to the token's `sub`.

Session management, inactivity timeout, and token refresh are handled by [SessionTimeoutService](../../apps/client-ui/src/app/core/auth/session-timeout.service.ts) and [AuthService](../../apps/client-ui/src/app/core/auth/auth.service.ts). Inactivity timeout (5–60 minutes, default 10) is UI-only; neither backend service implements it.

---

## E2E test coverage

The [Playwright suite](../../apps/client-ui/e2e) covers:
- Full registration flow (auth service + Holdings and Trade Service profile registration)
- Sign-in and inactivity timeout
- Dashboard access and session persistence

Tests use a stand-in server that reproduces the contracts documented above. Update this reference and test expectations together.

---

## Contract maintenance

Update this reference in the same commit as endpoint changes. Proposed endpoints must be explicitly labeled. Key generation and environment setup belong in [Auth Service README](../../apps/auth-service/README.md); Java implementation details belong in source Javadocs.

Base path: /api/auth. Spring Boot source is rooted at [apps/holdings-and-trade-service/src/main/java/app](../../apps/holdings-and-trade-service/src/main/java/app), and these endpoints are implemented by [controller](../../apps/holdings-and-trade-service/src/main/java/app/auth/AuthController.java).

The Java backend has no login and never receives a password. Sign-up and sign-in happen at the NestJS auth service. User-specific endpoints and market mutations require its access token in an `Authorization: Bearer` header; the account existence check and read-only simulated market endpoints are public.

| Method and path | Request/authentication | Success |
| --- | --- | --- |
| POST /api/auth/account-exists | Public. JSON: email | 200: exists |
| POST /api/auth/register | Bearer access token. JSON: email, firstName, optional middleName, lastName, ssn, address, dateOfBirth, traderLevel, availableFunds | 201: userId, email |
| GET /api/users/me | Bearer access token | 200: caller's profile without ssn |

Registration takes no username and no password; the caller is identified by the bearer token. It requires a valid email up to 100 characters, nonblank firstName, lastName and address, an ssn in NNN-NN-NNNN form, a past dateOfBirth, a traderLevel of BEGINNER, INTERMEDIATE or ADVANCED, and availableFunds of at least 5000.00 with at most two decimal places. See [registration constraints](../../apps/holdings-and-trade-service/src/main/java/app/auth/RegisterRequest.java).

Errors use an error string: 400 for request validation, 409 for a duplicate account or email, 403 when the request email differs from the token's email claim, and 401 for a missing or untrusted token. See [exception mapping](../../apps/holdings-and-trade-service/src/main/java/app/auth/GlobalExceptionHandler.java).

### Token verification

Tokens must be RS256 JWTs signed by the auth service. The backend fetches the public key from AUTH_JWK_SET_URI (the auth service's /.well-known/jwks.json) on the first authenticated request and caches it, so it does not call the auth service per request. A token is rejected with 401 when the signature does not verify, exp has passed, iss differs from AUTH_JWT_ISSUER, or sub is not a UUID. The roles claim becomes ROLE_ADMIN or ROLE_TRADER authorities.

The token's sub is the only identifier shared with the auth service. It becomes users.user_id at registration, and endpoints resolve the caller's data from sub rather than from ids in the path or body, so a client can only read its own account.

### Registration flow

1. Optionally call POST /api/auth/account-exists to warn that the email is already registered. The check ignores case and is a convenience only: it reveals whether an email is registered, so rate-limit it at the edge, and registration still enforces uniqueness.
2. Create credentials with POST /auth/register on the auth service and keep the returned accessToken.
3. Call POST /api/auth/register on the Java backend with that token and the profile fields. The password and confirmation stay with step 2.

Registration requires an email up to 100 characters that equals the token's email claim, ignoring case; nonblank names and address; ssn in NNN-NN-NNNN form; a past dateOfBirth; traderLevel BEGINNER, INTERMEDIATE or ADVANCED; and availableFunds of at least 5000.00 with at most two decimal places. See [registration constraints](../../apps/holdings-and-trade-service/src/main/java/app/auth/RegisterRequest.java).

### Errors

Errors use an `{"error": "..."}` body. See [exception mapping](../../apps/holdings-and-trade-service/src/main/java/app/auth/GlobalExceptionHandler.java) and [security error handling](../../apps/holdings-and-trade-service/src/main/java/app/auth/SecurityErrorHandler.java).

| Status | Cause |
| --- | --- |
| 400 | Request validation failed; the message lists each invalid field |
| 401 | Missing, malformed, expired or untrusted access token; includes a WWW-Authenticate: Bearer header |
| 403 | Registration email does not match the token's email claim |
| 404 | GET /api/users/me before the caller has registered |
| 409 | The caller already registered, or the email belongs to another account |

## Java stock market API

These public endpoints expose seeded stock data for the dashboard market ticker, instrument popup, and full-screen `/dashboard/markets/:symbol` view. Both Java services implement them identically; the UI reaches them on port 8082, because only the trading paths are routed to port 8081. The full-screen view keeps its top stock summary focused on the primary symbol when comparison is enabled; the compared symbol remains in the comparison control and chart. Headline bid and ask values use neutral text, and the headline price updates without a flashing gain/loss highlight. The account dropdown, available cash, and portfolio value share an outer overview box. Separate balance cards align beneath the dropdown, with a subtle warm amber tint for cash and a subtle cyan tint for portfolio value. It combines candle history with live stream prices and supports `1D`, `5D`, `1M`, and `1Y`; chart modes, technical indicators, and peer comparison are computed in the browser. Its metrics, overview signals, news, and AI responses remain demo data. Cash, held shares, and recent orders come from authenticated APIs and follow the dashboard's simulation-time rules. Both pages submit through [Trading endpoints](#trading-endpoints). The dashboard portfolio chart reads real-time account observations through [Portfolio valuation history](#portfolio-valuation-history).

Protected trading endpoints use the [token verification](#token-verification) described above: clients send the auth service access token as a bearer token, and the Java backend scopes account and order resources to the token's sub.

### Stock endpoints

| Method and path | Request | Success |
| --- | --- | --- |
| GET /api/market/snapshot | Optional `sessionId` | Resolved simulation, replay cursor, market status, available clock range, and every seeded stock's company name, current price, current-session change, percentage change, and tick timestamp |
| GET /api/market/candles | Optional `sessionId`; required `symbol` and `timeframe` (`1D`, `5D`, `1M`, or `1Y`) | At most 500 chronological OHLCV buckets ending at the current replay cursor |
| GET /api/market/stream | Optional `sessionId`; optional `Last-Event-ID` request header | Server-sent event stream containing one synchronized price batch per simulated market second, sourced from raw Parquet ticks for Parquet-backed sessions |
| PUT /api/market/clock | Bearer access token; optional `sessionId`; JSON `timestamp` as an ISO-8601 instant | Moves the shared replay cursor to the closest seeded tick at or before that time and returns a snapshot; non-trading dates inside an imported month use the nearest loaded trading date in that month, preferring the next trading date; months without seeded trading data return 400 |

Snapshots include a `calendar` object that describes the selectable imported archive range:

The account, holdings and cash endpoints are documented once, under [Accounts and holdings](#accounts-and-holdings) and [Cash](#cash). Order submission is documented under [Trading endpoints](#trading-endpoints), and per-order and per-account order reads remain [planned](#planned-trading-endpoints).

Manual clock changes are limited to the months imported for the resolved simulation session. A local development database can contain a small date range rather than the full generated dataset, so clients should validate against `tradingDates`, `firstTimestamp`, and `lastTimestamp` before calling `PUT /api/market/clock`. If a user selects a weekend or other non-trading date inside an imported month, clients may adjust to the nearest loaded trading date in that month before sending the request; the backend applies the same rule for direct API callers.

Parquet-backed replay requires the selected daily tick partition to be readable by the Java service. The archive root resolves from `MARKET_REPLAY_ARCHIVE_LOCATION`, the location recorded in simulation metadata, or the matching archive in the repository's `apps/market-data/db/seeds` directory. The service does not substitute one-minute candles when raw ticks are unavailable; affected snapshot, stream, or clock requests fail as unavailable market data instead of changing the replay resolution. The dashboard displays seconds in its market clock and applies each streamed price immediately. Its 500–1,000 ms randomized gain/loss highlight is visual only and does not affect replay timing or values.

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

One shared replay cursor per requested simulation advances at one simulated second per real second. The dashboard applies every price and the market timestamp immediately, then shows a randomized 500–1,000 ms visual gain/loss transition without delaying values or changing event order. It uses the current `America/Chicago` date and market time when that timestamp exists in the seed, chooses the nearest applicable seeded session otherwise, skips overnight and weekend gaps, and loops after the final seeded session. `MARKET_REPLAY_START_AT` may override this behavior with an ISO-8601 instant for deterministic tests and demonstrations. `marketTimestamp` is the simulated market time; `serverTimestamp` records delivery time.

The stream sends a heartbeat every 15 events and retains the latest 30 events for reconnection by `Last-Event-ID`. A client outside that window receives a resynchronization event and reloads the snapshot.

### Data access and safeguards

The replay service supports ticks stored either in PostgreSQL for sessions explicitly configured with PostgreSQL tick storage or in the resolved Parquet archive for Parquet-backed sessions. It loads only the current trading day's required tick columns into a bounded server-side buffer, so emitting each second does not issue another database query or rescan a Parquet file. An unavailable Parquet archive or partition fails the request; one-minute candles remain chart data and are never substituted for replay ticks.

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

The dashboard stock search sits above Portfolio Value and uses the placeholder "Search for a stock". Below Recent Transactions, the Watch List preview displays all available market stocks with company names, live prices, dollar changes, and percentage changes in a scrollable list under an Asset/Price/Change $/Change % header divider. Watch-list prices update without a flashing highlight. Watch-list headers stay on one line, and rows align with Recent Transactions using the same edge spacing and row dividers. It is a placeholder without a watch-list API or saved user selections; selecting a stock opens the trading dialog.

Order results from the dashboard buy/sell dialog and full-screen market ticket appear as bottom-center toasts that dismiss automatically: fills use success styling, while rejections and request failures use error styling. Only the newest notification is shown: a new result replaces the previous toast, replays a 420 ms slide up from the bottom edge, and resets its timer, so notifications never stack. Each toast shows a shrinking countdown bar that tracks the time remaining. Notifications remain visible for four seconds, then slide down and fade over 400 ms; they survive closing the dialog and respect reduced-motion preferences. The dashboard Buy/Sell button shows a loading circle and Buying/Selling label; the market ticket shows Submitting. Both stay disabled for at least one second after a click, or longer while the request is pending. It becomes available again afterward when the bounded quantity is positive. Reduced-motion preferences disable spinner rotation. Each subsequent click places a new order with a fresh idempotency key; the ticket stays open and refreshes available cash and holdings.

Both the dashboard order dialog and the full-screen market ticket normalize quantity input immediately to whole shares between zero and the current maximum. Buys are capped by the current persisted available cash divided by a valid positive price; sells are capped by the current persisted whole shares held in the selected account. Both tickets use current balances, including every completed trade regardless of the replay cursor. Moving the clock backward or forward changes portfolio and history views, but never restores cash or shares for another trade. Invalid limits become zero, and changing prices, cash, holdings, symbols, or sides preserves valid quantities while clamping excessive ones. Zero cannot be executed. Shared header dropdowns close on Escape and return focus to their trigger. Both tickets capture the selected account, price, quantity, side, and simulated timestamp at submission; backend validation remains authoritative. The market ticket resets quantity when the account or symbol changes. It disables submission until account, history, catalogue, and market data are ready, prevents concurrent submissions, and retains a one-second cooldown. Filled orders refresh cash and holdings for the submitted account; a failed balance refresh retains the fill outcome, blocks further trading until balances recover, and offers a refresh retry without another order POST.

The Angular UI authenticates only against the NestJS auth service. See [AuthService](../../apps/client-ui/src/app/core/auth/auth.service.ts).

- Sign-in posts email and password to POST /auth/login and stores the token response in browser localStorage.
- Registration first posts email and password to POST /auth/register. If that returns 409, the UI tries POST /auth/login with the same credentials, so a user whose earlier profile step failed can resubmit. Once it has tokens, the UI posts the profile to Java POST /api/auth/register with a Bearer access token: email, firstName, middleName, lastName, dateOfBirth, ssn, address, traderLevel, availableFunds. It sends no password or username. If the profile step fails, the UI clears the stored session.
- The dashboard route requires a stored session. Route guards and authenticated business requests renew expired access tokens through POST /auth/refresh, sharing one in-flight refresh even when chart requests are cancelled. A business request returning 401 gets at most one retry with renewed tokens; ordinary backend errors are not retried by authentication. Rejected or missing refresh credentials end the session and protected requests redirect to login. Network and refresh-service failures retain the session and surface a retryable error. Late refresh responses cannot restore a logged-out session or overwrite a newer login. Sign-out posts the refresh token to POST /auth/logout. Tokens are stored in local storage, not session cookies; renewal does not extend the inactivity timeout.
- The dashboard reads and changes the signed-in user's accounts and cash through the planned account endpoints above, which the Java backend does not serve yet; see [AccountStore](../../apps/client-ui/src/app/dashboard/accounts/account-store.service.ts) and [the models it expects](../../apps/client-ui/src/app/dashboard/accounts/account.models.ts). Cash belongs to the user, not to an account: it is availableFunds from GET /api/users/me, every account shares it, and deposits and withdrawals move it through /api/me/cash-transactions without naming an account. An account holds positions only, and its portfolio is exactly its holdings, so an account has one portfolio and a new account starts with none. Net worth is availableFunds plus the value of every account's holdings; the Portfolio Value card and assets table show the selected account's holdings. The Assets table hides stocks whose total value (quantity times the current price, or average cost when no live price exists) is zero. An account is returned as accountId, name and openedDate; a holding as symbol, quantity and averageCost, valued at the live price or at averageCost when there is none; a cash transaction as cashTransactionId, a positive amount, reason and createdAt. After every successful change the UI reloads the affected data rather than trusting the response body. It maps 400 to the backend's error string, 403 and 404 to an unavailable account, and 409 or 422 to a duplicate account name or, for withdrawals, insufficient funds. The UI lists only the accounts these endpoints return for the caller, requests holdings only for those, and sends no change for an account id outside that set; the backend must still enforce ownership from the token's sub.
- While a session is stored, the UI signs the user out after 10 minutes without mouse, keyboard, scroll or touch input, using the same POST /auth/logout call, then shows the login page with `?reason=inactive`. The limit can be set to 5, 10, 15, 30 or 60 minutes in the dashboard's Settings dialog, opened from the profile menu, and is kept per browser. The last activity time is shared between tabs and survives a reload. This is enforced by the UI only; neither service tracks inactivity. See [SessionTimeoutService](../../apps/client-ui/src/app/core/auth/session-timeout.service.ts).

Authentication, inactivity timeout, account workflows, and the full-screen market journey are covered end to end by the [Playwright suite](../../apps/client-ui/e2e), which drives the real application against a stand-in for both services. Its stand-in reproduces the contracts on this page, so update the two together.
- After 3 rejected sign-ins in a row (401 from POST /auth/login), the login form locks for 10 minutes: it shows a lockout notice, disables submission with a countdown, and sends no further login requests until the time is up. Network errors and 5xx responses do not count. A successful sign-in or the lock running out resets the count. The count and lock are kept per browser in localStorage, shared between tabs and kept across a reload. This is enforced by the UI only and is separate from the auth service's own account lockout (5 failed attempts lock the account for 15 minutes; see [UsersService](../../apps/auth-service/src/users/users.service.ts)). See [LoginLockoutService](../../apps/client-ui/src/app/core/auth/login-lockout.service.ts).

The registration, sign-in, failed sign-in lockout and inactivity timeout journeys are covered end to end by the [Playwright suite](../../apps/client-ui/e2e), which drives the real application against a stand-in for both services. Its stand-in reproduces the contracts on this page, so update the two together.

## Contract maintenance

Update this reference and relevant tests in the same change as endpoint behavior. Proposed endpoints must be clearly labeled as planned or in progress until implemented. Key generation and environment setup belong in the [auth README](../../apps/auth-service/README.md); Java implementation details belong in source Javadocs.


### Portfolio chart domains

Candle responses include `rangeStart`, `rangeEnd`, and `tradingSessions` (`start`, `end` instants). For 1D the domain covers the selected session from 08:30 to the exclusive 15:00 closing boundary in America/Chicago. For 5D it covers the latest five seeded sessions, or the available sessions near the archive start. Month and year bounds subtract a calendar month or year in the market timezone, clamping month ends and respecting daylight saving time. Returned candle values still end at `marketTimestamp`.

The dashboard portfolio chart uses these explicit domains: daily future time stays blank, five-day sessions occupy equal widths with overnight/weekend gaps omitted, and longer ranges use elapsed calendar time. The Portfolio Value percentage compares the current value with the opening observation in the selected timeframe, including the year opening value for 1Y, rather than holdings purchase cost. When the range begins before the first investment, the percentage uses the first positive portfolio observation in that range, skipping pre-investment zero baselines. Portfolio hover percentages use this same first positive observation as their baseline, comparing the hovered value rather than the current value. History with no positive observations, and loading or failed history, shows an unavailable percentage (—); equal values show +0.00%. Axis labels are independent of sample density and adapt to available width. Portfolio curves use monotone cubic interpolation between observations without overshoot. Execution boundaries remain sharp and zero baselines remain flat. Crowded portfolio execution points use a minimum eight-pixel horizontal display spacing, moving neighbouring points only as needed to preserve order. Clusters at the latest observation shift left to keep future time blank; spacing reduces uniformly when the elapsed range cannot fit all transitions. Positions adapt to plot width, while axis labels, observation timestamps, and values remain unchanged. Hover uses the displayed positions and reports underlying observations; interpolation and spacing change only presentation. Other chart consumers retain their existing rendering defaults.

## Saved watchlist

Holdings and Trade owns the signed-in user's single watchlist across accounts. Every endpoint requires a bearer token and resolves ownership exclusively from its verified subject.

| Method | Path | Success |
| --- | --- | --- |
| GET | `/api/me/watchlist` | 200: array of `{ symbol, createdAt }`, sorted by addition time then symbol |
| PUT | `/api/me/watchlist/{symbol}` | 200: saved entry; repeated adds preserve the original timestamp |
| DELETE | `/api/me/watchlist/{symbol}` | 204, including when the entry is absent |

Symbols are trimmed and uppercased. Adding an unknown seeded stock or adding without a business profile returns 404. Stars in the stock popup and fullscreen page share membership; the dashboard displays saved stocks using existing market prices. Writes update optimistically and roll back on failure. An unavailable quote is displayed explicitly, without a per-stock price request.

## Client data refresh behavior

Account, order, catalogue, and watchlist stores are shared across dashboard and fullscreen navigation and cleared synchronously on logout or token subject changes. Browser reloads start with empty memory caches. View entry revalidates orders, cash transactions, watchlist membership, and the market snapshot while retaining successful content. Account data is reused for up to one minute. Concurrent identical reads share one request.

Each market view closes its previous live-price stream before replacing a snapshot and closes its active stream when leaving the page. Cached and revalidated snapshot emissions cannot leave additional connections open across navigation.

Portfolio history is shared across dashboard navigation, retaining points and their domain per account, session, and timeframe for one minute. Matching loads are deduplicated; trades invalidate the affected account, context changes revalidate, and logout clears the cache. Ordinary portfolio and chart refreshes keep successful content in place without adding visible updating text that shifts the layout. Initial loads and retryable errors remain explicit. Advanced and popup charts also immediately reuse compatible completed candles while expired history or a new replay minute revalidates.

The dashboard Assets list defaults to descending current market value (shares multiplied by the live price). Its sort control also supports asset symbol order; market ticks update values and their ordering locally.

If live ticks arrive during snapshot revalidation, the response retains the newer live prices and recomputes change and percentage change using the snapshot's opening baseline. Closed streams cannot update cached quotes. Crossing into another trading day refreshes the snapshot to obtain the new session-open baseline before applying further live ticks.

Candle history is cached for 60 seconds, with at most 64 completed entries, keyed by simulation session, normalized stock symbol, timeframe, and replay cursor minute. Popup charts, fullscreen primary/comparison charts, portfolio calculations, and holding sparklines reuse this cache. Stream ticks update prices locally; a new cursor minute requests fresh history. Explicit clock changes, new simulation sessions, and stream resynchronization invalidate market caches. Requests invalidated by a clock change are cancelled; obsolete results cannot restore the previous cursor.

During a clock change, snapshot and candle reads wait for the shared clock request to finish before reading the new cursor. Incoming ticks are ignored until that seek completes. Ordinary live-minute changes request new history but do not discard a valid in-flight history response; only explicit invalidation makes it obsolete. A failed seek releases waiting reads with an error and allows retries at the unchanged cursor.

Filled orders are inserted locally and trigger the existing targeted holdings/shared-cash refresh and portfolio refresh. Rejected orders do not refresh unchanged balances. Transfers refresh shared cash and the cash ledger; account creation/rename refresh the account list. Request revisions prevent reads started before a mutation from overwriting its newer state; an obsolete read joins or starts a replacement read. Mutation success remains distinct from refresh failure.

Compatible successful charts and activity rows stay visible during refresh. Timeframe changes retain the previous chart range until replacement data arrives; switching stock, account, or simulation does not show another entity's history. Refresh failures retain successful content, report an error, and allow retry. Live charts no longer substitute generated placeholder history. News, AI content, and demo fullscreen metrics remain demo content.
