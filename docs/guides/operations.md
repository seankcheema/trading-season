# Operations

## Configuration ownership

| Component | Configuration | Defaults |
| --- | --- | --- |
| Holdings and Trade service | [application.properties](../../apps/holdings-and-trade-service/src/main/resources/application.properties) | HTTP 8081; PostgreSQL localhost:5432/trading_season |
| Order and Sell service | [application.properties](../../apps/order-and-sell-service/src/main/resources/application.properties) | HTTP 8082; PostgreSQL localhost:5432/trading_season |
| Auth service | [Auth setup](../../apps/auth-service/README.md) and [database configuration](../../apps/auth-service/src/config/database.config.ts) | HTTP 3001; PostgreSQL localhost:5433/auth_db |
| Client UI container | [Client Dockerfile](../../apps/client-ui/Dockerfile) | HTTP 4200; Nginx proxies `/api` to Holdings and Trade |
| Reporting UI | [Reporting UI](../../apps/reporting-ui/README.md) | HTTP 4300 |
| Reporting service | [Reporting service README](../../apps/reporting-service/README.md) and [OpenAPI spec](../../apps/reporting-service/openapi.yaml) | HTTP 8083; Swagger UI `/docs` |
| Kafka broker | [Local Compose](../../infrastructure/docker-compose/docker-compose.local.yml) | Host 29092, in-network kafka:9092; topic trade-events with 3 partitions |
| Local containers | [Local Compose](../../infrastructure/docker-compose/docker-compose.local.yml) | Application containers, the business database volume, and archive cache |
| Jenkins | [Pipeline](../../infrastructure/jenkins/Jenkinsfile), [disk-space runbook](../../infrastructure/jenkins/README.md), [Compose](../../infrastructure/docker-compose/docker-compose.jenkins.yml) | Jenkins UI on host port 8888 |

Both Java services read SPRING_DATASOURCE_URL, SPRING_DATASOURCE_USERNAME, SPRING_DATASOURCE_PASSWORD, AUTH_JWK_SET_URI, AUTH_JWT_ISSUER, and CORS_ORIGINS. Both must connect to the same trading_season database and must use the same AUTH_JWT_ISSUER value or token validation fails. AUTH_JWT_ISSUER must equal the auth service's JWT_ISSUER or every token is rejected. Auth reads DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, PORT, JWT_PRIVATE_KEY, JWT_PUBLIC_KEY, and JWT_ISSUER. Reporting service reads DATABASE_URL, AUTH_SERVICE_URL, AUTH_JWT_ISSUER, CORS_ORIGINS, REPORTING_SERVICE_HOST, REPORTING_SERVICE_PORT, SCHEDULER_ENABLED, and SCHEDULER_INTERVAL_MINUTES. Node startup loads .env from its working directory; Compose must receive the appropriate environment file explicitly. KAFKA_BOOTSTRAP_SERVERS names the event broker and defaults to localhost:29092 on the host and kafka:9092 inside Compose; no service reads it yet.

In local Compose, DB_PASSWORD configures the one database every service connects to, auth included. The auth service currently connects as the application role, which can read every trading table; a role granted only `user_accounts` and `refresh_tokens` would restore most of the isolation the separate database used to provide, and is worth adding before this reaches anything but a development machine. Defaults are for disposable local development; production credentials and signing keys must come from managed secrets.

**Microservice deployment constraint:** Order and Sell Service and Holdings and Trade Service must use the same database version and schema version. Schema changes require coordinating both service deployments or adding backwards-compatible migrations.

## Local operation

Follow [development setup](development.md) for key generation and database startup. From repository root:

```sh
docker compose --env-file apps/auth-service/.env -f infrastructure/docker-compose/docker-compose.local.yml ps
docker compose --env-file apps/auth-service/.env -f infrastructure/docker-compose/docker-compose.local.yml logs --tail 100 db auth-db
```

The local Compose file contains outdated Java backend configuration with build context and port mappings. Run both Java services through Maven: Order and Sell Service on port 8081 and Holdings and Trade Service on port 8082. The UI calls both, split by path, so the dashboard needs both running. The UI has no active Compose service. No production Compose file or Kubernetes deployment is supplied.

