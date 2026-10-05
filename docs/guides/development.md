# Development

## Toolchain and installation

Use Node.js 24.x (24.8.0 or later), npm 11.16.0, JDK 21, Maven 3.9+, and Docker Compose. The Angular framework packages, CLI, build tooling, and SSR are all pinned to 21.2.25, and Angular CDK is pinned to its independently published 21.2.14 release. Angular 21.2.x supports Node ^24.0.0; this repository requires Node ^24.8.0 and TypeScript >=5.9.0 <6.0.0. Check exact dependency requirements in the [UI manifest](../../apps/client-ui/package.json), the [auth manifest](../../apps/auth-service/package.json), and the Java service POMs for [Holdings and Trade](../../apps/holdings-and-trade-service/pom.xml) and [Order and Sell](../../apps/order-and-sell-service/pom.xml).

The client UI and the auth service are separate npm projects, each with its own manifest and lockfile. Install both from repository root:

```sh
npm --prefix apps/client-ui ci
npm --prefix apps/auth-service ci
```

Reporting has no runnable application yet.

## Run locally

The application consists of four services. The UI routes orders and instruments to Order and Sell on 8081, and other business API paths to Holdings and Trade on 8082. Auth runs separately on 3001.
### Automated Linux VM setup

From the repository root, `./scripts/setup-local.sh` validates the toolchain, maintains a 3 GiB free-space reserve, prepares missing dependencies and auth keys, selects databases, and supervises the three applications in one terminal. It reports verified stages as `[READY]`, completed work as `[DONE]`, and actionable failures as `[FAIL]`.

The default `--database-mode auto` prefers verified local PostgreSQL databases. Use `--database-mode local` to prohibit Docker or `--database-mode docker` to require Docker Engine and Compose v2. Docker mode starts only `db` and `auth-db`, validates both schemas, and applies the canonical V001__Initialize_database.sql only when the business schema is proven empty. Local and Docker database storage are separate and are never synchronized automatically.

If Compose v2 is already installed as the standalone `docker-compose` command, the bootstrap creates the current user's Docker CLI plugin directory and symlinks that binary so `docker compose` works. An existing plugin entry is never overwritten, and the bootstrap does not download Compose.

