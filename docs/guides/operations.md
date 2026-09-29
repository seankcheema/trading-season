# Operations

## Configuration ownership

| Component | Configuration | Defaults |
| --- | --- | --- |
| Holdings and Trade service | [application.properties](../../apps/holdings-and-trade-service/src/main/resources/application.properties) | HTTP 8081; PostgreSQL localhost:5432/trading_season |
| Order and Sell service | [application.properties](../../apps/order-and-sell-service/src/main/resources/application.properties) | HTTP 8082; PostgreSQL localhost:5432/trading_season |
| Auth service | [Auth setup](../../apps/auth-service/README.md) and [database configuration](../../apps/auth-service/src/config/database.config.ts) | HTTP 3001; PostgreSQL localhost:5433/auth_db; SMTP localhost:1025 |
| Mailpit | [Local Compose](../../infrastructure/docker-compose/docker-compose.local.yml) | SMTP 1025; web UI 8025; development mail only |
| Client UI container | [Client Dockerfile](../../apps/client-ui/Dockerfile) | HTTP 4200; Nginx proxies `/api` to Holdings and Trade |
| Reporting placeholders | [Reporting proposal](../reference/reporting.md) | UI HTTP 4300; service HTTP 8083 |
| Local containers | [Local Compose](../../infrastructure/docker-compose/docker-compose.local.yml) | Application containers, the business database volume, and archive cache |
| Jenkins | [Pipeline](../../infrastructure/jenkins/Jenkinsfile), [disk-space runbook](../../infrastructure/jenkins/README.md), [Compose](../../infrastructure/docker-compose/docker-compose.jenkins.yml) | Jenkins UI on host port 8888 |

Both Java services read SPRING_DATASOURCE_URL, SPRING_DATASOURCE_USERNAME, SPRING_DATASOURCE_PASSWORD, AUTH_JWK_SET_URI, AUTH_JWT_ISSUER, and CORS_ORIGINS. Both must connect to the same trading_season database and must use the same AUTH_JWT_ISSUER value or token validation fails. AUTH_JWT_ISSUER must equal the auth service's JWT_ISSUER or every token is rejected. Auth reads DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, PORT, JWT_PRIVATE_KEY, JWT_PUBLIC_KEY, JWT_ISSUER, and the mail settings under [outbound email](#outbound-email). Node startup loads .env from its working directory; Compose must receive the appropriate environment file explicitly.

In local Compose, DB_PASSWORD configures the one database every service connects to, auth included. The auth service currently connects as the application role, which can read every trading table; a role granted only `user_accounts` and `refresh_tokens` would restore most of the isolation the separate database used to provide, and is worth adding before this reaches anything but a development machine. Defaults are for disposable local development; production credentials and signing keys must come from managed secrets.

**Microservice deployment constraint:** Order and Sell Service and Holdings and Trade Service must use the same database version and schema version. Schema changes require coordinating both service deployments or adding backwards-compatible migrations.

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

Local Compose builds the client UI, both Java services, auth service, and two reporting placeholders, and runs Mailpit alongside them. It publishes the client UI on 4200, reporting UI on 4300, reporting service on 8083, Java services on 8081 and 8082, auth on 3001, and Mailpit on 1025 and 8025. The reporting containers prove only that those future boundaries can run; they do not implement reporting. No production Compose file or Kubernetes deployment is supplied.

### Outbound email

The auth service sends one kind of email: the password reset link (KAN-89). It reads SMTP_HOST, SMTP_PORT, SMTP_SECURE, optional SMTP_USER and SMTP_PASSWORD, MAIL_FROM, and APP_BASE_URL, which sets the origin of the link and must point at the client UI, not at the auth service. Defaults are localhost:1025 and http://localhost:4200; in Compose the host is `mailpit`. See [MailService](../../apps/auth-service/src/mail/mail.service.ts).

Mailpit is a development mail server: it accepts everything on SMTP 1025, delivers nothing, and shows what it received at http://localhost:8025, which is where a local reset link is read from. Messages live in the container, so restarting it empties the mailbox. Leave SMTP_USER and SMTP_PASSWORD unset for Mailpit: an empty user makes the client attempt AUTH, which it rejects. A real deployment points the same variables at a real relay and supplies credentials and, for the implicit-TLS port, SMTP_SECURE=true. Nothing in the service is Mailpit specific.