Both Java services must use the same database connection (localhost:5432/trading_season by default) and verify database compatibility before startup. If your deployment splits services across machines or containers, ensure network connectivity to the shared database and identical schema versions on both services.
For databases created by `scripts/setup-local.sh`, add `--project-name trading-season-local` to these inspection commands. Stop them without removing data with:

```sh
docker compose --project-name trading-season-local --env-file apps/auth-service/.env \
  -f infrastructure/docker-compose/docker-compose.local.yml stop db auth-db
```

Local Compose builds the client UI, both Java services, auth service, the Flask reporting service, and the reporting UI. It publishes the client UI on 4200, reporting UI on 4300, reporting service on 8083, Java services on 8081 and 8082, auth on 3001, and the Kafka broker on 29092. Reporting service exposes Swagger UI at `/docs` and its checked-in OpenAPI document at `/openapi.yaml`. The broker runs and holds the trade-events topic, but no service publishes to it or consumes from it yet; producing and consuming are proposed work. No production Compose file or Kubernetes deployment is supplied.

Auth GET /health reports process liveness, not database readiness. Check startup logs and database connectivity separately. Database volumes persist across ordinary container shutdown; removing volumes deletes their data. Back up retained data before schema or volume changes and verify restoration in a separate database.

Ordinary Compose startup initializes only an empty `public` schema. The `db-init` one-shot container mounts the canonical `apps/market-data/db/migrations` directory and applies every checked-in `V*.sql` migration in filename order exactly once; any existing schema with one or more tables is left untouched. `db_data` remains the PostgreSQL store, `kafka_data` holds the broker's KRaft metadata and partition logs, and `market_data_archive` caches generated files across container recreation. Removing `kafka_data` discards every published event and every consumer group's committed position; the next startup reformats storage and recreates the topic. Run the `initialize` profile only for first-time disposable setup. Thereafter the opt-in `seed` profile waits for database readiness and runs numbered steps 0002 through 0004 without destructive initialization.

Because the seed container cannot inspect free space inside the separate PostgreSQL volume, set `MARKET_DATA_AVAILABLE_DISK_GB` to the volume's available capacity before starting the `seed` profile. The default `parquet` mode retains raw ticks in the archive volume and imports only candles into PostgreSQL. The importer commits and checkpoints one month at a time; a rerun verifies and skips completed months. Set tick storage to `postgres` only for an intentional high-capacity deployment.

## CI and artifacts

Jenkins requires a Linux agent with Docker and Compose, Java 21 at its configured JAVA_HOME, the Maven tool named Maven, and the NodeJS tool named NodeJS running Node 24.x at 24.8.0 or later. A preflight requires at least 5 GiB free workspace storage; image builds need additional headroom.

The pipeline checks out the branch tip, installs client UI and auth dependencies once, and runs five suites in parallel: both Java services, auth, frontend, and synthetic market data. Each Java branch uses its own workspace-local Maven repository under `.m2/<service>`; it does not delete or warm a shared Maven cache. Java tests enforce package coverage floors (85 percent Holdings and Trade, 70 percent Order and Sell); UI and auth retain their configured whole-suite floors.

The parallel test group stops its other branches on the first failure. Failures propagate without `catchError`, and unstable results skip later stages; Jenkins does not proceed to documentation, E2E, or Docker deployment after a failed test gate. Each started suite publishes reports from its own `post` block, including after failure. Missing required JUnit reports fail the build. Java tests include buy/sell fills and ledger consistency, missing credentials, rejected trades, and transaction rollback. The market-data suite initializes a disposable PostgreSQL database, checks persistence across restart, generates and imports two days of data, repeats the import, and records resource and storage reports. Its Docker resource names derive from a normalized build-tag hash and are removed after the stage.

| Suite | Outputs |
| --- | --- |
| Holdings and Trade | apps/holdings-and-trade-service/target/surefire-reports and target/site/jacoco |
| Order and Sell | apps/order-and-sell-service/target/surefire-reports and target/site/jacoco |
| Auth | apps/auth-service/coverage and reports/junit |
| Reporting service | apps/reporting-service/coverage and reports/junit |
| UI | apps/client-ui/coverage |
| End-to-end | apps/client-ui/reports/playwright |
| Java API documentation | Each Java service's target/reports/apidocs |

