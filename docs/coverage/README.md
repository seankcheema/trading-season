# Code coverage

Generated coverage reports for the four tested services. All four reports are from local runs on 2026-09-30. Each service keeps its own tooling and its own report format; this directory holds the generated output so the reports can be read without rerunning the suites. Open [index.html](index.html) for a single page of links into all four reports. The reporting placeholders contain no application code and have no coverage.

Every service enforces a 70 percent floor in its own test command rather than reporting a number for a human to check (85 percent for Holdings and Trade). The Java services apply it to every package on every JaCoCo counter; the UI and auth service apply it to the whole run on each counter. A suite that falls below the floor fails, so a report in this directory describes a run that already passed its gate. The mechanisms are listed under [coverage floors](../guides/development.md#coverage-floors).

## Reports

| Service | Tool | Report | Configuration |
| --- | --- | --- | --- |
| Client UI (Angular) | Angular unit-test builder with Vitest and v8 | [client-ui/index.html](client-ui/index.html) | `coverageThresholds` in [angular.json](../../apps/client-ui/angular.json) |
| Holdings and Trade (Spring Boot) | JaCoCo 0.8.13 | [holdings-and-trade-service/index.html](holdings-and-trade-service/index.html) | `check-coverage` execution in [pom.xml](../../apps/holdings-and-trade-service/pom.xml) |
| Order and Sell (Spring Boot) | JaCoCo 0.8.13 | [order-and-sell-service/index.html](order-and-sell-service/index.html) | `check-coverage` execution in [pom.xml](../../apps/order-and-sell-service/pom.xml) |
| Auth service (NestJS) | Vitest with v8 | [auth-service/index.html](auth-service/index.html) | `test.coverage.thresholds` in [vitest.config.ts](../../apps/auth-service/vitest.config.ts) |

Machine-readable output sits alongside each HTML report: `client-ui/clover.xml` and `client-ui/coverage-final.json`, `jacoco.xml` and `jacoco.csv` in each Java service directory, and `auth-service/lcov.info` and `auth-service/cobertura-coverage.xml`.

## Results

Counters differ by tool. JaCoCo measures bytecode instructions and branches; the v8 provider measures statements, branches, functions, and lines of source. The line counter is the only one every service shares.

| Service | Tests | Statements / Instructions | Branches | Functions / Methods | Lines |
| --- | --- | --- | --- | --- | --- |
| Client UI | 344 in 24 files | 93.47 percent (3722/3982) | 87.75 percent (1261/1437) | 89.98 percent (647/719) | 94.14 percent (3038/3227) |
| Holdings and Trade | 290 | 98.04 percent (3892/3970) | 95.12 percent (156/164) | 97.65 percent (291/298) | 97.60 percent (773/792) |
| Order and Sell | 158 | 92.06 percent (4045/4394) | 91.07 percent (153/168) | 91.95 percent (320/348) | 93.92 percent (881/938) |
| Auth service | 109 in 11 files | 99.05 percent (210/212) | 92.85 percent (78/84) | 96.07 percent (49/51) | 99.52 percent (209/210) |

Every folder and package is at or above 70 percent on every counter. The weakest in each service:

| Service | Weakest folder or package | Lowest counter |
| --- | --- | --- |
| Client UI | `app/market-page` | branches, 79.18 percent |
| Holdings and Trade | `app.auth` | methods, 92.86 percent |
| Order and Sell | `app.market` | complexity, 82.93 percent |
| Auth service | `refresh-tokens` | functions, 77.77 percent |

The earlier figures in this table were higher because they came from a JaCoCo execution file that several `mvn test` runs had written to in turn, which merges their coverage. Every number above is from the `clean test` run the regeneration table prescribes, so the Java percentages are lower than they were while measuring strictly more tests.

All four suites passed and all coverage checks were met.

## Analysis

The Java services share their `account`, `holding`, `auth`, `user`, and `market` packages file for file, and the tests for those packages are shared in the same way. `MarketDataRepository`, previously the largest uncovered class, now runs its SQL against H2 in PostgreSQL mode and its Parquet path against a partition written by DuckDB during the test. The Order and Sell order path is covered end to end: unit tests reach every execution-time recheck in `OrderExecutionService`, and endpoint tests submit a buy and a sell through `POST /api/orders` and check the fills, cash transactions, holding movements, and audit trail left behind, then read the caller's own orders back through `GET /api/orders`. Submission is also covered for the account it refuses: another user's account, an account that does not exist, and an instrument that does not exist. `app.instrument`, which serves the lookup a client needs to name an instrument, is fully covered. The remaining misses are unused entity accessors, `MarketModels.Day`, a record nothing constructs, and the `IllegalStateException` suppliers guarding states the validated order path cannot reach.

In the client UI, template event handlers were the main function-counter gap; the login, registration, and order submission tests now drive them through the rendered DOM. `app/dashboard/orders`, which holds the order service and its error mapping, is fully covered, including the idempotency-key fallback for a browser without `crypto.randomUUID`. The remaining branch gaps sit mostly in `token-storage.service.ts`, where browser storage is unavailable, in the market page, and in the dashboard component.

The UI's whole-run branch and function counters, at 87.75 and 89.98 percent, are the two figures anywhere below 90 percent. Both were already below it before the order integration and both rose slightly with it, from 87.36 and 89.91 percent. What is left is concentrated in surfaces the integration does not touch: the market page, the landing page, and `price-chart.component.ts`.

In the auth service, the key service, local Passport strategy, and every controller route are tested. What remains is almost entirely the metadata branches TypeScript emits for decorated constructor parameters and entity column types, which no test can reach.

## Regenerate

Run from the repository root. Each command writes to its service's own build output; copy the result into this directory afterward.

| Service | Command | Source of the copied report |
| --- | --- | --- |
| Client UI | `npm --workspace business-logic-ui test -- --no-watch --coverage` | `apps/client-ui/coverage/business-logic-ui` |
| Holdings and Trade | `mvn -B -f apps/holdings-and-trade-service/pom.xml clean test` | `apps/holdings-and-trade-service/target/site/jacoco` |
| Order and Sell | `mvn -B -f apps/order-and-sell-service/pom.xml clean test` | `apps/order-and-sell-service/target/site/jacoco` |
| Auth service | `npm --prefix apps/auth-service run test:cov` | `apps/auth-service/coverage` |

Do not edit these files by hand; regenerate them. See [Development](../guides/development.md) for the full check list and [Operations](../guides/operations.md) for how the Jenkins pipeline publishes the same reports as build artifacts.

[Documentation](../README.md) · [Project overview](../../README.md)
