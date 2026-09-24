# Operations

## Configuration ownership

| Component | Configuration | Defaults |
| --- | --- | --- |
| Holdings and Trade service | [application.properties](../../apps/holdings-and-trade-service/src/main/resources/application.properties) | HTTP 8081; PostgreSQL localhost:5432/trading_season |
| Order and Sell service | [application.properties](../../apps/order-and-sell-service/src/main/resources/application.properties) | HTTP 8082; PostgreSQL localhost:5432/trading_season |
| Auth service | [Auth setup](../../apps/auth-service/README.md) and [database configuration](../../apps/auth-service/src/config/database.config.ts) | HTTP 3001; PostgreSQL localhost:5433/auth_db |
| Local containers | [Local Compose](../../infrastructure/docker-compose/docker-compose.local.yml) | Business/auth database volumes and archive cache |
| Jenkins | [Pipeline](../../infrastructure/jenkins/Jenkinsfile), [disk-space runbook](../../infrastructure/jenkins/README.md), [Compose](../../infrastructure/docker-compose/docker-compose.jenkins.yml) | Jenkins UI on host port 8888 |

Java reads SPRING_DATASOURCE_URL, SPRING_DATASOURCE_USERNAME, SPRING_DATASOURCE_PASSWORD, AUTH_JWK_SET_URI, AUTH_JWT_ISSUER, and CORS_ORIGINS. AUTH_JWT_ISSUER must equal the auth service's JWT_ISSUER or every token is rejected. Auth reads DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, PORT, JWT_PRIVATE_KEY, JWT_PUBLIC_KEY, and JWT_ISSUER. Node startup loads .env from its working directory; Compose must receive the appropriate environment file explicitly.

In local Compose, DB_PASSWORD configures the business database and AUTH_DB_PASSWORD configures the auth database. Inside the auth container, the latter is assigned to DB_PASSWORD. Do not confuse those scopes. Defaults are for disposable local development; production credentials and signing keys must come from managed secrets.

## Local operation

Follow [development setup](development.md) for the storage-aware Linux bootstrap, key generation, and database startup. The bootstrap never prunes Docker resources or deletes volumes. From repository root, manual Docker inspection remains available:

```sh
docker compose --env-file apps/auth-service/.env -f infrastructure/docker-compose/docker-compose.local.yml ps
docker compose --env-file apps/auth-service/.env -f infrastructure/docker-compose/docker-compose.local.yml logs --tail 100 db auth-db
```

For databases created by `scripts/setup-local.sh`, add `--project-name trading-season-local` to these inspection commands. Stop them without removing data with:

```sh
docker compose --project-name trading-season-local --env-file apps/auth-service/.env \
  -f infrastructure/docker-compose/docker-compose.local.yml stop db auth-db
```

Local Compose builds both Java services from their application directories and publishes them on ports 8081 and 8082. The UI has no active Compose service, so run it separately through npm when needed. No production Compose file or Kubernetes deployment is supplied.

Auth GET /health reports process liveness, not database readiness. Check startup logs and database connectivity separately. Database volumes persist across ordinary container shutdown; removing volumes deletes their data. Back up retained data before schema or volume changes and verify restoration in a separate database.

Ordinary Compose startup neither initializes nor seeds. `db_data` remains the PostgreSQL store and `market_data_archive` caches generated files across container recreation. Run the `initialize` profile only for first-time disposable setup. Thereafter the opt-in `seed` profile waits for database readiness and runs numbered steps 0002 through 0004 without destructive initialization.

Because the seed container cannot inspect free space inside the separate PostgreSQL volume, set `MARKET_DATA_AVAILABLE_DISK_GB` to the volume's available capacity before starting the `seed` profile. The default `parquet` mode retains raw ticks in the archive volume and imports only candles into PostgreSQL. The importer commits and checkpoints one month at a time; a rerun verifies and skips completed months. Set tick storage to `postgres` only for an intentional high-capacity deployment.

The Linux bootstrap uses the Compose project name `trading-season-local`, keeping its service identities and named volumes separate from the optional Jenkins Compose project. It keeps at least 3 GiB free on filesystems it changes and rechecks capacity after dependency installation, archive copy, and Docker startup. This reserve permits copying an existing archive when it fits; it is not permission to regenerate a full archive, whose staging copy needs additional capacity.

## CI and artifacts

The Jenkins pipeline expects a native agent with Docker, the Maven tool named Maven, and Java 21 at its configured JAVA_HOME. It requires at least 7 GiB of free workspace storage before checkout and runs Java, auth, Angular, end-to-end, script, and build-scoped two-day PostgreSQL integration checks. Full-year generation remains on demand.

| Suite | Outputs |
| --- | --- |
| Holdings and Trade Java | apps/holdings-and-trade-service/target/surefire-reports and target/site/jacoco |
| Order and Sell Java | apps/order-and-sell-service/target/surefire-reports and target/site/jacoco |
| Auth | apps/auth-service/coverage and reports/junit |
| UI | apps/client-ui/coverage |
| End-to-end | apps/client-ui/reports/playwright |

