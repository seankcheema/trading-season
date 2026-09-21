# Code coverage

Generated coverage reports for the three tested tiers, captured from a full local run on 2026-09-21. Each tier keeps its own tooling and its own report format; this directory holds the generated output so the reports can be read without rerunning the suites.

Every tier enforces a 50 percent floor in the build rather than reporting a number for a human to check. A suite that falls below the floor fails; a report in this directory therefore describes a run that already passed its gate.

## Reports

| Tier | Tool | Report | Configuration |
| --- | --- | --- | --- |
| Frontend (Angular) | Angular unit-test builder with Vitest and v8 | [frontend/index.html](frontend/index.html) | `coverageThresholds` in [angular.json](../../apps/business-logic-ui/angular.json) |
| Backend (Spring Boot) | JaCoCo 0.8.13 | [backend/index.html](backend/index.html) | `jacoco-maven-plugin` `check-coverage` execution in [pom.xml](../../apps/business-backend/pom.xml) |
| Auth service (NestJS) | Vitest with v8 | [auth-service/index.html](auth-service/index.html) | `test.coverage.thresholds` in [vitest.config.ts](../../apps/auth-service/vitest.config.ts) |

Machine-readable output sits alongside each HTML report: `frontend/clover.xml` and `frontend/coverage-final.json`, `backend/jacoco.xml` and `backend/jacoco.csv`, and `auth-service/lcov.info` and `auth-service/cobertura-coverage.xml`.

## Results

Counters differ by tool. JaCoCo measures bytecode instructions and branches; the v8 provider measures statements, branches, functions, and lines of source. The line counter is the only one the three tiers share.

| Tier | Tests | Statements / Instructions | Branches | Functions / Methods | Lines |
| --- | --- | --- | --- | --- | --- |
| Frontend | 130 in 13 files | 86.67 percent (1769/2041) | 78.33 percent (535/683) | 75.20 percent (276/367) | 88.88 percent (1456/1638) |
| Backend | 63 | 59.44 percent (2505/4214) | 47.59 percent (79/166) | 54.52 percent (181/332) | 54.85 percent (492/897) |
| Auth service | 82 in 8 files | 86.66 percent (182/210) | 77.38 percent (65/84) | 82.00 percent (41/50) | 87.01 percent (181/208) |

All three suites passed and all coverage checks were met.

## Analysis

The backend clears its floor by roughly five points of line coverage and is still the tier with the least headroom; `app.market` rose to 65.54 percent with the new `MarketReplayService` tests. Coverage there is concentrated in the packages that have dedicated tests: `app.order.validation` at 100 percent, `app.order.validation.impl` at 97.78 percent, `app.auth` at 96.81 percent, and `app.user` at 89.50 percent. The order execution path is the largest untested area, with `app.order.execution` at 8.01 percent, `app.order` at 11.11 percent, and `app.order.audit` at 13.64 percent. `app.market.MarketDataRepository` is the single largest uncovered class at 2.7 percent of 475 instructions, and several DTOs, records, and exception types are never constructed in a test. Because JaCoCo's bundle-level rule averages across all 66 classes, adding code to those packages without adding tests moves the whole tier toward the floor.

Frontend gaps are narrower and mostly sit in branch and function counters rather than lines. `instrument-search.component.ts` is the outlier at 31.9 percent of statements; `market-data.service.ts` follows at 59.3 percent, with its uncovered lines in the error-handling path. The template files report high line coverage with low function coverage, which reflects untriggered event handlers rather than unrendered markup. Authentication, login, and registration are the best-covered areas. The new `session-timeout.service.ts` covers every function and 91.86 percent of lines, and the settings dialog reaches 100 percent of lines.

The auth service is the most evenly covered tier. Its two gaps are `auth/strategies/local.strategy.ts` at 25 percent, which is never exercised because the specs drive the service layer directly rather than through Passport, and `auth/services` key handling at 68.96 percent, where key-rotation and error branches are not reached.

## Regenerate

Run from the repository root. Each command writes to its tier's own build output; copy the result into this directory afterward.

| Tier | Command | Source of the copied report |
| --- | --- | --- |
| Frontend | `npx ng test --no-watch --coverage` from `apps/business-logic-ui` | `apps/business-logic-ui/coverage/business-logic-ui` |
| Backend | `mvn -B -f apps/business-backend/pom.xml clean test` | `apps/business-backend/target/site/jacoco` |
| Auth service | `npm --prefix apps/auth-service run test:cov` | `apps/auth-service/coverage` |

Do not edit these files by hand; regenerate them. See [Development](../guides/development.md) for the full check list and [Operations](../guides/operations.md) for how the Jenkins pipeline publishes the same reports as build artifacts.

[Documentation](../README.md) · [Project overview](../../README.md)
