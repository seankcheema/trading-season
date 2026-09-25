# Code coverage

Generated coverage reports for the four tested services, captured from a full local run on 2026-09-25. Each service keeps its own tooling and its own report format; this directory holds the generated output so the reports can be read without rerunning the suites. The reporting placeholders contain no application code and have no coverage.

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
| Client UI | 244 in 20 files | 94.87 percent (2405/2535) | 89.98 percent (818/909) | 91.90 percent (443/482) | 95.45 percent (1951/2044) |
| Holdings and Trade | 100 | 96.96 percent (3028/3123) | 94.53 percent (121/128) | 93.75 percent (195/208) | 95.10 percent (544/572) |
| Order and Sell | 136 | 97.51 percent (4109/4214) | 95.78 percent (159/166) | 95.48 percent (317/332) | 96.66 percent (867/897) |
| Auth service | 106 in 10 files | 99.04 percent (208/210) | 92.85 percent (78/84) | 96.00 percent (48/50) | 99.51 percent (207/208) |

Every folder and package is at or above 70 percent on every counter. The weakest in each service:

| Service | Weakest folder or package | Lowest counter |
| --- | --- | --- |
| Client UI | `app/dashboard` | branches, 82.35 percent |
| Holdings and Trade | `app.user` | complexity and methods, 80.5 percent |
| Order and Sell | `app.user` | complexity and methods, 87.8 percent |
| Auth service | `auth/strategies` | branches, 75.0 percent |

All four suites passed and all coverage checks were met.

## Analysis

The Java services share their `account`, `holding`, `auth`, `user`, and `market` packages file for file, and the tests for those packages are shared in the same way. `MarketDataRepository`, previously the largest uncovered class, now runs its SQL against H2 in PostgreSQL mode and its Parquet path against a partition written by DuckDB during the test. The Order and Sell order path is covered end to end: unit tests reach every execution-time recheck in `OrderExecutionService`, and an endpoint test submits a buy and a sell through `POST /api/orders` and checks the fills, cash transactions, holding movements, and audit trail left behind. The remaining misses are eight unused accessors on the `User` entity and `MarketModels.Day`, a record nothing constructs.

In the client UI, template event handlers were the main function-counter gap; the login, registration, and order submission tests now drive them through the rendered DOM. The remaining branch gaps sit mostly in `token-storage.service.ts`, where browser storage is unavailable, and in the dashboard component.

In the auth service, the key service, local Passport strategy, and every controller route are now tested. What remains is almost entirely the metadata branches TypeScript emits for decorated constructor parameters and entity column types, which no test can reach.

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