Auth CI runs npm ci then npm run test:ci. Frontend CI uses the root workspace npm ci installation followed by npm test -- --no-watch --coverage from the UI workspace. Do not silently treat an absent test tool or empty required report as success.

Every tier fails its own stage below 50% coverage; the mechanisms are listed under [coverage floors](development.md#coverage-floors). A stage that passes has already cleared the floor, so the archived reports are for inspection, not for a manual check.

The end-to-end stage runs inside the official Playwright image whose version matches the installed `@playwright/test` package. The image supplies Chromium and its shared libraries without requiring privileged package installation on the agent. Playwright builds the UI and serves it on port 4200 through the Angular SSR server, and stubs the API tier at the network boundary, so the stage needs no database, auth service, or Java backend. Because it builds, the stage is the only one that also proves the production build works; expect it to take longer than the unit stages.

The optional [Jenkins image](../../infrastructure/docker/Dockerfile.jenkins) installs Node 24.x, the Docker CLI, Buildx, and the Docker Compose v2 plugin. Compose mounts the host Docker socket so those client tools operate on the host daemon; the Jenkins container does not run a separate Docker daemon. The active pipeline still expects the native Jenkins NodeJS tool to provide a Node 24.x runtime at 24.8.0 or later. The Jenkins Compose example contains development credentials. Review toolchains, credentials, and access before deployment; it is not a production-ready configuration.

The pipeline prints `docker ps` during its initial Docker check, after application-stack startup, and in its final diagnostics. The initial check fails early when Jenkins cannot reach the daemon or neither Compose command is available because later stages require Docker. The pipeline prefers the Compose v2 `docker compose` plugin and falls back to the legacy `docker-compose` command. Immediately after checkout and before dependency installation or tests, Jenkins builds and starts `docker-compose.local.yml` under the `trading-season-local` project name. It verifies that the two databases, auth service, and both Java services are running, then prints every running container so the application services appear separately from Jenkins. A successful build leaves those containers available on host ports 3001, 5432, 5433, 8081, and 8082 for local inspection. The UI is not included because it has no active Compose service.

Start the Jenkins controller separately; do not ask the running pipeline to manage its own container. From the repository root, start only the Jenkins service from its Compose file:

```sh
docker compose --project-name trading-season-jenkins \
  -f infrastructure/docker-compose/docker-compose.jenkins.yml up -d jenkins
```

Using the explicit `jenkins` service avoids starting the duplicate application services that remain in the optional Jenkins Compose example and would otherwise compete for the same host ports. To fit the shared 30 GB agent, Jenkins performs a depth-1 checkout and treats every run as a cold build. An unsuccessful or aborted build stops the local application stack before workspace deletion; a successful build preserves it. After stage-level report publication, final cleanup removes the build's Playwright image, all unused builder cache, Maven and npm caches, and the complete workspace. Named Docker volumes remain intact. Inspection and cleanup failures are protected so they do not replace the build's original result.

Javadoc generation is a required Java change check described in [development](development.md#javadocs); the current Jenkinsfile does not run or publish it automatically. Generate and review both service outputs, then refresh the checked-in docs/JAVA_DOCS copy after successful verification.

## Troubleshooting

- Connection refused: confirm database containers are healthy, published ports are free, and the app uses host names appropriate to its environment. Host auth connections use port 5433; containers use auth-db:5432.
- Missing business tables: apply the documented disposable bootstrap in the [database guide](../reference/database.md); Java does not run Flyway automatically.
- Auth startup fails on keys: generate an RSA pair, replace placeholder values, and preserve literal backslash-n escapes. Run from the auth directory so .env loads.
- JWT verification fails: check the signing/public key pair and expiry. The Java backend returns 401 when the JWKS at AUTH_JWK_SET_URI is unreachable, the signature does not match, the token has expired, iss differs from AUTH_JWT_ISSUER, or sub is not a UUID. Java caches the key set for five minutes and refetches early when a token carries an unknown kid; the auth service derives kid from the public key, so a key rotation is picked up on the first token signed with the new key. The auth service's own Passport strategy does not enforce issuer/audience; do not assume it does.
- Logout appears successful but refresh still works: see the documented [API limitation](../reference/api.md#current-logout-limitation).
- Jenkins fails before tests: verify the configured Java/Maven paths and Node version (24.x at 24.8.0 or later, compatible with Angular 21.2.x) on the actual agent, not just the optional image.
- Synthetic market-data CI derives Docker resource names from a normalized hash of the Jenkins build tag, so encoded multibranch names such as `%2F` do not need special handling. The stage creates and removes build-scoped database and archive volumes; do not pre-seed PostgreSQL or generate a persistent archive on the Jenkins VM.
- UI renders but login does not reach an API: form submission is not yet wired to a service. See [architecture](../reference/architecture.md).
