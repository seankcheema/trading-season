# Development

## Toolchain and installation

Use Node.js 22.22.3+ on the 22.x line, npm 11.16.0, JDK 21, Maven 3.9+, and Docker Compose. Check exact dependency requirements in [root package.json](../../package.json), the [UI manifest](../../apps/business-logic-ui/package.json), and the [Java POM](../../apps/business-backend/pom.xml).

From repository root:

```sh
npm ci
npm --prefix apps/auth-service ci
```

The auth service has its own lockfile and is not a root workspace. Reporting has no runnable application yet. Avoid the root install:all helper, which targets the placeholder reporting UI.

## Run locally

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

Do not use an unqualified Compose up for the full stack: its backend build context is stale. The Angular development server proxies its implemented stock-data calls to port 8081, but authentication, portfolio, and order API wiring remains unfinished.

## Checks

Run from repository root after dependency installation:

| Area | Command | Notes |
| --- | --- | --- |
| UI | npm --workspace business-logic-ui run build | Angular production build |
| UI | npm --workspace business-logic-ui test -- --no-watch --coverage | Angular unit-test builder; do not pass Vitest's --run |
| Java | mvn -B -f apps/business-backend/pom.xml test | Unit/integration tests use H2 test configuration |
| Auth | npm --prefix apps/auth-service run build | NestJS compilation |
| Auth | npm --prefix apps/auth-service run test:ci | Vitest coverage and JUnit reports; tests generate ephemeral keys |
| Auth | npm --prefix apps/auth-service run lint | Oxlint |
| Market-data scripts | python -m unittest discover apps/business-backend/db/tests | Unit checks; use Jenkins for the two-day PostgreSQL integration |

Root Turborepo commands only cover configured workspaces and available scripts. Run Java and auth checks explicitly. See [operations](operations.md) for CI differences and artifact locations.

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

- Node engine errors: check node --version against the installed Angular package engines; a generic Node 22 installation can be too old.
- Missing workspace imports: run npm ci at repository root and check shared package exports.
- Unknown ng test option: use --no-watch, not --run.
- Database connection or key failures: use the [operations checklist](operations.md) and [auth environment instructions](../../apps/auth-service/README.md).
- Javadoc tool missing: select a full JDK via JAVA_HOME and verify mvn --version and javadoc --version.
