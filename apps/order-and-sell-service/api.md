# Order API

Order and Sell owns these endpoints. Every request requires the Auth Service's RS256 bearer token. The verified token subject determines the owner; account IDs must belong to that owner. The generated contract is available at `/v3/api-docs` and `/swagger-ui.html`.

## Submit an order

`POST /api/orders` returns 201 with the persisted outcome. `orderType` is the side (`BUY` or `SELL`); `executionType` selects execution behavior and defaults to `MARKET`.

```json
{
  "accountId": 1,
  "instrumentId": 7,
  "orderType": "BUY",
  "executionType": "STOP_LIMIT",
  "quantity": 10,
  "indicativePrice": 100,
  "stopPrice": 105,
  "limitPrice": 102,
  "sessionId": 1,
  "clientReference": "b5c9b6cc-641f-4bdd-aad4-d9650e1e8572"
}
```

| Execution type | Price fields | Behavior |
| --- | --- | --- |
| `MARKET` | Neither | Attempts the current market quote immediately; rejects adverse prices beyond the saved buffer |
| `LIMIT` | `limitPrice` only | BUY fills at or below the limit; SELL fills at or above it |
| `STOP` | `stopPrice` only | BUY triggers at or above the stop; SELL triggers at or below it, then executes as a protected Market order |
| `STOP_LIMIT` | Both | Latches its stop trigger, then waits for its limit condition; the trigger tick can also fill it |

Quantity must be positive whole shares. Prices must be positive, with at most six decimal places and twelve integer digits. Required prices must be supplied and irrelevant price fields omitted. `indicativePrice` is retained for client display auditing; it never authorizes an execution price. `sessionId` is optional; omission selects the authoritative market's default session. `simulatedAt` is accepted for compatibility, but the server captures the authoritative submission position. That position must fall within the simulated session, Monday to Friday 08:30 to 15:00 America/Chicago, or the order is rejected with a `BR-05` reason (the market is closed).

