# Code coverage

Generated coverage reports for the five tested services. The JavaScript and Java reports are from local runs on 2026-10-01; the reporting service report is from a local run on 2026-10-02. Each service keeps its own tooling and its own report format; this directory holds the generated output so the reports can be read without rerunning the suites. Open [index.html](index.html) for a single page of links into all five reports.

Every service enforces a 70 percent floor in its own test command rather than reporting a number for a human to check (85 percent for Holdings and Trade). The Java services apply it to every package on every JaCoCo counter; the UI and auth service apply it to the whole run on each counter. A suite that falls below the floor fails, so a report in this directory describes a run that already passed its gate. The mechanisms are listed under [coverage floors](../guides/development.md#coverage-floors).

## Reports

| Service | Tool | Report | Configuration |
| --- | --- | --- | --- |
| Client UI (Angular) | Angular unit-test builder with Vitest and v8 | [client-ui/index.html](client-ui/index.html) | `coverageThresholds` in [angular.json](../../apps/client-ui/angular.json) |
| Holdings and Trade (Spring Boot) | JaCoCo 0.8.15 | [holdings-and-trade-service/index.html](holdings-and-trade-service/index.html) | `check-coverage` execution in [pom.xml](../../apps/holdings-and-trade-service/pom.xml) |
| Order and Sell (Spring Boot) | JaCoCo 0.8.15 | [order-and-sell-service/index.html](order-and-sell-service/index.html) | `check-coverage` execution in [pom.xml](../../apps/order-and-sell-service/pom.xml) |
| Auth service (NestJS) | Vitest with v8 | [auth-service/index.html](auth-service/index.html) | `test.coverage.thresholds` in [vitest.config.ts](../../apps/auth-service/vitest.config.ts) |
| Reporting service (Flask) | Pytest with coverage.py | [reporting-service/index.html](reporting-service/index.html) | `addopts` in [pytest.ini](../../apps/reporting-service/pytest.ini) |

Machine-readable output sits alongside each HTML report: `client-ui/clover.xml` and `client-ui/coverage-final.json`, `jacoco.xml` and `jacoco.csv` in each Java service directory, `auth-service/lcov.info` and `auth-service/cobertura-coverage.xml`, and `reporting-service/coverage.xml`.

## Results

Counters differ by tool. JaCoCo measures bytecode instructions and branches; the v8 provider measures statements, branches, functions, and lines of source. The line counter is the only one every service shares.

| Service | Tests | Statements / Instructions | Branches | Functions / Methods | Lines |
| --- | --- | --- | --- | --- | --- |
| Client UI | 310 in 22 files | 91.56 percent (3867/4223) | 86.43 percent (1676/1939) | 87.1 percent (689/791) | 92.48 percent (3127/3381) |
| Holdings and Trade | 290 | 98.04 percent (3892/3970) | 95.12 percent (156/164) | 97.65 percent (291/298) | 97.60 percent (773/792) |
| Order and Sell | 143 | 91.83 percent (3956/4308) | 90.96 percent (151/166) | 91.52 percent (313/342) | 93.68 percent (860/918) |
| Auth service | 109 in 11 files | 99.05 percent (210/212) | 92.85 percent (78/84) | 96.07 percent (49/51) | 99.52 percent (209/210) |
| Reporting service | 241 | 98.63 percent (2232/2263) | n/a | n/a | 98.63 percent (2232/2263) |

Every folder and package is at or above its floor on every counter where a floor exists, since the UI and auth floors apply to the whole run rather than per folder. The weakest in each service:

| Service | Weakest folder or package | Lowest counter |
| --- | --- | --- |
| Client UI | `src/app/market-page` | branches, 79.2 percent |
| Holdings and Trade | `app.auth` | methods, 92.9 percent |
| Order and Sell | `app.market` | complexity, 82.9 percent |
| Auth service | `auth/strategies` | branches, 75.0 percent |
| Reporting service | `wsgi.py` | statements/lines, 57.1 percent |

All five suites passed their recorded runs. The reporting service currently publishes coverage output but does not enforce a numeric threshold in `pytest.ini`.

## Analysis

The Java services share their `account`, `holding`, `auth`, `user`, and `market` packages file for file, and the tests for those packages are shared in the same way. In Holdings and Trade, `MarketDataRepository` runs its SQL against H2 in PostgreSQL mode and its Parquet path against a partition written by DuckDB during the test, leaving `app.auth` as the weakest package on methods even though every package clears the 85 percent floor. In Order and Sell, the same `MarketDataRepository` class is exercised far less, which makes the shared `app.market` package the weakest on every counter; the rest of the package, including `MarketReplayService`, keeps it above the 70 percent floor. The Order and Sell order path is covered end to end: unit tests reach every execution-time recheck in `OrderExecutionService`, and endpoint tests submit a buy and a sell through `POST /api/orders` and check the fills, cash transactions, holding movements, and audit trail left behind, then read the caller's own orders back through `GET /api/orders`. The remaining misses are unused entity accessors, `MarketModels.Day`, a record nothing constructs, and the `IllegalStateException` suppliers guarding states the validated order path cannot reach.

In the client UI, `shared-ui-components` is now fully exercised (100 percent functions, 98.1 percent statements, 93.2 percent branches), so the weakest spots have moved back into the application itself. `src/app/market-page` is lowest on branches at 79.2 percent, followed by `src/app/core/auth` at 83.2 percent, where `token-storage.service.ts` carries paths for a browser storage that is unavailable. Login, registration, and order submission tests drive template event handlers through the rendered DOM, so the application paths a client actually takes are covered.

In the auth service, the key service, local Passport strategy, and every controller route are tested. What remains is almost entirely the metadata branches TypeScript emits for decorated constructor parameters and entity column types, which no test can reach.

In the reporting service, every production module now clears 97 percent except `wsgi.py`. `routes.py` and `scheduled_tasks.py` are at 100 percent: each portfolio, trade-history, drill-down, and performance endpoint is driven end to end with a mocked `verify_token` and real SQLite-backed fixtures (including a profitable and a losing SELL trade so win/loss/break-even branches all execute), and the scheduler's disabled-config, job-registration-failure, and shutdown branches are reached by resetting the module-level `scheduler` singleton before calling it. `app.py` is at 97 percent; the only misses are the PostgreSQL-only connection-pool branch (the test database is SQLite), the `version()` fallback query for non-SQLite engines, and the `if __name__ == '__main__':` guard, none of which are reachable without a different database engine or running the file as a script. `wsgi.py` stays at 57 percent for the same reason: importing it covers the module body, but its `if __name__ == '__main__':` block cannot run under pytest. The generated report also includes the test modules themselves because coverage is configured as `--cov=.` from the service root; they are effectively fully covered, which is why the published total (98.63 percent) sits above the production-only average.

## Regenerate

Run from the repository root. Each command writes to its service's own build output; copy the result into this directory afterward.

| Service | Command | Source of the copied report |
| --- | --- | --- |
| Client UI | `npm --prefix apps/client-ui test -- --no-watch --coverage` | `apps/client-ui/coverage/client-ui` |
| Holdings and Trade | `mvn -B -f apps/holdings-and-trade-service/pom.xml clean test` | `apps/holdings-and-trade-service/target/site/jacoco` |
| Order and Sell | `mvn -B -f apps/order-and-sell-service/pom.xml clean test` | `apps/order-and-sell-service/target/site/jacoco` |
| Auth service | `npm --prefix apps/auth-service run test:cov` | `apps/auth-service/coverage` |
| Reporting service | `Push-Location apps/reporting-service; pytest; Pop-Location` | `apps/reporting-service/htmlcov` |

Do not edit these files by hand; regenerate them. See [Development](../guides/development.md) for the full check list and [Operations](../guides/operations.md) for how the Jenkins pipeline publishes the same reports as build artifacts.

[Documentation](../README.md) · [Project overview](../../README.md)
