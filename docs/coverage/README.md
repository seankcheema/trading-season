# Code coverage

Generated coverage reports for the four tested services. All four reports are from local runs on 2026-10-01. Each service keeps its own tooling and its own report format; this directory holds the generated output so the reports can be read without rerunning the suites. Open [index.html](index.html) for a single page of links into all four reports. The reporting placeholders contain no application code and have no coverage.

Every service enforces a 70 percent floor in its own test command rather than reporting a number for a human to check (85 percent for Holdings and Trade). The Java services apply it to every package on every JaCoCo counter; the UI and auth service apply it to the whole run on each counter. A suite that falls below the floor fails, so a report in this directory describes a run that already passed its gate. The mechanisms are listed under [coverage floors](../guides/development.md#coverage-floors).

## Reports

| Service | Tool | Report | Configuration |
| --- | --- | --- | --- |
| Client UI (Angular) | Angular unit-test builder with Vitest and v8 | [client-ui/index.html](client-ui/index.html) | `coverageThresholds` in [angular.json](../../apps/client-ui/angular.json) |
| Holdings and Trade (Spring Boot) | JaCoCo 0.8.15 | [holdings-and-trade-service/index.html](holdings-and-trade-service/index.html) | `check-coverage` execution in [pom.xml](../../apps/holdings-and-trade-service/pom.xml) |
| Order and Sell (Spring Boot) | JaCoCo 0.8.15 | [order-and-sell-service/index.html](order-and-sell-service/index.html) | `check-coverage` execution in [pom.xml](../../apps/order-and-sell-service/pom.xml) |
| Auth service (NestJS) | Vitest with v8 | [auth-service/index.html](auth-service/index.html) | `test.coverage.thresholds` in [vitest.config.ts](../../apps/auth-service/vitest.config.ts) |

Machine-readable output sits alongside each HTML report: `client-ui/clover.xml` and `client-ui/coverage-final.json`, `jacoco.xml` and `jacoco.csv` in each Java service directory, and `auth-service/lcov.info` and `auth-service/cobertura-coverage.xml`.

## Results

Counters differ by tool. JaCoCo measures bytecode instructions and branches; the v8 provider measures statements, branches, functions, and lines of source. The line counter is the only one every service shares.

| Service | Tests | Statements / Instructions | Branches | Functions / Methods | Lines |
| --- | --- | --- | --- | --- | --- |
| Client UI | 310 in 22 files | 91.56 percent (3867/4223) | 86.43 percent (1676/1939) | 87.1 percent (689/791) | 92.48 percent (3127/3381) |
| Holdings and Trade | 290 | 98.04 percent (3892/3970) | 95.12 percent (156/164) | 97.65 percent (291/298) | 97.60 percent (773/792) |
| Order and Sell | 143 | 91.83 percent (3956/4308) | 90.96 percent (151/166) | 91.52 percent (313/342) | 93.68 percent (860/918) |
| Auth service | 109 in 11 files | 99.05 percent (210/212) | 92.85 percent (78/84) | 96.07 percent (49/51) | 99.52 percent (209/210) |

Every folder and package is at or above its floor on every counter, since the UI and auth floors apply to the whole run rather than per folder. The weakest in each service:

| Service | Weakest folder or package | Lowest counter |
| --- | --- | --- |
| Client UI | `shared-ui-components/src/lib/separator/src/lib` | functions, 0 percent |
| Holdings and Trade | `app.auth` | methods, 92.9 percent |
| Order and Sell | `app.market` | complexity, 82.9 percent |
| Auth service | `auth/strategies` | branches, 75.0 percent |

All four suites passed and all coverage checks were met.

## Analysis

The Java services share their `account`, `holding`, `auth`, `user`, and `market` packages file for file, and the tests for those packages are shared in the same way. In Holdings and Trade, `MarketDataRepository` runs its SQL against H2 in PostgreSQL mode and its Parquet path against a partition written by DuckDB during the test, leaving `app.auth` as the weakest package on methods even though every package clears the 85 percent floor. In Order and Sell, the same `MarketDataRepository` class is exercised far less, which makes the shared `app.market` package the weakest on every counter; the rest of the package, including `MarketReplayService`, keeps it above the 70 percent floor. The Order and Sell order path is covered end to end: unit tests reach every execution-time recheck in `OrderExecutionService`, and endpoint tests submit a buy and a sell through `POST /api/orders` and check the fills, cash transactions, holding movements, and audit trail left behind, then read the caller's own orders back through `GET /api/orders`. The remaining misses are unused entity accessors, `MarketModels.Day`, a record nothing constructs, and the `IllegalStateException` suppliers guarding states the validated order path cannot reach.

In the client UI, the weakest spots are now in `shared-ui-components`, the library extracted from `apps/client-ui` components still carrying untested peripheral pieces such as the separator and field primitives (0 percent functions, 20-38 percent branches/lines). The application code itself is well covered: login, registration, and order submission tests drive template event handlers through the rendered DOM. The remaining branch gaps outside the shared library sit mostly in `token-storage.service.ts`, where browser storage is unavailable, and in the dashboard and market-page components.

In the auth service, the key service, local Passport strategy, and every controller route are tested. What remains is almost entirely the metadata branches TypeScript emits for decorated constructor parameters and entity column types, which no test can reach.

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
