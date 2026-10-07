# Order and Sell Service Instructions

This service owns order submission, validation, execution, instrument reference data, and order history on port 8081. Holdings and Trade owns profiles, accounts, cash operations, and holdings reads on port 8082. Both share the business database.

- Resolve user ownership from the verified token subject before reading or writing an account.
- Keep validation and response mapping in controllers, business logic in services, and persistence in repositories.
- Commit the accepted order in its own transaction before executing it (BR-06). Execute fills, shared user cash balance updates, cash transactions, holding movements, holdings, and the execution audit change in one separate transaction (BR-09). A persistence failure during execution rolls back only the execution; the accepted order stays on record with an `EXECUTION_FAILED` audit entry.
- Publish order status changes only from `AFTER_COMMIT` transactional event listeners in `order/event/`, never from inside the transaction. Keep the publisher and the `order-status-pusher` consumer behind `app.events.enabled`; the `GET /api/orders/stream` endpoint is always registered. The `portfolio-valuation-capture` group belongs to Holdings and Trade and `reporting-ingester` to the reporting service.
- Reject orders whose credential record no longer exists. Account activation status was removed; do not restore it implicitly.
- Preserve real audit timestamps separately from the simulation cursor and retain idempotent client references.
- Mirror source packages under `src/test/java/app`. Use H2 with the test profile, and cover cross-user isolation and buy/sell ledgers.
- Run `mvn -B test`; JaCoCo enforces the configured 70 percent floor per package on every counter.
- Update affected Javadoc comments and regenerate both services with the pinned plugin as required by the root instructions.

See the [README](README.md) for endpoints and commands and [db/README.md](../../db/README.md) for the schema.
