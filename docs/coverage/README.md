# Code coverage

Generated coverage reports for the three tested tiers, captured from a full local run on 2026-09-17. Each tier keeps its own tooling and its own report format; this directory holds the generated output so the reports can be read without rerunning the suites.

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
| Frontend | 88 in 11 files | 86.06 percent (1581/1837) | 77.06 percent (467/606) | 73.55 percent (242/329) | 88.45 percent (1295/1464) |
| Backend | 60 | 55.35 percent (2327/4204) | 43.98 percent (73/166) | 52.71 percent (175/332) | 51.34 percent (460/896) |
| Auth service | 82 in 8 files | 86.66 percent (182/210) | 77.38 percent (65/84) | 82.00 percent (41/50) | 87.01 percent (181/208) |

All three suites passed and all coverage checks were met.

## Analysis

The backend clears its floor by roughly one point of line coverage and is the tier with the least headroom. Coverage there is concentrated in the packages that have dedicated tests: `app.order.validation` at 100 percent, `app.order.validation.impl` at 97.78 percent, `app.auth` at 96.75 percent, and `app.user` at 89.50 percent. The order execution path is the largest untested area, with `app.order.execution` at 8.01 percent, `app.order` at 11.11 percent, and `app.order.audit` at 13.64 percent. `app.market.MarketDataRepository` is the single largest uncovered class at 2.7 percent of 475 instructions, and several DTOs, records, and exception types are never constructed in a test. Because JaCoCo's bundle-level rule averages across all 66 classes, adding code to those packages without adding tests moves the whole tier toward the floor.

Frontend gaps are narrower and mostly sit in branch and function counters rather than lines. `instrument-search.component.ts` is the outlier at 31.9 percent of statements; `market-data.service.ts` follows at 59.3 percent, with its uncovered lines in the error-handling path. The template files report high line coverage with low function coverage, which reflects untriggered event handlers rather than unrendered markup. Authentication, login, and registration are the best-covered areas, consistent with the recent end-to-end work on those flows.

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
