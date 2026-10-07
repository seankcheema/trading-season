# Order and Sell Service Instructions

This service owns order submission, validation, execution, instrument reference data, and order history on port 8081. Holdings and Trade owns profiles, accounts, cash operations, and holdings reads on port 8082. Both share the business database.

- Resolve user ownership from the verified token subject before reading or writing an account.
- Keep validation and response mapping in controllers, business logic in services, and persistence in repositories.
- Execute fills, shared user cash balance updates, cash transactions, holding movements, holdings, and audit changes in one transaction. A persistence failure must roll back the whole submission.
- Reject orders whose credential record no longer exists. Credential activation status was removed; do not restore it implicitly. Portfolio accounts use `accounts.archived_at`: reject new orders and execution under the account row lock when archived, preserving order history and idempotent retries.
- Preserve real audit timestamps separately from the simulation cursor and retain idempotent client references.
- Mirror source packages under `src/test/java/app`. Use H2 with the test profile, and cover cross-user isolation and buy/sell ledgers.
- Run `mvn -B test`; JaCoCo enforces the configured 70 percent floor per package on every counter.
- Update affected Javadoc comments and regenerate both services with the pinned plugin as required by the root instructions.

See the [README](README.md) for endpoints and commands and [db/README.md](../../db/README.md) for the schema.
