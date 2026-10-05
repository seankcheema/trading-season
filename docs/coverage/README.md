# Code coverage

Generated coverage reports for the four tested services. All four reports were refreshed from successful local runs on 2026-10-05. Each service keeps its own tooling and its own report format; this directory holds the generated output so the reports can be read without rerunning the suites. Open [index.html](index.html) for a single page of links into all four reports. The reporting placeholders contain no application code and have no coverage.

Every service enforces a 70 percent floor in its own test command rather than reporting a number for a human to check (85 percent for Holdings and Trade). The Java services apply it to every package on every JaCoCo counter; the UI and auth service apply it to the whole run on each counter. A suite that falls below the floor fails, so a report in this directory describes a run that already passed its gate. The mechanisms are listed under [coverage floors](../guides/development.md#coverage-floors).

## Reports

| Service | Tool | Report | Configuration |
| --- | --- | --- | --- |
| Client UI (Angular) | Angular unit-test builder with Vitest and v8 | [client-ui/index.html](client-ui/index.html) | `coverageThresholds` in [angular.json](../../apps/client-ui/angular.json) |
| Holdings and Trade (Spring Boot) | JaCoCo 0.8.15 | [holdings-and-trade-service/index.html](holdings-and-trade-service/index.html) | `check-coverage` execution in [pom.xml](../../apps/holdings-and-trade-service/pom.xml) |
| Order and Sell (Spring Boot) | JaCoCo 0.8.15 | [order-and-sell-service/index.html](order-and-sell-service/index.html) | `check-coverage` execution in [pom.xml](../../apps/order-and-sell-service/pom.xml) |
| Auth service (NestJS) | Vitest with v8 | [auth-service/index.html](auth-service/index.html) | `test.coverage.thresholds` in [vitest.config.ts](../../apps/auth-service/vitest.config.ts) |

Machine-readable output sits alongside each HTML report: `client-ui/lcov.info`, `client-ui/cobertura-coverage.xml`, and `client-ui/coverage-final.json`, `jacoco.xml` and `jacoco.csv` in each Java service directory, and `auth-service/lcov.info` and `auth-service/cobertura-coverage.xml`.

## Results

Counters differ by tool. JaCoCo measures bytecode instructions and branches; the v8 provider measures statements, branches, functions, and lines of source. The line counter is the only one every service shares.

| Service | Tests | Statements / Instructions | Branches | Functions / Methods | Lines |
| --- | --- | --- | --- | --- | --- |
| Client UI | 492 in 37 files | 92.05 percent (5274/5729) | 88.99 percent (2516/2827) | 88.25 percent (1014/1149) | 93.66 percent (4314/4606) |
| Holdings and Trade | 309 | 98.43 percent (4628/4702) | 95.33 percent (204/214) | 98.23 percent (333/339) | 98.01 percent (887/905) |
| Order and Sell | 162 | 92.33 percent (4167/4513) | 91.01 percent (162/178) | 92.35 percent (326/353) | 94.09 percent (892/948) |
| Auth service | 104 in 10 files | 99.02 percent (204/206) | 92.50 percent (74/80) | 96.00 percent (48/50) | 99.50 percent (203/204) |

All four suites passed their configured coverage checks. Test counts and percentages above come from the refreshed reports.

## Analysis

Order integration tests exercise buy, partial sell, full liquidation, rejected trades without execution rows, missing credentials, account isolation, replay timestamps, idempotency, and rollback after a real database constraint failure. Holdings tests read remaining positions and derive acquisition cost from the corresponding fill and movement rows. The services have separate implementations and fixtures; their results are measured independently.

Browser trading journeys drive the Angular application against the API stand-in. They validate request contracts and UI refresh behavior; the Java integration suite verifies persisted ledger behavior.

## Regenerate

Run from the repository root. Each command writes to its service's own build output; copy the result into this directory afterward.

| Service | Command | Source of the copied report |
| --- | --- | --- |
| Client UI | `npm --prefix apps/client-ui test -- --no-watch --coverage` | `apps/client-ui/coverage/client-ui` |
| Holdings and Trade | `mvn -B -f apps/holdings-and-trade-service/pom.xml clean test` | `apps/holdings-and-trade-service/target/site/jacoco` |
| Order and Sell | `mvn -B -f apps/order-and-sell-service/pom.xml clean test` | `apps/order-and-sell-service/target/site/jacoco` |
| Auth service | `npm --prefix apps/auth-service run test:cov` | `apps/auth-service/coverage` |

Do not edit these files by hand; regenerate them. See [Development](../guides/development.md) for the full check list and [Operations](../guides/operations.md) for how the Jenkins pipeline publishes the same reports as build artifacts.

[Documentation](../README.md) · [Project overview](../../README.md)
