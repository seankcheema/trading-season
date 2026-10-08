# Trade record

This document describes how TradingSeason keeps a permanent, attributable record of every order, and what the client is told before placing one. It covers implemented behavior only.

## Requirement

BR-14: every accepted order, pricing decision, and resulting change to cash or holdings must be permanently recorded and attributable to a specific client and time. This record is the firm's legal position and must survive any system restart or failed deployment.

The requirement sets no retention period, so nothing is ever archived out or purged. Closing an account or a client must leave every row in place.

## What is recorded

Order and Sell Service writes the order, its audit events, the fill, and the cash and holding ledger rows in one database transaction, so an order is never recorded without its effects or the reverse. See [OrderService](../../apps/order-and-sell-service/src/main/java/app/order/OrderService.java) and [OrderExecutionService](../../apps/order-and-sell-service/src/main/java/app/order/execution/OrderExecutionService.java).

| Table | What it records | Attributed by |
| --- | --- | --- |
| orders | The terms the client submitted and the order's outcome | account, submission time |
| audit_trail | One row per lifecycle event, with a self-contained description | order, recording time |
| fills | The quantity and price an order was filled at | order, fill time |
| cash_transactions | The signed cash change from a fill, deposit, or withdrawal | account, creation time |
| holding_movements | The signed share change from a fill | account, instrument, creation time |

An account always belongs to one user, so every row above resolves to a client through its account. The account's owner and that user's identity are fixed; see [Permanence](#permanence).

### Audit events

Each submitted order writes these `audit_trail` events in order. The detail text is written to stand on its own, without needing any other row to interpret it.

| Event | When | Detail |
| --- | --- | --- |
| PENDING | The order is created | The caller's user id, account, side, quantity, ticker, indicative price, buffer, client reference, and simulated time when supplied |
| ACCEPTED | The trading rules pass | The indicative price and buffer the order was accepted at |
| FILLED | The fill and ledger rows are written | Quantity, fill price and its source, signed cash change for the user, signed holding change for the account |
| REJECTED | A trading rule fails, or funds or holdings are insufficient at execution | The rejection reason |

`ACCEPTED` is an audit event, not an order status: the order stays `PENDING` until execution resolves it to `FILLED` or `REJECTED`. A rejected order has no `ACCEPTED` event when a trading rule fails, and has one when it is rejected at execution. An idempotent replay of an existing client reference writes nothing.

The fill price is the client's indicative price; there is no live quote source. Each `FILLED` event states this as its pricing decision.

## Permanence

[V010__Protect_trade_records.sql](../../db/migrations/V010__Protect_trade_records.sql) adds database triggers that make the record append-only for every role, including the table owner that the services connect as. [V011__Protect_client_identity.sql](../../db/migrations/V011__Protect_client_identity.sql) does the same for the client the record is attributed to.

| Table | Allowed | Rejected | Migration |
| --- | --- | --- | --- |
| audit_trail, fills, cash_transactions, holding_movements | INSERT | UPDATE, DELETE, TRUNCATE | V010 |
| orders | INSERT; a `PENDING` order may be accepted, then resolved once to `FILLED` or `REJECTED` | Changing submitted terms or the acceptance time, changing a resolved order, DELETE, TRUNCATE | V010 |
| accounts | INSERT, rename | Moving an account to another user, DELETE, TRUNCATE | V010 |
| users | INSERT; changing address, trader level, settings, and the cached balance; setting `terms_accepted_at` once | Changing the user id, name, SSN, or date of birth; changing a recorded terms acceptance; DELETE, TRUNCATE | V011 |
| user_accounts | INSERT; changing the password hash and sign-in lockout state | Changing the user id or email, DELETE, TRUNCATE | V011 |

A rejected change raises SQLSTATE `23001` (`restrict_violation`). `users.available_funds` and `holdings` stay mutable because they are cached balances derived from the ledgers.

No service changes a frozen identity column: each is written once, at registration. There is no way to deactivate or delete a client, and none can be added as a row delete. A change-of-name or change-of-email feature would need a migration that records the history instead of overwriting it.

PostgreSQL makes committed rows durable across restarts. Because each order is one transaction, a crash or failed deployment mid-order leaves either the whole record or none of it.

### Limits

- The triggers can be removed by a schema change (`DROP TRIGGER`, or `ALTER TABLE ... DISABLE TRIGGER`), which the table owner can make. The services currently connect as that owner. Separating the owner role from the application role would close this path; that separation is not implemented.
- In the Compose stacks the services connect as the PostgreSQL superuser, which can also switch triggers off for its own session. The same role separation would close this path.
- Dropping a table or the database is not prevented. The only protection is a backup taken beforehand; see [Database backup and restore](../../infrastructure/README.md#database-backup-and-restore). Backups are manual: nothing takes one automatically, schedules them, or copies them off the machine.
- The Java service tests run against H2, which does not load V010 or V011. The triggers are verified separately by the [migration test](../../apps/market-data/db/scripts/python/tests/test_trade_record_migration.py).

### Applying V010 and V011

Neither migration adds tables or columns or changes existing rows, and both may be reapplied. V011 reuses a function V010 creates, so apply them in order.

- Local Compose applies them through [init-db.sh](../../infrastructure/docker/init-db.sh), which runs every file in `db/migrations` once.
- The Jenkins Compose file, [setup-local.sh](../../scripts/setup-local.sh), and the [Python initializer](../../apps/market-data/db/scripts/python/0001-initialize-database.py) name them explicitly after V009.
- For a database managed by hand, take a backup, then apply them as the database owner after V009:

```powershell
psql -h localhost -p 5432 -U trading_season -d trading_season -W -v ON_ERROR_STOP=1 -f db/migrations/V010__Protect_trade_records.sql
psql -h localhost -p 5432 -U trading_season -d trading_season -W -v ON_ERROR_STOP=1 -f db/migrations/V011__Protect_client_identity.sql
```

Once they are applied, manual cleanup of orders, fills, ledger rows, accounts, or users with `DELETE`, `UPDATE`, or `TRUNCATE` fails; reset a disposable database by recreating it instead. With PostgreSQL binaries on PATH, verify the triggers against an isolated temporary cluster:

```powershell
python apps/market-data/db/scripts/python/tests/test_trade_record_migration.py
```

## Client disclosure

Every place an order can be placed shows the same disclaimer, defined once in [order-disclaimer.ts](../../apps/client-ui/src/app/dashboard/orders/order-disclaimer.ts):

- A short line under the submit button of the dashboard order dialog and the market page trade ticket.
- A review dialog that opens when the client presses Buy or Sell. It restates the side, quantity, symbol, price, and estimated cost or proceeds, and states that the order, its fill price, and the resulting cash and holding changes are permanently recorded and cannot be edited or deleted.

No order request is sent until the client confirms in the review dialog. Cancelling, or pressing Escape, closes the review and leaves the ticket unchanged. The platform-wide terms accepted at first sign-in are described in [Terms and Conditions](terms-and-conditions.md).

This is product documentation, not legal advice.
