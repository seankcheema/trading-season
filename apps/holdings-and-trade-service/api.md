# Portfolio account lifecycle API

The Holdings and Trade Service on port 8082 owns these endpoints. All require the Auth Service's RS256 bearer token; ownership comes from its `sub`. Swagger UI is at `http://localhost:8082/swagger-ui.html`, and its OpenAPI document at `http://localhost:8082/v3/api-docs` is generated from the controller annotations and response records.

## Delete means archive

Delete removes an account from the client's active portfolio by transitioning `ACTIVE` to `ARCHIVED`. It never deletes a database row. Historical trades, rejected orders, cash postings, holdings rows, movements, and valuations remain linked to the same account for reporting. Accounts with financial history can be archived when they have no remaining assets or unresolved orders. Restoration is not supported.

Eligibility requires:

- `accounts.cash_balance` is exactly zero.
- Every holding quantity is zero, including negative and fractional shares.
- No unresolved orders. Only FILLED, REJECTED, CANCELLED, and EXPIRED are considered terminal; ACCEPTED blocks even if execution failed.
- The account is ACTIVE. Repeated deletion is safely refused.

The platform supports having no active accounts, so the last empty account may also be archived. Create a new active account before trading or posting another deposit/withdrawal.

Cash belongs to the user (`users.available_funds`), not to an individual portfolio. Shared cash is neither moved nor deleted when archiving an account. Deposits and withdrawals use the earliest ACTIVE account and never an archived one. The simulator settles fills and funding synchronously; it has no separate reserved assets, pending transfers, margin, fees, or settlement queue. Open accepted orders are the supported outstanding obligations and block archiving. Any future asynchronous financial operation must join this validation and locking protocol before release.

Lifecycle changes lock the user row followed by the account row and repeat eligibility checks inside the transaction. Cash transfers take the same locks in that order. Order acceptance locks the account before checking ACTIVE status and inserting an order; once accepted, the unresolved order prevents archiving until settlement commits. Concurrent lifecycle requests serialize and preserve each account row.

Archived accounts cannot trade, be renamed, receive funding ledger entries, or record new valuations. Existing account, holding, order, and valuation history reads remain available with ownership checks. The client offers no archived account section; reporting receives the retained account and history through Kafka, never through a database connection.

## Endpoints

| Method | Path | Response |
| --- | --- | --- |
| GET | `/api/me/accounts` | 200, ACTIVE accounts only |
| GET | `/api/me/accounts/archived` | 200, caller's ARCHIVED accounts |
| GET | `/api/me/accounts/{accountId}/eligibility` | 200, current blockers |
| POST | `/api/me/accounts/{accountId}/archive` | 200, archived account |
| DELETE | `/api/me/accounts/{accountId}?confirmed=true` | 204, archives the account; no rows deleted |

For a confirmed delete, send an authenticated request:

```http
DELETE /api/me/accounts/42?confirmed=true
Authorization: Bearer <access-token>
```

The frontend asks for explicit confirmation before sending that request. Without `confirmed=true` it is rejected with 400.

Archive uses the same validation and transition:

```http
POST /api/me/accounts/42/archive
Authorization: Bearer <access-token>
```

Account response schema (also used by each list):

```json
{
  "accountId": 42,
  "userId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "name": "Retirement",
  "cashBalance": 0,
  "openedDate": "2026-01-02",
  "currency": "USD",
  "status": "ARCHIVED",
  "archivedAt": "2026-10-15T12:00:00Z"
}
```

`archivedAt` is null for ACTIVE accounts. Eligibility is advisory and is rechecked on submission. Both lists contain the same reasons because Delete is archive:

```json
{
  "archiveBlockers": ["Account contains active holdings"],
  "deleteBlockers": ["Account contains active holdings"]
}
```

## Errors

Errors use `{"error":"explanation"}`.

| Status | Meaning |
| --- | --- |
| 400 | Deletion confirmation missing or invalid request |
| 401 | Missing or invalid authentication |
| 403 | Account belongs to someone else |
| 404 | Account does not exist |
| 409 | Cash, shares, unresolved orders, or already archived |

Specific 409 messages include `Account contains cash`, `Account contains active holdings`, `Pending orders must be resolved.`, `Account is already archived`. Multiple blockers are separated by semicolons. Repeated archive/delete requests safely return 409 without changing the original archive timestamp. Archived-account order submissions return 403, and existing idempotency-key replays still return the original order.

Apply the [lifecycle migration](../../db/migrations/V010__Portfolio_account_lifecycle.sql) before deploying the Java services. Deploy both updated Java services before enabling the client action, so every order writer enforces the lifecycle lock and status check. [Database documentation](../../db/README.md) owns the schema and reporting feed instructions.

## Trading preferences

Authenticated `GET /api/users/me/execution-settings` returns `{"executionBufferPercent": 1}`. `PUT` to the same path accepts that shape and returns the persisted preference. Values range from 0 through 10 inclusive, with at most two decimal places. Invalid or missing percentages return 400; unauthenticated requests return 401. The owner is always the token subject; no request field or path selects another user. The preference persists on the business profile across sessions and devices.

New profiles default to 1%. Migration V011 replaces the historical 0% default with 1% for existing profiles while retaining valid nonzero values. Orders snapshot the preference at acceptance, so changes affect new orders only. See the [Order API](../order-and-sell-service/api.md) for buffer rules and order types.

`GET /api/users/me` retains `availableFunds` as total cash and adds `reservedCash` and `spendableFunds`. The latter equals total cash minus all open BUY reservations across the owner's accounts. Withdrawals enforce this spendable amount under the user lock. Holdings responses retain total `quantity` and add `reservedShares` and `availableQuantity`; valuations continue to use total cash and positions. Order and Sell alone writes reservations on orders.
