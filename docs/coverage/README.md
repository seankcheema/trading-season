# Code coverage

Generated coverage reports for the four tested services. The client UI and auth service reports are from a local run on 2026-09-29, after the password reset work; the two Java reports are from the run on 2026-09-28, since no Java code has changed since. Each service keeps its own tooling and its own report format; this directory holds the generated output so the reports can be read without rerunning the suites. Open [index.html](index.html) for a single page of links into all four reports. The reporting placeholders contain no application code and have no coverage.

Every service enforces a 70 percent floor in its own test command rather than reporting a number for a human to check. The Java services apply it to every package on every JaCoCo counter; the UI and auth service apply it to the whole run on each counter. A suite that falls below the floor fails, so a report in this directory describes a run that already passed its gate. The mechanisms are listed under [coverage floors](../guides/development.md#coverage-floors).

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
| Client UI | 277 in 22 files | 95.25 percent (2648/2780) | 90.94 percent (894/983) | 92.18 percent (472/512) | 95.85 percent (2150/2243) |
| Holdings and Trade | 100 | 96.96 percent (3028/3123) | 94.53 percent (121/128) | 93.75 percent (195/208) | 95.10 percent (544/572) |
| Order and Sell | 148 | 97.43 percent (4131/4240) | 95.78 percent (159/166) | 95.52 percent (320/335) | 96.68 percent (873/903) |
| Auth service | 163 in 12 files | 99.01 percent (302/305) | 93.60 percent (117/125) | 95.52 percent (64/67) | 99.66 percent (300/301) |

Every folder and package is at or above 70 percent on every counter. The weakest in each service:

| Service | Weakest folder or package | Lowest counter |
| --- | --- | --- |
| Client UI | `app/dashboard` | branches, 82.35 percent |
| Holdings and Trade | `app.user` | complexity and methods, 80.5 percent |
| Order and Sell | `app.user` | complexity and methods, 87.8 percent |
| Auth service | `auth/strategies` | branches, 75.0 percent |

All four suites passed and all coverage checks were met.

## Analysis

The Java services share their `account`, `holding`, `auth`, `user`, and `market` packages file for file, and the tests for those packages are shared in the same way. `MarketDataRepository`, previously the largest uncovered class, now runs its SQL against H2 in PostgreSQL mode and its Parquet path against a partition written by DuckDB during the test. The Order and Sell order path is covered end to end: unit tests reach every execution-time recheck in `OrderExecutionService`, and endpoint tests submit a buy and a sell through `POST /api/orders` and check the fills, cash transactions, holding movements, and audit trail left behind, then read the caller's own orders back through `GET /api/orders`. The remaining misses are unused entity accessors, `MarketModels.Day`, a record nothing constructs, and the `IllegalStateException` suppliers guarding states the validated order path cannot reach.

In the client UI, template event handlers were the main function-counter gap; the login, registration, and order submission tests now drive them through the rendered DOM. The password reset screens are covered the same way: `app/forgot-password` is fully covered and `app/reset-password` misses only two template handlers. The remaining branch gaps sit mostly in `token-storage.service.ts`, where browser storage is unavailable, and in the dashboard component.

In the auth service, the key service, local Passport strategy, and every controller route are tested, as are both password reset routes, the reset-token store and the mail client, whose SMTP transport is stubbed rather than dialled. What remains is almost entirely the metadata branches TypeScript emits for decorated constructor parameters and entity column types, which no test can reach.

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
