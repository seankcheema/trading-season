# Repository instructions

## Find the right context

Read [README.md](README.md) for the service map, then only the references needed for the task:

| Task | Reference |
| --- | --- |
| Setup, build, test, review | [Development](docs/guides/development.md) |
| Service boundaries and integration | [Architecture](docs/reference/architecture.md) |
| HTTP contract changes | [API reference](docs/reference/api.md) |
| Schema changes | [Database](docs/reference/database.md) |
| Deployment and CI | [Operations](docs/guides/operations.md) |
| Reporting work | [Proposal](docs/reference/reporting.md) |

Follow nested AGENTS.md instructions for the area being changed. Reporting is proposed; do not treat its examples as existing functionality.

## Working rules

- Keep deployable applications in apps, shared Angular components in packages, and operational configuration in infrastructure.
- Inspect source, manifests, tests, and configuration before relying on documentation. Resolve disagreements by correcting docs to match implemented behavior.
- The Java session API and NestJS token API are separate implementations. Do not assume they share users or credentials.
- Preserve unrelated working changes. Use git mv for tracked file moves.
- Do not commit secrets, dependencies, temporary build output, or test reports.
- Do not edit applied database migrations; add a new migration. The Java bootstrap SQL is destructive and requires an explicitly disposable database.
- Keep one canonical document per topic. Link to source instead of copying implementation code. Use no emojis in Markdown.

## Commands

Run from repository root unless a working directory is specified:

| Check | Command |
| --- | --- |
| Workspace dependencies | npm ci |
| Auth dependencies | npm --prefix apps/auth-service ci |
| UI build | npm --workspace business-logic-ui run build |
| UI tests | npm --workspace business-logic-ui test -- --no-watch |
| Java tests | mvn -B -f apps/business-backend/pom.xml test |
| Auth tests | npm --prefix apps/auth-service test |
| Auth lint | npm --prefix apps/auth-service run lint |
| Javadocs | mvn -B -f apps/business-backend/pom.xml org.apache.maven.plugins:maven-javadoc-plugin:3.11.2:javadoc |

Root Turborepo tasks do not cover the Java or auth services. Check manifests before assuming a task exists.

## Definition of done

- Run relevant checks and report failures or unavailable prerequisites accurately.
- Update canonical documentation in the same change when commands, interfaces, configuration, or boundaries change.
- When Java code changes, update affected Javadoc comments in the same change: behavior, parameters, return values, and exceptions. Regenerate Javadocs and review changed class pages before completion. Fix generation errors and any warnings introduced by the change.
- Keep the checked-in Javadocs in docs/JAVA_DOCS. After a Java change, successfully regenerate into apps/business-backend/target/reports/apidocs, review the output, then refresh the complete checked-in copy in the same change. Temporary target output remains ignored.
- Check relative documentation links and anchors, scan Markdown for emojis, and run git diff --check.