An unreachable mail server does not fail a reset request: POST /auth/forgot-password still answers 202, because a different answer would reveal which addresses have accounts. The failure is logged by MailService and AuthService and the issued token is revoked, so a user reporting a missing email with no error in the UI is a reason to check the auth service log and the mail server, not the browser.

Auth GET /health reports process liveness, not database readiness. Check startup logs and database connectivity separately. Database volumes persist across ordinary container shutdown; removing volumes deletes their data. Back up retained data before schema or volume changes and verify restoration in a separate database.

Ordinary Compose startup neither initializes nor seeds. `db_data` remains the PostgreSQL store and `market_data_archive` caches generated files across container recreation. Run the `initialize` profile only for first-time disposable setup. Thereafter the opt-in `seed` profile waits for database readiness and runs numbered steps 0002 through 0004 without destructive initialization.

Because the seed container cannot inspect free space inside the separate PostgreSQL volume, set `MARKET_DATA_AVAILABLE_DISK_GB` to the volume's available capacity before starting the `seed` profile. The default `parquet` mode retains raw ticks in the archive volume and imports only candles into PostgreSQL. The importer commits and checkpoints one month at a time; a rerun verifies and skips completed months. Set tick storage to `postgres` only for an intentional high-capacity deployment.

The Linux bootstrap uses the Compose project name `trading-season-local`, keeping its service identities and named volumes separate from the optional Jenkins Compose project. It keeps at least 3 GiB free on filesystems it changes and rechecks capacity after dependency installation, archive copy, and Docker startup. This reserve permits copying an existing archive when it fits; it is not permission to regenerate a full archive, whose staging copy needs additional capacity.

## CI and artifacts

The Jenkins pipeline expects a native agent with Docker, the Maven tool named Maven, and Java 21 at its configured JAVA_HOME. It requires at least 5 GiB of free workspace storage before checkout. This is an early guard rather than a guarantee that the complete Compose and Angular image builds will fit; keep additional headroom when possible. The pipeline runs Java, auth, Angular, end-to-end, script, and build-scoped two-day PostgreSQL integration checks. Full-year generation remains on demand.

| Suite | Outputs |
| --- | --- |
| Holdings and Trade Java | apps/holdings-and-trade-service/target/surefire-reports and target/site/jacoco |
| Order and Sell Java | apps/order-and-sell-service/target/surefire-reports and target/site/jacoco |
| Auth | apps/auth-service/coverage and reports/junit |
| UI | apps/client-ui/coverage |
| End-to-end | apps/client-ui/reports/playwright |

Auth CI runs npm ci then npm run test:ci. Frontend CI uses the root workspace npm ci installation followed by npm test -- --no-watch --coverage from the UI workspace. Do not silently treat an absent test tool or empty required report as success.

