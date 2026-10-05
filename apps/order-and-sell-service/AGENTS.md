# Order and Sell Service Instructions

This service owns order submission, validation, execution, instrument reference data, and order history on port 8081. Holdings and Trade owns profiles, accounts, cash operations, and holdings reads on port 8082. Both share the business database.

- Resolve user ownership from the verified token subject before reading or writing an account.
- Keep validation and response mapping in controllers, business logic in services, and persistence in repositories.
- Execute fills, shared user cash balance updates, cash transactions, holding movements, holdings, and audit changes in one transaction. A persistence failure must roll back the whole submission.
- Reject orders whose credential record no longer exists. Account activation status was removed; do not restore it implicitly.
- Preserve real audit timestamps separately from the simulation cursor and retain idempotent client references.
- Mirror source packages under `src/test/java/app`. Use H2 with the test profile, and cover cross-user isolation and buy/sell ledgers.
- Run `mvn -B test`; JaCoCo enforces the configured 70 percent floor per package on every counter.
- Update affected Javadoc comments and regenerate both services with the pinned plugin as required by the root instructions.

See [API reference](../../docs/reference/api.md), [Database](../../docs/reference/database.md), and [Development](../../docs/guides/development.md) for canonical contracts and commands.
