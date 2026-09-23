# Development

## Toolchain and installation

Use Node.js 24.8.0 (exactly), npm 11.16.0, JDK 21, Maven 3.9+, and Docker Compose. The Angular framework packages are pinned to 21.2.23, Angular CLI, build tooling, and SSR are pinned to 21.2.24, and Angular CDK is pinned to its independently published 21.2.14 release. Angular 21.2.x supports Node ^24.0.0; this repository still standardizes on Node 24.8.0 and TypeScript >=5.9.0 <6.0.0. Check exact dependency requirements in [root package.json](../../package.json), the [UI manifest](../../apps/business-logic-ui/package.json), and the [Java POM](../../apps/business-backend/pom.xml).

From repository root:

```sh
npm ci
npm --prefix apps/auth-service ci
```

The auth service has its own lockfile and is not a root workspace. Reporting has no runnable application yet. Avoid the root install:all helper, which targets the placeholder reporting UI.

## Run locally

### Automated Linux VM setup

From the repository root, `./scripts/setup-local.sh` validates the toolchain, maintains a 3 GiB free-space reserve, prepares missing dependencies and auth keys, selects databases, and supervises the three applications in one terminal. It reports verified stages as `[READY]`, completed work as `[DONE]`, and actionable failures as `[FAIL]`.

The default `--database-mode auto` prefers verified local PostgreSQL databases. Use `--database-mode local` to prohibit Docker or `--database-mode docker` to require Docker Engine and Compose v2. Docker mode starts only `db` and `auth-db`, validates both schemas, and applies V001 through V003 only when the business schema is proven empty. Local and Docker database storage are separate and are never synchronized automatically.

If Compose v2 is already installed as the standalone `docker-compose` command, the bootstrap creates the current user's Docker CLI plugin directory and symlinks that binary so `docker compose` works. An existing plugin entry is never overwritten, and the bootstrap does not download Compose.

The script validates an archive already at `apps/business-backend/db/seeds/synthetic-market-data-2026-v1`. Use `--parquet-source PATH` to stage, checksum, and copy an existing archive when enough space remains. It never downloads, generates, imports, or regenerates market data. Use the [database guide](../reference/database.md#optional-synthetic-market-data-generation-and-import) for those explicit operations.

The Windows and fully manual paths below remain supported.

### Manual and Windows setup

1. Follow the [auth setup](../../apps/auth-service/README.md) to create a local environment file and RSA keys.
2. Start only the databases from repository root:

```sh
docker compose --env-file apps/auth-service/.env -f infrastructure/docker-compose/docker-compose.local.yml up -d db auth-db
```

Compose validates JWT variables even when selecting database services, so provide the environment file. If changing the two database passwords, use root Compose variables DB_PASSWORD for the business database and AUTH_DB_PASSWORD for the auth database; the auth app uses DB_PASSWORD for its own connection. Keep these separate when credentials differ.

3. Initialize the business database only if you need the Java API, following the [database guide](../reference/database.md). Auth migrations run on auth-service startup.
4. Start each application in its own terminal:

| Working directory | Command | Port |
| --- | --- | --- |
| Repository root | npm --workspace business-logic-ui start | 4200 |
| apps/business-backend | mvn spring-boot:run | 8081 |
| apps/auth-service | npm run start:dev | 3001 |

Do not use an unqualified Compose up for the full stack: its backend build context and port mapping are stale.

The UI calls the auth service directly on port 3001, which allows the dev server origin through CORS_ORIGINS. Java calls use the relative /api path, which the dev server forwards to port 8080 through [proxy.conf.json](../../apps/business-logic-ui/proxy.conf.json) because the Java backend has no CORS policy. Registration completes only once the Java register contract accepts the profile the UI sends; see the [API reference](../reference/api.md#ui-integration).

## Checks

Run from repository root after dependency installation:

| Area | Command | Notes |
| --- | --- | --- |
| UI | npm --workspace business-logic-ui run build | Angular production build |
| UI | npm --workspace business-logic-ui test -- --no-watch --coverage | Angular unit-test builder; do not pass Vitest's --run |
| UI end-to-end | npm --workspace business-logic-ui run e2e | Playwright login and registration journeys |
| Java | mvn -B -f apps/business-backend/pom.xml test | Unit/integration tests use H2 test configuration |
| Auth | npm --prefix apps/auth-service run build | NestJS compilation |
| Auth | npm --prefix apps/auth-service run test:ci | Vitest coverage and JUnit reports; tests generate ephemeral keys |
| Auth | npm --prefix apps/auth-service run lint | Oxlint |
| Market-data scripts | python -m unittest discover apps/business-backend/db/tests | Unit checks; use Jenkins for the two-day PostgreSQL integration |

Root Turborepo commands only cover configured workspaces and available scripts. Run Java and auth checks explicitly. See [operations](operations.md) for CI differences and artifact locations.

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

Each tier fails its own test command below 50% coverage, so the floor is enforced by the build rather than read off a report.

| Tier | Enforced by | Counters |
| --- | --- | --- |
| UI | coverageThresholds in [angular.json](../../apps/business-logic-ui/angular.json) | statements, branches, functions, lines |
| Auth | coverage.thresholds in [vitest.config.ts](../../apps/auth-service/vitest.config.ts) | statements, branches, functions, lines |
| Java | jacoco:check in the [POM](../../apps/business-backend/pom.xml) | line and instruction ratio |

The Java tier has the least headroom, and its branch coverage sits below the line figure, so it is not gated on branches. Raise the floor as coverage improves rather than lowering it to accommodate a change.

## Javadocs

When Java code changes, update affected Javadoc comments in the same change, including behavior, parameters, return values, and exceptions. From repository root run:

```sh
mvn -B -f apps/business-backend/pom.xml org.apache.maven.plugins:maven-javadoc-plugin:3.11.2:javadoc
```

Open apps/business-backend/target/reports/apidocs/index.html locally and review pages for changed types and members. This pinned plugin command generates documentation from current source. It needs a JDK and Maven dependency access on first run. The target directory is temporary and ignored. Keep the published [Javadocs](../JAVA_DOCS/index.html) checked in under docs/JAVA_DOCS. After successful generation for a Java change, replace that directory’s contents with the complete generated apidocs output, including assets and legal notices; remove obsolete generated pages and include the refreshed copy in the same change. Never replace the checked-in copy after failed generation.

Fix generation errors and newly introduced warnings before completing a Java change. Existing missing-comment/tag warnings are visible technical debt, not evidence that a changed API is documented. Generation was verified during this consolidation on JDK 25 with the Java 21 source configuration; JDK 21 remains the project toolchain.

## Contribution workflow

Keep changes focused on one behavior, use a short-lived branch, and submit a review with the problem, resulting behavior, and checks performed. Preserve unrelated work and use git mv for tracked moves. Review existing tests and local AGENTS.md before editing.

Update the authoritative guide when its contract changes; do not add implementation summaries or duplicate setup guides. Validate Markdown links and anchors, remove emojis, and run git diff --check. Tests belong with the owning application. Never claim a historical test count represents the current suite.

## Troubleshooting

- Node engine errors: check `node --version` is exactly 24.8.0; Angular 21.2.x supports Node 24.x, but this project intentionally enforces 24.8.0.
- Missing workspace imports: run npm ci at repository root and check shared package exports.
- Unknown ng test option: use --no-watch, not --run.
- Database connection or key failures: use the [operations checklist](operations.md) and [auth environment instructions](../../apps/auth-service/README.md).
- Javadoc tool missing: select a full JDK via JAVA_HOME and verify mvn --version and javadoc --version.
