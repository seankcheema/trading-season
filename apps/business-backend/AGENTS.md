# Java backend instructions

- Keep HTTP validation and response mapping in controllers; business logic belongs in services and persistence in repositories.
- This app uses database sessions, not the NestJS JWT contract. Check [API ownership](../../docs/reference/api.md) before changing authentication.
- There is no configured Flyway runner. Follow [database change rules](../../docs/reference/database.md#change-rules) and never treat the destructive bootstrap as an incremental upgrade.
- Use the H2 test profile for existing integration tests; inspect PostgreSQL-specific changes against the actual SQL as well.
- Follow the root Java completion requirement: update affected Javadocs, regenerate, and review changed pages using the [documented command](../../docs/guides/development.md#javadocs).
