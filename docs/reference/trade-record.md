# Trade record

This document describes how TradingSeason keeps a permanent, attributable record of every order, and what the client is told before placing one. It covers implemented behavior only.

## Requirement

Every accepted order, pricing decision, and resulting change to cash or holdings must be permanently recorded and attributable to a specific client and time. The record must survive a system restart or a failed deployment.

## What is recorded

Order and Sell Service writes the order, its audit events, the fill, and the cash and holding ledger rows in one database transaction, so an order is never recorded without its effects or the reverse. See [OrderService](../../apps/order-and-sell-service/src/main/java/app/order/OrderService.java) and [OrderExecutionService](../../apps/order-and-sell-service/src/main/java/app/order/execution/OrderExecutionService.java).

| Table | What it records | Attributed by |
| --- | --- | --- |
| orders | The terms the client submitted and the order's outcome | account, submission time |
| audit_trail | One row per lifecycle event, with a self-contained description | order, recording time |
| fills | The quantity and price an order was filled at | order, fill time |
| cash_transactions | The signed cash change from a fill, deposit, or withdrawal | account, creation time |
| holding_movements | The signed share change from a fill | account, instrument, creation time |

An account always belongs to one user, so every row above resolves to a client through its account.

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

[V010__Protect_trade_records.sql](../../apps/market-data/db/migrations/V010__Protect_trade_records.sql) adds database triggers that make the record append-only for every role, including the table owner that the services connect as.

| Table | Allowed | Rejected |
| --- | --- | --- |
| audit_trail, fills, cash_transactions, holding_movements | INSERT | UPDATE, DELETE, TRUNCATE |
| orders | INSERT; a `PENDING` order may be accepted, then resolved once to `FILLED` or `REJECTED` | Changing submitted terms or the acceptance time, changing a resolved order, DELETE, TRUNCATE |
| accounts | INSERT, rename | Moving an account to another user, DELETE, TRUNCATE |

A rejected change raises SQLSTATE `23001` (`restrict_violation`). `users.available_funds` and `holdings` stay mutable because they are cached balances derived from the ledgers.

PostgreSQL makes committed rows durable across restarts. Because each order is one transaction, a crash or failed deployment mid-order leaves either the whole record or none of it.

### Limits

- The triggers can be removed by a schema change (`DROP TRIGGER`, or `ALTER TABLE ... DISABLE TRIGGER`), which the table owner can make. The services currently connect as that owner. Separating the owner role from the application role would close this path; that separation is not implemented.
- Dropping a table or the database is not prevented. Backups and their retention are an operational concern outside this repository.
- The Java service tests run against H2, which does not load V010. The triggers are verified separately by the [migration test](../../apps/market-data/db/scripts/python/tests/test_trade_record_migration.py).

See the [database reference](database.md#trade-record-migration) for how to apply and verify V010.

## Client disclosure

Every place an order can be placed shows the same disclaimer, defined once in [order-disclaimer.ts](../../apps/client-ui/src/app/dashboard/orders/order-disclaimer.ts):

- A short line under the submit button of the dashboard order dialog and the market page trade ticket.
- A review dialog that opens when the client presses Buy or Sell. It restates the side, quantity, symbol, price, and estimated cost or proceeds, and states that the order, its fill price, and the resulting cash and holding changes are permanently recorded and cannot be edited or deleted.

No order request is sent until the client confirms in the review dialog. Cancelling, or pressing Escape, closes the review and leaves the ticket unchanged. The platform-wide terms accepted at first sign-in are described in [Terms and Conditions](terms-and-conditions.md).

This is product documentation, not legal advice.
