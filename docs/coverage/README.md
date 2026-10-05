# Code coverage

Generated coverage reports for the four tested services. All four reports are from local runs on 2026-10-02. Each service keeps its own tooling and its own report format; this directory holds the generated output so the reports can be read without rerunning the suites. Open [index.html](index.html) for a single page of links into all four reports. The reporting placeholders contain no application code and have no coverage.

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
| Client UI | 350 in 27 files | 93.79 percent (3977/4240) | 88.31 percent (1451/1643) | 91.16 percent (722/792) | 94.47 percent (3212/3400) |
| Holdings and Trade | 284 | 98.03 percent (3876/3954) | 95.12 percent (156/164) | 97.64 percent (289/296) | 97.59 percent (770/789) |
| Order and Sell | 138 | 91.46 percent (3900/4264) | 90.74 percent (147/162) | 91.12 percent (308/338) | 93.05 percent (843/906) |
| Auth service | 104 in 10 files | 99.02 percent (204/206) | 92.50 percent (74/80) | 96.00 percent (48/50) | 99.50 percent (203/204) |

Every folder and package is at or above its floor on every counter, since the UI and auth floors apply to the whole run rather than per folder. The weakest in each service:

| Service | Weakest folder or package | Lowest counter |
| --- | --- | --- |
| Client UI | `src/app/market-page` | branches, 79.2 percent |
| Holdings and Trade | `app.auth` | methods, 92.9 percent |
| Order and Sell | `app.market` | complexity, 82.9 percent |
| Auth service | `auth/strategies` | branches, 75.0 percent |

All four suites passed and all coverage checks were met.

## Analysis

The Java services share their `account`, `holding`, `auth`, `user`, and `market` packages file for file, and the tests for those packages are shared in the same way. In Holdings and Trade, `MarketDataRepository` runs its SQL against H2 in PostgreSQL mode and its Parquet path against a partition written by DuckDB during the test, leaving `app.auth` as the weakest package on methods even though every package clears the 85 percent floor. In Order and Sell, the same `MarketDataRepository` class is exercised far less, which makes the shared `app.market` package the weakest on every counter; the rest of the package, including `MarketReplayService`, keeps it above the 70 percent floor. The Order and Sell order path is covered end to end: unit tests reach every execution-time recheck in `OrderExecutionService`, and endpoint tests submit a buy and a sell through `POST /api/orders` and check the fills, cash transactions, holding movements, and audit trail left behind, then read the caller's own orders back through `GET /api/orders`. The remaining misses are unused entity accessors, `MarketModels.Day`, a record nothing constructs, and the `IllegalStateException` suppliers guarding states the validated order path cannot reach.

In the client UI, `shared-ui-components` is now fully exercised (100 percent functions, 98.1 percent statements, 93.2 percent branches), so the weakest spots have moved back into the application itself. `src/app/market-page` is lowest on branches at 79.2 percent, followed by `src/app/core/auth` at 83.2 percent, where `token-storage.service.ts` carries paths for a browser storage that is unavailable. Login, registration, and order submission tests drive template event handlers through the rendered DOM, so the application paths a client actually takes are covered.

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