The script validates an archive already at `apps/market-data/db/seeds/synthetic-market-data-2026-v1`. Use `--parquet-source PATH` to stage, checksum, and copy an existing archive when enough space remains. It never downloads, generates, imports, or regenerates market data. Use the [database guide](../reference/database.md#optional-synthetic-market-data-generation-and-import) for those explicit operations.

The Windows and fully manual paths below remain supported.

### Full local container stack

From the repository root, Local Compose builds and starts the implemented applications, databases, and reporting placeholders:

```sh
docker compose --project-name trading-season-local \
  -f infrastructure/docker-compose/docker-compose.local.yml up -d --build
```

The client UI is available on port 4200, the reporting UI placeholder on 4300, and the reporting service placeholder on 8083. `GET http://localhost:8083/health` verifies only that the placeholder container is running; it is not a reporting API.

The stack also starts a Kafka broker, reachable as `kafka:9092` from other containers and `localhost:29092` from the host. A one-shot `kafka-init` container creates the `trade-events` topic with three partitions; broker-side auto-creation is disabled, so a topic that has not been created explicitly fails rather than appearing with one partition. No service publishes or consumes yet. Inspect the topic with the broker's own tools:

```sh
docker compose --project-name trading-season-local \
  -f infrastructure/docker-compose/docker-compose.local.yml \
  exec -T kafka /opt/kafka/bin/kafka-topics.sh \
    --bootstrap-server localhost:9092 --describe --topic trade-events
```

### Manual and Windows setup

1. Follow the [auth setup](../../apps/auth-service/README.md) to create a local environment file and RSA keys.
2. Start only the databases from repository root:

```sh
docker compose --env-file apps/auth-service/.env -f infrastructure/docker-compose/docker-compose.local.yml up -d db auth-db
```

Compose validates JWT variables even when selecting database services, so provide the environment file. If changing the two database passwords, use root Compose variables DB_PASSWORD for the business database and AUTH_DB_PASSWORD for the auth database; the auth app uses DB_PASSWORD for its own connection. Keep these separate when credentials differ.

3. Initialize the business database only if you need the Java APIs, following the [database guide](../reference/database.md). Auth migrations run on auth-service startup.

4. Start each application in its own terminal:

| Working directory | Command | Port | Purpose |
| --- | --- | --- | --- |
| apps/client-ui | npm --prefix apps/client-ui start | 4200 | Angular frontend |
| apps/order-and-sell-service | mvn spring-boot:run | 8081 | Order processing, order validation, order execution, instrument reference data (called by UI) |
| apps/holdings-and-trade-service | mvn spring-boot:run | 8082 | User profiles, accounts, holdings, cash movements, market data (called by UI) |
| apps/auth-service | npm run start:dev | 3001 | Authentication, token issuance |

The UI calls the auth service directly on port 3001, which allows the dev server origin through CORS_ORIGINS. Java calls use the relative /api path, which [proxy.conf.json](../../apps/client-ui/proxy.conf.json) forwards by path: /api/orders and /api/instruments to the Order and Sell Service on port 8081, and everything else to the Holdings and Trade Service on port 8082. Both Java services must be running for the dashboard to load accounts and place an order. Registration completes only once the Java register contract accepts the profile the UI sends; see the [API reference](../reference/api.md#ui-integration).

## Checks

Run from repository root after dependency installation:

| Area | Command | Notes |
| --- | --- | --- |
| UI | npm --prefix apps/client-ui run build | Angular production build |
| UI | npm --prefix apps/client-ui test -- --no-watch --coverage | Angular unit-test builder; do not pass Vitest's --run |
| UI end-to-end | npm --prefix apps/client-ui run e2e | Playwright authentication, account, and trading journeys |
| Holdings and Trade Service | mvn -B -f apps/holdings-and-trade-service/pom.xml test | Unit/integration tests use H2 test configuration |
| Order and Sell Service | mvn -B -f apps/order-and-sell-service/pom.xml test | Unit/integration tests use H2 test configuration |
| Auth | npm --prefix apps/auth-service run build | NestJS compilation |
| Auth | npm --prefix apps/auth-service run test:ci | Vitest coverage and JUnit reports; tests generate ephemeral keys |
| Auth | npm --prefix apps/auth-service run lint | Oxlint |

There is no root npm project or task runner. Run each app's commands from its own directory, or with --prefix from repository root. See [operations](operations.md) for CI differences and artifact locations.

**Microservice-specific checks:**

When changing Holdings and Trade Service, also run Order and Sell Service tests to verify no schema conflicts:
```sh
mvn -B -f apps/holdings-and-trade-service/pom.xml test
mvn -B -f apps/order-and-sell-service/pom.xml test
```

Both services must pass independently and share schema compatibility.

## End-to-end tests

The Playwright suite in [apps/client-ui/e2e](../../apps/client-ui/e2e) covers authentication, account management, watchlists, and buy/sell journeys through the running application against the API stand-in. Backend ledger correctness is verified by the Java integration tests. Install the browser once, then run the suite:

```sh
npx --prefix apps/client-ui playwright install chromium
npm --prefix apps/client-ui run e2e
```

Playwright builds the application and serves it on port 4200 through the Angular SSR server, reusing a server already on that port when one is running. It runs against the production build rather than `ng serve` because the dev server dies part way through a parallel run on Windows, which fails the remaining tests with a connection error.

Every spec creates its own accounts, so `fullyParallel: true` runs spec files concurrently against that one shared server. Locally, Playwright auto-detects the worker count from available cores; CI uses a fixed 2 workers rather than assuming the Jenkins agent matches a developer machine's core count.

The auth service and Java backend are replaced at the network boundary by a stand-in that reproduces their status codes and bodies, so the suite needs no database, no Docker, no running service, and no `/api` proxy. What is exercised is the real Angular application: router, guards, reactive forms, HTTP interceptor and token storage. Keep the stand-in aligned with the [API reference](../reference/api.md) whenever an auth or registration contract changes.

The suite passes `NG_ALLOWED_HOSTS=localhost` to the server. The build's `security.allowedHosts` is deliberately empty, and the SSR server rejects every request without a runtime allowlist; naming the host the suite serves on is preferable to relaxing the build setting.

Run `npm --prefix apps/client-ui run e2e:report` to open the HTML report, and `e2e:ui` for interactive debugging. Reports are written to `apps/client-ui/reports/playwright` and are ignored by git.

## Coverage floors

Each tier fails its own test command below its coverage floor, so the floor is enforced by the build rather than read off a report.

| Tier | Floor | Enforced by | Counters |
| --- | --- | --- | --- |
| UI | 70% | coverageThresholds in [angular.json](../../apps/client-ui/angular.json) | statements, branches, functions, lines |
| Auth | 70% | coverage.thresholds in [vitest.config.ts](../../apps/auth-service/vitest.config.ts) | statements, branches, functions, lines |
| Holdings and Trade | 85% | coverage.minimum and jacoco:check in [pom.xml](../../apps/holdings-and-trade-service/pom.xml), per package | instructions, branches, lines, complexity, methods, classes |
| Order and Sell | 70% | coverage.minimum and jacoco:check in [pom.xml](../../apps/order-and-sell-service/pom.xml), per package | instructions, branches, lines, complexity, methods, classes |

The Java check applies the floor to every package rather than to the service as a whole, so a well-tested package cannot hide an untested one. A package with no branches has no branch ratio and is not held to that counter. The UI and auth floors apply to the whole run. Current per-folder and per-package results are in [code coverage](../coverage/README.md). Raise the floor as coverage improves rather than lowering it to accommodate a change.

## Javadocs

When Java code changes, update affected Javadoc comments in the same change, including behavior, parameters, return values, and exceptions. From repository root run both services:

```sh
mvn -B -f apps/holdings-and-trade-service/pom.xml org.apache.maven.plugins:maven-javadoc-plugin:3.11.2:javadoc
mvn -B -f apps/order-and-sell-service/pom.xml org.apache.maven.plugins:maven-javadoc-plugin:3.11.2:javadoc
```

Open each service's `target/reports/apidocs/index.html` locally and review pages for changed types and members. These pinned plugin commands generate documentation from current source. They need a JDK and Maven dependency access on first run. The target directories are temporary and ignored. Keep the published [Javadocs](../JAVA_DOCS/README.md) checked in under docs/JAVA_DOCS, one subdirectory per service: `holdings-and-trade-service` and `order-and-sell-service`. Both services root their packages at `app` and share several package names, so they cannot share one directory. After successful generation for a Java change, replace the changed service’s subdirectory with the complete generated apidocs output, including assets and legal notices; remove obsolete generated pages and include the refreshed copy in the same change. Never replace a checked-in copy after failed generation.

Fix generation errors and newly introduced warnings before completing a Java change. Existing missing-comment/tag warnings are visible technical debt, not evidence that a changed API is documented. Generation was verified during this consolidation on JDK 25 with the Java 21 source configuration; JDK 21 remains the project toolchain.

## Contribution workflow

Keep changes focused on one behavior, use a short-lived branch, and submit a review with the problem, resulting behavior, and checks performed. Preserve unrelated work and use git mv for tracked moves. Review existing tests and local AGENTS.md before editing.

Update the authoritative guide when its contract changes; do not add implementation summaries or duplicate setup guides. Validate Markdown links and anchors, remove emojis, and run git diff --check. Tests belong with the owning application. Never claim a historical test count represents the current suite.

## Troubleshooting

- Node engine errors: check `node --version` is 24.x at 24.8.0 or later; Angular 21.2.x supports Node 24.x.
- Missing `@shared/ui-components/*` or `@spartan-ng/helm/*` imports: check the path mappings in [tsconfig.json](../../apps/client-ui/tsconfig.json). They must point to `./shared-ui-components` inside client-ui. After merging a component move, keep its source and aliases together; reinstalling dependencies cannot repair stale source paths.
- Unknown ng test option: use --no-watch, not --run.
- Database connection or key failures: use the [operations checklist](operations.md) and [auth environment instructions](../../apps/auth-service/README.md).
- Javadoc tool missing: select a full JDK via JAVA_HOME and verify mvn --version and javadoc --version.

## Watchlist and refresh checks

Fresh business setup applies V001 followed by V002. Existing databases require the explicit [watchlist upgrade](../reference/database.md#watchlist-migration). With PostgreSQL binaries on PATH, run `python apps/market-data/db/scripts/python/tests/test_watchlist_migration.py` to validate the migration against a disposable cluster. UI caches are memory-only; see [client refresh behavior](../reference/api.md#client-data-refresh-behavior).
