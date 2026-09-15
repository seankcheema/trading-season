# Business backend

Spring Boot application targeting Java 21. Implements registration and username/password login with database sessions, plus public snapshot, candle, and SSE replay endpoints for seeded simulated stocks. Its identities are separate from NestJS auth users.

Follow [database setup](../../docs/reference/database.md#disposable-business-database-setup) before exercising the API. The business database schema is applied manually: run V001, then V002, and optionally generate and import the synthetic market data 2026-v1 archive. The generated archive is local developer data and is not committed to this repo.

```powershell
py -3 -m venv apps/business-backend/db/.venv
apps/business-backend/db/.venv/Scripts/python.exe -m pip install --upgrade pip
apps/business-backend/db/.venv/Scripts/python.exe -m pip install -r apps/business-backend/db/scripts/requirements.txt
```

Use the [numbered cross-platform workflow](db/scripts/README.md). Initialization is a separate, explicitly destructive first-time action; ordinary seeding runs generation, validation, and import only. The `2026-v1` archive contains one-second ticks and tick-derived one-minute candles.

From this directory:

```sh
mvn spring-boot:run
mvn test
```

The app defaults to port 8081 and a business PostgreSQL database; tests use H2. Configuration lives in [application.properties](src/main/resources/application.properties).

See [API contracts](../../docs/reference/api.md), [development and Javadocs](../../docs/guides/development.md#javadocs), and the [database reference](../../docs/reference/database.md). Update affected Javadoc comments and regenerate documentation with every Java code change.
