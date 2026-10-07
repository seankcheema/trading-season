# Limit orders and practice mode implementation plan

Status: proposed work; these features are not implemented yet.

**Delete this file after the implementation and validation below are complete.** Before deleting it, move any lasting behavior, API, configuration, and schema documentation into the canonical service READMEs, root README, and database README. This is a temporary implementation checklist, not permanent product documentation.

## Objective and existing behavior

Add explicit limit orders that wait for an acceptable price, followed by guided practice scenarios. Preserve immediate trading with execution-buffer protection.

Currently, the UI performs an advisory eligibility check before submission. A failed check creates no order. Submitted orders briefly enter PENDING, then become FILLED or REJECTED. Execution uses the authoritative Holdings and Trade replay quote. There is no durable waiting-order feature.

Relevant context:

- [Service map and order flow](README.md)
- [Order and Sell execution contract](apps/order-and-sell-service/README.md#execution-price-protection)
- [Holdings and Trade market and cash behavior](apps/holdings-and-trade-service/README.md)
- [Client UI](apps/client-ui/README.md)
- [Database and migration process](db/README.md)

## 1. Define the trading contract

- [ ] Offer Trade now and Limit order in both trading tickets.
- [ ] Keep BUY and SELL as the order side; add a separate executionType field for immediate versus limit execution.
- [ ] Apply the saved execution buffer to immediate orders. Limit orders use an explicit limitPrice, without widening it by the saved buffer.
- [ ] Buy limits permit execution at or below the limit; sell limits permit execution at or above it. Equality passes and better prices are allowed.
- [ ] Check the current quote on placement; fill immediately if eligible, otherwise accept as OPEN.
- [ ] Keep full fills for the first version, matching the existing simulation model. Defer partial fills, liquidity modeling, and order editing.
- [ ] Require an expiration in simulation time for the first version and explain it in the UI.

Example: a buy limit of $101 remains OPEN while the quote is $102. At the first eligible quote of $101 or lower, it fills at that actual quote price.

## 2. Persist open orders and reservations

- [ ] Add a new migration; do not edit applied migrations.
- [ ] Add execution type, limit price, simulation expiration, and durable replay evaluation context.
- [ ] Extend status constraints with OPEN, CANCELED, and EXPIRED; retain existing historical statuses.
- [ ] Persist reservations and index open orders for efficient session/instrument processing.
- [ ] Keep existing client-reference idempotency and one-fill-per-order constraints.
- [ ] Backfill existing orders as immediate orders and preserve their history.

Lifecycle:

```text
Submission -> PENDING -> OPEN -> FILLED
                             -> CANCELED
                             -> EXPIRED

Invalid submission -> REJECTED
Immediate submission -> FILLED or REJECTED
```

PENDING is processing; OPEN is accepted and waiting. Define and document terminal outcomes if credentials disappear or an instrument becomes non-tradable while an order is open.

## 3. Reserve resources consistently

- [ ] Reserve quantity multiplied by limit price for buys against shared user cash.
- [ ] Reserve shares for sells against the selected account and instrument.
- [ ] Distinguish total cash, reserved cash, and spendable cash without recording a completed trade at reservation time.
- [ ] Make immediate trades, additional limit orders, withdrawals, and holdings checks respect reservations.
- [ ] Release reservations exactly once on cancellation, expiration, or terminal rejection.
- [ ] On fill, consume the reservation and release unused cash when the actual buy price is below the limit.
- [ ] Make account archiving cancel open orders and release their reservations atomically before archiving succeeds.
- [ ] Establish consistent lock ordering across submission, matching, cancellation, withdrawals, and archiving to avoid deadlocks.
- [ ] Keep order and reservation writes owned by Order and Sell; document the reservation reads required by Holdings and Trade.

## 4. Implement reliable matching

- [ ] Add a background processor in Order and Sell using authoritative Holdings and Trade replay data.
- [ ] Keep an order OPEN when the price is outside its limit.
- [ ] Keep orders OPEN during temporary quote outages and expose a waiting reason; define bounded retries and operational visibility.
- [ ] Recheck credentials, account eligibility, tradability, and reserved resources under locks before filling.
- [ ] Atomically write the fill, cash movement, holding movement, balances, reservation release, order status, and audit event.
- [ ] Serialize fill versus cancellation or expiration so exactly one terminal transition wins.
- [ ] Support multiple workers and process restarts without duplicate fills or lost reservations.
- [ ] Use existing database persistence for coordination; a message broker is not required for the initial implementation.

## 5. Define replay semantics before enabling matching

The current market cursor is shared. Waiting orders need a stable timeline and synchronization with clock changes.

- [ ] Bind each order to a resolved market session and the server placement cursor; do not use an arbitrary client timestamp to select execution quotes.
- [ ] Add an authoritative ordered-tick/range contract so matching can inspect intervening quotes rather than only polling the latest snapshot.
- [ ] Evaluate subsequent ticks in chronological order and fill at the first qualifying quote after acceptance.
- [ ] Persist evaluation progress and a replay revision or equivalent coordination mechanism.
- [ ] Process intervening ticks on forward jumps; do not miss a qualifying price between two sampled snapshots.
- [ ] Define expiration precedence: a quote at or after expiresAt does not fill the order; process earlier eligible ticks before expiring it on a forward jump.
- [ ] Stop timeline progression while paused. Placement may still fill against the current paused quote if it already qualifies.
- [ ] After a rewind, suspend further matching until the cursor catches up to the previously evaluated position. Preserve completed trades and never replay a fill.
- [ ] Serialize or version clock changes and matching to prevent fills against inconsistent snapshots.
- [ ] Preserve actual server timestamps for audit records and simulation timestamps for market execution and expiration.
- [ ] Clearly disclose the shared-clock limitation in the initial release. Give separate practice runs independent replay clocks before enabling isolated multi-user practice.

## 6. Extend API and UI

- [ ] Extend submission, eligibility checks, and order responses with execution type, limit price, expiration, reservations, and waiting state.
- [ ] Treat an unfavorable current price as acceptable for placing a waiting limit order; update the UI precheck accordingly.
- [ ] Keep eligibility checks advisory and reservation-free; submission must validate and reserve again under locks.
- [ ] Add an ownership-protected cancellation endpoint with safe repeated-cancellation behavior.
- [ ] Extend order history and existing polling to monitor OPEN orders, including fills while the trading dialog is closed.
- [ ] Add an Open Orders panel with side, symbol, quantity, limit, current quote, waiting reason, reservation, expiration, and Cancel action.
- [ ] Refresh cash and holdings after background fills, cancellation, and expiration; retry refreshes independently of submission.
- [ ] Show total, reserved, and spendable cash and distinguish owned shares from shares available to sell.
- [ ] Keep accessibility, responsive layouts, account selection, and simulation-time filtering consistent across both tickets and order views.
- [ ] Update development proxy and Nginx routing if adding paths outside the existing orders route.

## 7. Add deterministic practice scenarios

Use a fresh disposable practice portfolio and controlled synthetic prices for each exercise. Reset through a defined practice lifecycle; never delete production history or rerun destructive bootstrap SQL against a normal database.

| Exercise | Setup | Expected result |
| --- | --- | --- |
| Buy waits and fills | Buy limit $101; quotes $102, $101, $100 | OPEN at $102; fill at the first eligible quote, $101 |
| Sell waits and fills | Own shares; sell limit $99; quotes $98, $99, $100 | OPEN at $98; fill at $99 |
| Better execution | Buy limit $101; quotes $102, $100 | Fill at $100 and release unused reserved cash |
| Boundary equality | Buy limit $101 at $101; sell limit $99 at $99 | Both fill |
| Cancel | Keep buy quote above limit, then cancel | Reservation released; later eligible quotes cannot fill |
| Expire | No eligible quote before expiration | EXPIRED and reservation released |
| Competing buys | Two orders jointly exceed shared spendable cash, including across accounts | Second reservation cannot spend cash already reserved |
| Competing sells | Two sells jointly exceed unreserved shares | Second order cannot reserve the same shares |
| Pause and jump | Pause, then jump forward across an eligible tick | No progression while paused; fill uses the first eligible intervening tick |
| Rewind | Rewind after processing or filling | No duplicate fill; evaluation resumes only after catch-up |
| Temporary outage | Make authoritative quotes temporarily unavailable | Order stays OPEN and resumes safely after recovery |

## 8. Validation and completion

- [ ] Add meaningful Java tests for lifecycle transitions, price boundaries, reservations, ownership isolation, expiration, and ledger rollback.
- [ ] Use PostgreSQL integration tests for locking, concurrent submissions, fill/cancel races, withdrawals, archiving, and worker coordination; do not rely only on H2 for those behaviors.
- [ ] Test replay jumps, expiration boundaries, rewind, session separation, and restart recovery with deterministic data.
- [ ] Add Angular tests for ticket validation, waiting-order prechecks, statuses, cancellation, and balance refreshes.
- [ ] Add end-to-end coverage for placing, waiting, filling, canceling, and expiring practice orders; update API fixtures as needed.
- [ ] Run relevant Java tests, UI tests, and the UI build using repository commands.
- [ ] Update canonical service READMEs, root order-flow diagrams, database documentation, and any changed operational configuration documentation.
- [ ] Update affected Javadoc comments, regenerate both Java services with the pinned plugin without errors or warnings, review changed class pages, and refresh docs/JAVA_DOCS.
- [ ] Check documentation links and anchors, scan Markdown for emojis, and run git diff --check.
- [ ] Delete this plan once all implemented scope is validated and lasting documentation has been transferred to its canonical locations.

## Delivery order

1. Trading contract, migration, and resource reservations across both services.
2. Limit submission, durable OPEN state, expiration fields, and cancellation.
3. Authoritative replay range contract, synchronized matching, and recovery.
4. Trading tickets, Open Orders panel, and resource displays.
5. Isolated practice runs and guided scenarios.
6. Final validation, canonical documentation, generated Javadocs, and removal of this file.

Keep user-facing limit submission disabled until reservations, matching, cancellation, expiration, and recovery work together. Each stage should be reviewable before the next depends on it.