`bufferPercent` overrides are rejected. Configure the user-wide setting through [trading preferences](../holdings-and-trade-service/api.md#trading-preferences).

### Buffer and reservations

The server snapshots the user's saved percentage and the Holdings and Trade market quote at submission. BUY maximum is `referencePrice * (1 + bufferPercent / 100)`; SELL minimum is `referencePrice * (1 - bufferPercent / 100)`. The boundary is inclusive; favorable prices remain eligible. BUY bounds round down and SELL bounds round up to six decimal places. Cash postings round to cents with HALF_UP, matching the cash ledger precision.

The buffer applies to Market and triggered Stop orders. A Stop latches `triggerPrice` from the first authoritative quote meeting its stop condition and applies its buffer to that quote. `referencePrice` and `referenceAt` remain the original submission quote for auditing. A gap is measured from the triggering quote, not the stop threshold. Retries retain the first committed trigger price; legacy triggered orders without it retain submission-based protection. The initial cash reservation remains based on the submission quote; settlement rechecks available cash and can reject a gap that is unaffordable. Limit and Stop-Limit use their explicit limits. Preference changes affect new orders only.

BUY orders reserve quantity times the limit or protected BUY maximum. SELL orders reserve shares within the selected account. Shared cash reservations span all of a user's accounts. Acceptance does not move balances or holdings. Filling, rejection and cancellation release the reservation; only a fill posts cash and holding movements.

### Response

```json
{
  "orderId": 42,
  "accountId": 1,
  "instrumentId": 7,
  "orderType": "BUY",
  "executionType": "LIMIT",
  "status": "ACCEPTED",
  "quantity": 10,
  "indicativePrice": 100,
  "limitPrice": 95,
  "stopPrice": null,
  "bufferPercent": 1,
  "referencePrice": 100,
  "referenceAt": "2026-01-05T15:00:00Z",
  "sessionId": 1,
  "triggeredAt": null,
  "triggerPrice": null,
  "evaluatedAt": "2026-01-05T15:00:00Z",
  "reservedCash": 950,
  "reservedShares": 0,
  "executionPrice": null,
  "rejectionCode": null,
  "rejectionReason": null,
  "submittedAt": "2026-10-15T15:00:00Z",
  "resolvedAt": null,
  "simulatedAt": "2026-01-05T15:00:00Z"
}
```

`PENDING` is submission validation; `ACCEPTED` is an open order; `FILLED`, `REJECTED`, and `CANCELLED` are terminal. `triggeredAt` is a latched simulation timestamp rather than another status. `evaluatedAt` is the durable simulation watermark and, for a fill, its simulated execution position. Submission and resolution timestamps remain real server times. Historical orders may lack execution context.

A buffer breach returns 201 with `status: REJECTED`, `rejectionCode: EXECUTION_BUFFER_EXCEEDED`, and an explanatory `rejectionReason`. Other business-rule rejections use `TRADING_RULE_FAILED`. Malformed input is 400, missing authentication 401, foreign or archived account submission 403, missing account 404, and unavailable submission quotes 503. Business-rule rejections write no fill or ledger movements.

A repeated account ID and `clientReference` returns the original order without reserving or filling again. Unexpected settlement failures retain `ACCEPTED` and reservations, write `EXECUTION_FAILED`, and retry with exponential backoff capped at 60 seconds. Market retries check the current quote. Legacy accepted orders without server execution context are not retried automatically.

## Read and cancel

| Method | Path | Result |
| --- | --- | --- |
| GET | `/api/orders` | One page of owned orders, newest first, with the response fields above; `page` (zero-based, default 0) and `size` (default 50, at most 200) select it and `X-Total-Count` carries the total (BR-11) |
| GET | `/api/orders/{orderId}` | One owned order |
| POST | `/api/orders/{orderId}/cancel` | Cancel an open order and release reservations |
| GET | `/api/orders/{orderId}/audit` | Chronological lifecycle audit entries, each with the quote its stage was priced against: `executionPrice` for `FILLED`, `triggerPrice` for `TRIGGERED`, otherwise `referencePrice` (BR-15) |
| GET | `/api/orders/stream` | Existing bearer-authenticated SSE order updates |

Missing and foreign order IDs return 404. Repeated cancellation returns the cancelled order. Cancelling a filled or rejected order returns 409. A cancellation and a fill racing each other have one terminal outcome and at most one fill.

## Replay execution and operations

`EXECUTION_MARKET_URL` points to Holdings and Trade (default `http://localhost:8082`; Compose uses its service hostname). Its replay clock is authoritative for both the UI and execution. `app.execution.poll-millis` defaults to 1000; `app.execution.enabled=false` disables background evaluation for isolated tests.

The evaluator reads accepted orders without a browser connection, loads the fixed session's PostgreSQL or Parquet ticks, and processes chronological batches of at most 1000 ticks per order per poll. Forward movement, including observed forward seeks, evaluates crossed ticks; rewinds neither undo fills nor reprocess earlier positions. Open orders resume from stored watermarks after restart. Missing data keeps orders and reservations open until recovery or cancellation. Orders expire at the submission day's regular market close; partial fills and fractional shares remain unsupported; edits use atomic replacement as described below.

Committed lifecycle events carry execution context to Kafka, including an updated ACCEPTED snapshot when a Stop latches. Audit entries also reach `platform-records`. Reporting reads these messages alone; [history republishing](../../db/README.md#reporting-feed-tools) includes the same execution fields.

## Validation

Run the service's Maven tests and both Java Javadoc commands from [repository instructions](../../AGENTS.md). The normal H2 suite covers lifecycle and concurrent races. `PostgresOrderConcurrencyTest` repeats those cases only when `ORDER_TEST_DISPOSABLE_POSTGRES_URL` is set to a JDBC PostgreSQL URL; set `ORDER_TEST_POSTGRES_USER` and `ORDER_TEST_POSTGRES_PASSWORD` too. This opt-in test uses Hibernate `create-drop`: the named database must be explicitly disposable and dedicated to the test.

### Day orders and replay time

Orders default to DAY: any remaining open quantity expires at the submission simulation day's regular market close (15:00 America/Chicago, including daylight saving time). The final seeded one-second tick can fill an eligible order before remaining orders expire. Expiry uses `CANCELLED` with `rejectionCode: ORDER_EXPIRED` and an explanatory reason, releases all reservations atomically, and emits the cancellation audit/event. Manual cancellation remains idempotent and available without a quote.

A forward seek processes crossed ticks chronologically through the original day's close before expiring an unfilled order; bounded batches resume on subsequent polls. Later-day prices cannot fill an expired day order. Rewinds never undo fills, triggers, cancellations, or expiry, and never reprocess positions before the order's persisted watermark. Orders remain isolated to their submission simulation session. Expiry cannot advance while the authoritative market cursor is unavailable.

Apply [V013](../../db/migrations/V013__Order_audit_lifecycle.sql) to permit the `TRIGGERED` and `CANCELLED` audit events on PostgreSQL. Without this migration those transitions roll back under the original audit constraint.

### Editing an open order

`POST /api/orders/{orderId}/replace` accepts the same validated body as submission, with a new `clientReference` and the original account, instrument, BUY/SELL side, and session. Quantity, execution type, and conditional prices may change. The server locks the owner, account and original order, releases its reservation, and validates/reserves the replacement in one transaction. A validation failure rolls everything back, preserving the original order. Foreign orders return 404; terminal, expired, or future-watermark orders return 409.

A successful edit returns 200 with the replacement outcome. The original is CANCELLED with `ORDER_REPLACED` and a replacement-order reference. Its submission quote and history are preserved. The new order snapshots the current server quote, saved buffer and simulation submission day, resets triggering, and settles in the normal separate execution transaction. Repeating the same replacement key returns the recorded replacement. Committed events and historical Kafka republishing retain both rows and their audit history.
