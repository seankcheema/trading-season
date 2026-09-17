# Business backend


Spring Boot application targeting Java 21. Implements registration and username/password login with database sessions, plus public snapshot, candle, and SSE replay endpoints for seeded simulated stocks. Its identities are separate from NestJS auth users. Acts as an OAuth2 resource server: it verifies RS256 access tokens issued by the [auth service](../auth-service/README.md) and never handles passwords. A business account is keyed by the auth service's user UUID, carried as the token's sub claim.



Spring Boot source is rooted at `src/main/java/app`. The application entry point is `app.Main`, authentication types live in `app.auth`, and the rest of the business backend is organized by feature package such as `app.order`, `app.user`, `app.account`, and `app.instrument`. Tests mirror that structure under `src/test/java/app`.

Follow [database setup](../../docs/reference/database.md#disposable-business-database-setup) before exercising the API. The business database schema is applied manually: run V001, V002, then V003, and optionally generate and import the synthetic market data 2026-v1 archive. The generated archive is local developer data and is not committed to this repo.

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

## Live ticker setup

There is no separate live-ticker feature flag. The public ticker endpoints are active when the Spring Boot app is running and the business database contains a completed synthetic market-data session.

For a first-time disposable local database, run the market-data workflow from the repository root:

```powershell
$freeDiskGb = [math]::Floor((Get-PSDrive C).Free / 1GB)

apps/business-backend/db/setup-market-data.ps1 `
  -DatabaseUrl postgresql://trading_season:password@localhost:5432/trading_season `
  -AvailableDiskGb $freeDiskGb `
  -InitializeDisposableDatabase
```

For later reseeding of an already initialized disposable database, omit `-InitializeDisposableDatabase`:

```powershell
$freeDiskGb = [math]::Floor((Get-PSDrive C).Free / 1GB)

apps/business-backend/db/setup-market-data.ps1 `
  -DatabaseUrl postgresql://trading_season:password@localhost:5432/trading_season `
  -AvailableDiskGb $freeDiskGb
```

If the script reports `Candle-only 2026-v1 archive detected`, rerun the same command with `-Regenerate` to replace the incompatible local archive. If a previous import for the same simulation session also needs to be replaced, add `-Replace`.

Then start the backend from this directory:

```sh
mvn spring-boot:run
```

Verify the ticker API before opening the UI:

```powershell
Invoke-RestMethod http://localhost:8081/api/market/snapshot
```

The dashboard reads the snapshot and then opens `GET /api/market/stream` automatically. The replay advances one simulated market second per real second by default. Set `MARKET_REPLAY_START_AT` to an ISO-8601 instant when you need a deterministic starting point, or `MARKET_REPLAY_TICK_MILLIS` to change replay speed. The default CORS origin is `http://localhost:4200`.
The app defaults to port 8080 and a business PostgreSQL database; tests use H2 and do not need a running auth service. Configuration lives in [application.properties](src/main/resources/application.properties):

| Variable | Default | Purpose |
| --- | --- | --- |
| AUTH_JWK_SET_URI | http://localhost:3001/.well-known/jwks.json | Auth service JWKS; fetched on first authenticated request and cached |
| AUTH_JWT_ISSUER | https://auth.dualeapa.local | Required iss claim; must equal the auth service's JWT_ISSUER |
| CORS_ORIGINS | http://localhost:4200 | Comma-separated browser origins allowed to call the API |

See [API contracts](../../docs/reference/api.md), [development and Javadocs](../../docs/guides/development.md#javadocs), and the [database reference](../../docs/reference/database.md). Update affected Javadoc comments and regenerate documentation with every Java code change.
