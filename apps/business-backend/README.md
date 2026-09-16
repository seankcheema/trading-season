# Business backend

Spring Boot application targeting Java 21. Acts as an OAuth2 resource server: it verifies RS256 access tokens issued by the [auth service](../auth-service/README.md) and never handles passwords. A business account is keyed by the auth service's user UUID, carried as the token's sub claim.


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

The app defaults to port 8080 and a business PostgreSQL database; tests use H2 and do not need a running auth service. Configuration lives in [application.properties](src/main/resources/application.properties):

| Variable | Default | Purpose |
| --- | --- | --- |
| AUTH_JWK_SET_URI | http://localhost:3001/.well-known/jwks.json | Auth service JWKS; fetched on first authenticated request and cached |
| AUTH_JWT_ISSUER | https://auth.dualeapa.local | Required iss claim; must equal the auth service's JWT_ISSUER |
| CORS_ORIGINS | http://localhost:4200 | Comma-separated browser origins allowed to call the API |

See [API contracts](../../docs/reference/api.md), [development and Javadocs](../../docs/guides/development.md#javadocs), and the [database reference](../../docs/reference/database.md). Update affected Javadoc comments and regenerate documentation with every Java code change.