Every tier fails its own stage below 70% coverage; the mechanisms are listed under [coverage floors](development.md#coverage-floors). A stage that passes has already cleared the floor, so the archived reports are for inspection, not for a manual check.

The end-to-end stage runs inside the official Playwright image whose version matches the installed `@playwright/test` package. The image supplies Chromium and its shared libraries without requiring privileged package installation on the agent. Playwright builds the UI and serves it on port 4200 through the Angular SSR server, and stubs the API tier at the network boundary, so the stage needs no database, auth service, or Java backend. Because it builds, the stage is the only one that also proves the production build works; expect it to take longer than the unit stages.

The optional [Jenkins image](../../infrastructure/docker/Dockerfile.jenkins) installs Node 24.x, the Docker CLI, Buildx, and the Docker Compose v2 plugin. Compose mounts the host Docker socket so those client tools operate on the host daemon; the Jenkins container does not run a separate Docker daemon. The active pipeline still expects the native Jenkins NodeJS tool to provide a Node 24.x runtime at 24.8.0 or later. The Jenkins Compose example contains development credentials. Review toolchains, credentials, and access before deployment; it is not a production-ready configuration.

The pipeline prints `docker ps` during its initial Docker check, after application-stack startup, and in its final diagnostics. The initial check fails early when Jenkins cannot reach the daemon or neither Compose command is available because later stages require Docker. The pipeline prefers the Compose v2 `docker compose` plugin and falls back to the legacy `docker-compose` command. After its test stages pass, on every branch, Jenkins builds and starts `docker-compose.local.yml` under the `trading-season-local` project name. It verifies eight long-running services, Mailpit among them, and performs HTTP smoke checks against the client UI and both reporting placeholders, then prints every running container so the application services appear separately from Jenkins. A successful build leaves the stack available on host ports 1025, 3001, 4200, 4300, 5432, 8025, 8081, 8082, and 8083 for local inspection.

Start the Jenkins controller separately; do not ask the running pipeline to manage its own container. From the repository root, start only the Jenkins service from its Compose file:

```sh
docker compose --project-name trading-season-jenkins \
  -f infrastructure/docker-compose/docker-compose.jenkins.yml up -d jenkins
```

Using the explicit `jenkins` service avoids starting the duplicate application services that remain in the optional Jenkins Compose example and would otherwise compete for the same host ports. To fit the shared 30 GB agent, Jenkins performs a depth-1 checkout and treats every run as a cold build. An unsuccessful or aborted build stops the local application stack before workspace deletion; a successful build preserves it. After stage-level report publication, final cleanup removes the build's Playwright image, all unused builder cache, Maven and npm caches, and the complete workspace. Named Docker volumes remain intact. Inspection and cleanup failures are protected so they do not replace the build's original result.

Javadoc generation is a required Java change check described in [development](development.md#javadocs); the current Jenkinsfile does not run or publish it automatically. Generate and review both service outputs, then refresh the checked-in docs/JAVA_DOCS copy after successful verification.

## Troubleshooting

**General issues:**
- Connection refused: confirm database containers are healthy, published ports are free, and the app uses host names appropriate to its environment. Every service connects to the same database: host connections use port 5432; containers use db:5432.
- Missing business tables: apply the documented disposable bootstrap in the [database guide](../reference/database.md); Java does not run Flyway automatically.
- Auth startup fails on keys: generate an RSA pair, replace placeholder values, and preserve literal backslash-n escapes. Run from the auth directory so .env loads.

**Microservice-specific issues:**
- One Java service fails to connect to database while the other succeeds: both must connect to the same trading_season database; verify connection strings and that both services use the same DB_HOST and DB_PORT.
- Schema version mismatch errors: Holdings and Trade Service and Order and Sell Service must use schema versions that are compatible. Add migrations as needed to keep both services on the same version. See [database guide](../reference/database.md).
- One Java service starts but the other does not: both require the same AUTH_JWK_SET_URI, AUTH_JWT_ISSUER, and JWT signing keys. Mismatched auth configuration will cause startup failures or immediate 401 responses.

**Token and auth issues:**
- JWT verification fails: check the signing/public key pair and expiry. The Java backend returns 401 when the JWKS at AUTH_JWK_SET_URI is unreachable, the signature does not match, the token has expired, iss differs from AUTH_JWT_ISSUER, or sub is not a UUID. Java caches the key set for five minutes and refetches early when a token carries an unknown kid; the auth service derives kid from the public key, so a key rotation is picked up on the first token signed with the new key. The auth service's own Passport strategy does not enforce issuer/audience; do not assume it does.
- Logout appears successful but refresh still works: see the documented [API limitation](../reference/api.md#current-logout-limitation).
- Jenkins fails before tests: verify the configured Java/Maven paths and Node version (24.x at 24.8.0 or later, compatible with Angular 21.2.x) on the actual agent, not just the optional image.
- Synthetic market-data CI derives Docker resource names from a normalized hash of the Jenkins build tag, so encoded multibranch names such as `%2F` do not need special handling. The stage creates and removes build-scoped database and archive volumes; do not pre-seed PostgreSQL or generate a persistent archive on the Jenkins VM.
- UI renders but login does not reach an API: form submission is not yet wired to a service. See [architecture](../reference/architecture.md).
