# Development

## Toolchain and installation

Use Node.js 22.22.3+ on the 22.x line, npm 11.16.0, JDK 21, Maven 3.9+, and Docker Compose. Check exact dependency requirements in [root package.json](../../package.json), the [UI manifest](../../apps/business-logic-ui/package.json), and the Java POMs ([Holdings and Trade](../../apps/holdings-and-trade-service/pom.xml) and [Order and Sell](../../apps/order-and-sell-service/pom.xml)).

From repository root:

```sh
npm ci
npm --prefix apps/auth-service ci
```

The auth service has its own lockfile and is not a root workspace. Reporting has no runnable application yet. Avoid the root install:all helper, which targets the placeholder reporting UI.

## Run locally

The application consists of four services. The UI routes only to Holdings and Trade Service; Order and Sell Service runs independently.

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
| Repository root | npm --workspace business-logic-ui start | 4200 | Angular frontend |
| apps/order-and-sell-service | mvn spring-boot:run | 8081 | Order processing, order validation, order execution (called by UI) |
| apps/holdings-and-trade-service | mvn spring-boot:run | 8082 | User profiles, market data; account and holdings queries planned (independent; not called by UI) |
| apps/auth-service | npm run start:dev | 3001 | Authentication, token issuance |

Do not use an unqualified Compose up for the full stack: its backend build context and port mapping are stale.

**UI integration:**
- The UI calls the Auth Service directly on port 3001 (allowed by CORS_ORIGINS)
- The UI calls Order and Sell Service via dev proxy (relative `/api` paths forward to port 8081 through [proxy.conf.json](../../apps/client-ui/proxy.conf.json))
- The UI does not call Holdings and Trade Service

**Why two Java services?** The architecture was designed to split order processing (Order and Sell) from user profile queries (Holdings and Trade). Order and Sell Service handles all order operations and is the exclusive backend target of Client UI. See [Architecture](../reference/architecture.md) and [Order and Sell Service](../reference/services/order-and-sell-service.md) for details.

## Checks

Run from repository root after dependency installation:

| Area | Command | Notes |
| --- | --- | --- |
| UI | npm --workspace business-logic-ui run build | Angular production build |
| UI | npm --workspace business-logic-ui test -- --no-watch --coverage | Angular unit-test builder; do not pass Vitest's --run |
| UI end-to-end | npm --workspace business-logic-ui run e2e | Playwright login and registration journeys |
| Holdings and Trade Service | mvn -B -f apps/holdings-and-trade-service/pom.xml test | Unit/integration tests use H2 test configuration |
| Order and Sell Service | mvn -B -f apps/order-and-sell-service/pom.xml test | Unit/integration tests use H2 test configuration |
| Auth | npm --prefix apps/auth-service run build | NestJS compilation |
| Auth | npm --prefix apps/auth-service run test:ci | Vitest coverage and JUnit reports; tests generate ephemeral keys |
| Auth | npm --prefix apps/auth-service run lint | Oxlint |
| Market-data scripts | python -m unittest discover apps/market-data/db/tests | Unit checks; use Jenkins for the two-day PostgreSQL integration |

Root Turborepo commands only cover configured workspaces and available scripts. Run Java and auth checks explicitly. See [operations](operations.md) for CI differences and artifact locations.

**Microservice-specific checks:**

When changing Holdings and Trade Service, also run Order and Sell Service tests to verify no schema conflicts:
```sh
mvn -B -f apps/holdings-and-trade-service/pom.xml test
mvn -B -f apps/order-and-sell-service/pom.xml test
```

Both services must pass independently and share schema compatibility.

## End-to-end tests

The Playwright suite in [apps/business-logic-ui/e2e](../../apps/business-logic-ui/e2e) covers the login and registration journeys through the running application. Install the browser once, then run the suite:

```sh
npx --prefix apps/business-logic-ui playwright install chromium
npm --workspace business-logic-ui run e2e
```