After successful tests, Jenkins generates and archives both services' Javadocs using maven-javadoc-plugin 3.11.2 and the same isolated repositories. Source changes still require local review and refresh of the checked-in docs/JAVA_DOCS directories; Jenkins archives do not update Git.

Reporting-service CI runs inside the upstream `python:3.14-slim` container rather than a Jenkins-managed Python tool. The slim tag avoids pulling the full image's `buildpack-deps` base, which carries a large set of `-dev` libraries for compiling native extensions that this stage's pure-Python/precompiled-wheel dependencies do not need; pulling the full image here while the Synthetic Market Data Integration branch builds its own image in parallel has exhausted the Jenkins agent's disk. The stage installs `requirements.txt` and runs `pytest`; a failed dependency install or test run fails the stage and the build, and a missing JUnit report also fails it. It archives `apps/reporting-service/coverage` and `apps/reporting-service/reports`, and repairs permissions on those artifact directories before checkout and after the test run so stale Docker-owned files do not block the next workspace cleanup.

Every tier fails its own stage below 70% coverage; the mechanisms are listed under [coverage floors](development.md#coverage-floors). A stage that passes has already cleared the floor, so the archived reports are for inspection, not for a manual check.

CI uses two Playwright workers and allows two retries to collect diagnostics. A test that passes only on retry still fails the E2E stage through `failOnFlakyTests` in [the Playwright configuration](../../apps/client-ui/playwright.config.ts). Access-token expiry alone renews the session; sign-out occurs on explicit logout, the configured inactivity deadline, or missing or rejected refresh credentials. Network and refresh-service failures preserve credentials for retry. These cases are covered by the login, inactivity, and authentication unit tests.

Pre-E2E cleanup deletes disposable Java target output and frontend coverage only after stage publication. It does not prune shared Docker or dependency caches. Stack startup runs only when validation is successful and retains the existing local Compose behavior: build-scoped JWT keys, service checks, and a successful stack left running for inspection. Jenkins starts the long-running local stack first and then runs the one-shot `kafka-init` container as a separate Compose step, because detached startup of the whole stack can lose a short-lived init container before Compose finishes tracking it. Final `post cleanup` runs after other post conditions on success, failure, or abort. It removes the named, build-scoped E2E container and synthetic-market test resources, tears down a failed stack only if this build started it, and applies the existing Docker cache policy. Resource and cache cleanup errors are isolated so workspace deletion is still attempted; reports are published before deletion. Workspace deletion removes isolated Maven repositories. An unavailable Jenkins agent or Docker daemon can prevent teardown and is reported in the cleanup log.

The optional Jenkins container is not the native agent configuration. Start only its Jenkins service to avoid competing application stacks:

```sh
docker compose --project-name trading-season-jenkins \
  -f infrastructure/docker-compose/docker-compose.jenkins.yml up -d jenkins
```

See [Development](development.md#checks) for local commands and [Javadocs](../JAVA_DOCS/README.md) for generated documentation refresh.

## Troubleshooting

**General issues:**
- Connection refused: confirm database containers are healthy, published ports are free, and the app uses host names appropriate to its environment. Every service connects to the same database: host connections use port 5432; containers use db:5432.
- Missing business tables: apply the documented disposable bootstrap in the [database guide](../reference/database.md); Java does not run Flyway automatically.
- Kafka never becomes healthy: the broker needs roughly 30 seconds to start, and the healthcheck makes a real API call rather than checking the port. Check `logs kafka` before raising the timeout.
- Topic trade-events is missing: auto-creation is disabled on purpose, so the topic exists only once the one-shot `kafka-init` container has run. Check `logs kafka-init`; it is safe to rerun.
- Auth startup fails on keys: generate an RSA pair, replace placeholder values, and preserve literal backslash-n escapes. Run from the auth directory so .env loads.

**Microservice-specific issues:**
- One Java service fails to connect to database while the other succeeds: both must connect to the same trading_season database; verify connection strings and that both services use the same DB_HOST and DB_PORT.
- Schema version mismatch errors: Holdings and Trade Service and Order and Sell Service must use schema versions that are compatible. Add migrations as needed to keep both services on the same version. See [database guide](../reference/database.md).
- One Java service starts but the other does not: both require the same AUTH_JWK_SET_URI, AUTH_JWT_ISSUER, and JWT signing keys. Mismatched auth configuration will cause startup failures or immediate 401 responses.

**Token and auth issues:**
- JWT verification fails: check the signing/public key pair and expiry. The Java backend returns 401 when the JWKS at AUTH_JWK_SET_URI is unreachable, the signature does not match, the token has expired, iss differs from AUTH_JWT_ISSUER, or sub is not a UUID. Java caches the key set for five minutes and refetches early when a token carries an unknown kid; the auth service derives kid from the public key, so a key rotation is picked up on the first token signed with the new key. The auth service's own Passport strategy does not enforce issuer/audience; do not assume it does.
- Logout revokes the supplied refresh token; access JWTs remain valid until expiry. See the [authentication endpoints](../reference/api.md#authentication-endpoints).

**CI and deployment:**
- Jenkins fails before tests: verify the configured Java/Maven paths and Node version on the actual agent, not just the optional image.
- Jenkins fails before tests: verify the configured Java/Maven paths and Node version (24.x at 24.8.0 or later, compatible with Angular 21.2.x) on the actual agent, not just the optional image.
- Jenkins fails with `Failed to clean the workspace` or `Operation not permitted` under `apps/reporting-service`: the pytest container runs as root and leaves root-owned directories (`reports`, `coverage`, `.pytest_cache`, `__pycache__`) in the workspace. Run the latest pipeline definition: the reporting-service stage repairs permissions on all of `apps/reporting-service` on every exit path, and the Checkout stage repairs them again before checkout. A workspace already stuck from an earlier build must be removed once by hand on the Jenkins host, for example `sudo rm -rf '/var/lib/jenkins/workspace/<job>'`, or through the same `docker run --rm -v <workspace>:/ws alpine chmod -R a+rwX /ws` repair.
- Synthetic market-data CI derives Docker resource names from a normalized hash of the Jenkins build tag, so encoded multibranch names such as `%2F` do not need special handling. The stage creates and removes build-scoped database and archive volumes; do not pre-seed PostgreSQL or generate a persistent archive on the Jenkins VM.
- Market replay reports unavailable prices: for a Parquet-backed session, verify that the archive contains the selected `ticks-YYYY-MM-DD.parquet` partition. Set `MARKET_REPLAY_ARCHIVE_LOCATION` to its absolute root when the metadata path belongs to an older checkout or another host; local repository runs also discover the matching archive under `apps/market-data/db/seeds`. Replay deliberately does not fall back to one-minute candles.
- UI renders but login does not reach an API: form submission is not yet wired to a service. See [architecture](../reference/architecture.md).

Database initialization in local and Jenkins Compose now mounts the canonical `apps/market-data/db/migrations` directory and applies every checked-in `V*.sql` migration once to an empty public schema. Existing databases are skipped; partial schemas require a separately reviewed repair. The migration set still guards against overwriting retained data.

The database tests directory has been removed. Jenkins no longer invokes its pytest suite or publishes its JUnit report; the synthetic market-data stage still runs generation, validation, import, and repeated import, and archives resource/storage reports.

Market-data Python entry points and requirements are under `apps/market-data/db/scripts/python`; Windows launchers are under `apps/market-data/db/scripts/powershell`. Docker and Jenkins use the relocated Python paths. The database virtual environment and seed locations are unchanged.

## Watchlist schema upgrade

Deploy the client and Holdings and Trade watchlist changes after applying V002 as the business database owner. Fresh Compose initialization applies the full checked-in `V*.sql` sequence, including V002; its existing-database branch skips initialization, so retained databases still require the explicit [watchlist upgrade](../reference/database.md#watchlist-migration) before deployment. The migration adds one table without modifying existing data.