Playwright builds the application and serves it on port 4200 through the Angular SSR server, reusing a server already on that port when one is running. It runs against the production build rather than `ng serve` because the dev server dies part way through a parallel run on Windows, which fails the remaining tests with a connection error.

The auth service and Java backend are replaced at the network boundary by a stand-in that reproduces their status codes and bodies, so the suite needs no database, no Docker, and no running service, and no `/api` proxy. What is exercised is the real Angular application: router, guards, reactive forms, HTTP interceptor and token storage. Keep the stand-in aligned with the [API reference](../reference/api.md) whenever an auth or registration contract changes.

The suite passes `NG_ALLOWED_HOSTS=localhost` to the server. The build's `security.allowedHosts` is deliberately empty, and the SSR server rejects every request without a runtime allowlist; naming the host the suite serves on is preferable to relaxing the build setting.

Run `npm --workspace business-logic-ui run e2e:report` to open the HTML report, and `e2e:ui` for interactive debugging. Reports are written to `apps/business-logic-ui/reports/playwright` and are ignored by git.

## Coverage floors

Each tier fails its own test command below its coverage floor, so the floor is enforced by the build rather than read off a report.

| Tier | Floor | Enforced by | Counters |
| --- | --- | --- | --- |
| UI | 60% | coverageThresholds in [angular.json](../../apps/business-logic-ui/angular.json) | statements, branches, functions, lines |
| Auth | 50% | coverage.thresholds in [vitest.config.ts](../../apps/auth-service/vitest.config.ts) | statements, branches, functions, lines |
| Java | 50% | jacoco:check in both service POMs | line and instruction ratio |

The Java tier has the least headroom, and its branch coverage sits below the line figure, so it is not gated on branches. Raise the floor as coverage improves rather than lowering it to accommodate a change.

## Javadocs

When Java code changes, update affected Javadoc comments in the same change, including behavior, parameters, return values, and exceptions. From repository root run both services:

```sh
mvn -B -f apps/holdings-and-trade-service/pom.xml org.apache.maven.plugins:maven-javadoc-plugin:3.11.2:javadoc
mvn -B -f apps/order-and-sell-service/pom.xml org.apache.maven.plugins:maven-javadoc-plugin:3.11.2:javadoc
```

Open the generated documentation locally and review pages for changed types and members. Both pinned plugin commands generate documentation from current source. They need JDK and Maven dependency access on first run. The target directories are temporary and ignored. Keep the published [Javadocs](../JAVA_DOCS/index.html) checked in under docs/JAVA_DOCS. After successful generation for a Java change, replace that directory's contents with the complete generated apidocs output from both services, including assets and legal notices; remove obsolete generated pages and include the refreshed copy in the same change. Never replace the checked-in copy after failed generation.

Fix generation errors and newly introduced warnings before completing a Java change. Existing missing-comment/tag warnings are visible technical debt, not evidence that a changed API is documented. Generation was verified during this consolidation on JDK 25 with the Java 21 source configuration; JDK 21 remains the project toolchain.

## Contribution workflow

Keep changes focused on one behavior, use a short-lived branch, and submit a review with the problem, resulting behavior, and checks performed. Preserve unrelated work and use git mv for tracked moves. Review existing tests and local AGENTS.md before editing.

Update the authoritative guide when its contract changes; do not add implementation summaries or duplicate setup guides. Validate Markdown links and anchors, remove emojis, and run git diff --check. Tests belong with the owning application. Never claim a historical test count represents the current suite.

## Troubleshooting

- Node engine errors: check node --version against the installed Angular package engines; a generic Node 22 installation can be too old.
- Missing workspace imports: run npm ci at repository root and check shared package exports.
- Unknown ng test option: use --no-watch, not --run.
- Database connection or key failures: use the [operations checklist](operations.md) and [auth environment instructions](../../apps/auth-service/README.md).
- Javadoc tool missing: select a full JDK via JAVA_HOME and verify mvn --version and javadoc --version.
