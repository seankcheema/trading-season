# Documentation

Read only the guide or reference relevant to your task. Application READMEs provide local setup details; source and tests define implemented behavior.

| Read this when you need to… | Document |
| --- | --- |
| Install, run, test, contribute, or regenerate Javadocs | [Development](guides/development.md) |
| Configure services, investigate failures, or work on CI | [Operations](guides/operations.md) |
| Understand service ownership and integration gaps | [Architecture](reference/architecture.md) |
| Change or consume an implemented HTTP endpoint | [API reference](reference/api.md) |
| Understand schema ownership, migrations, and relationships | [Database](reference/database.md) |
| Browse generated Java class and member documentation | [Javadocs](JAVA_DOCS/index.html) |
| Review test coverage for the frontend, backend, or auth service | [Code coverage](coverage/README.md) |
| Plan future analytics work | [Reporting proposal](reference/reporting.md) |

Guides contain procedures; references describe the system and clearly label proposed work. Keep each topic in one place and update its document alongside code changes. The checked-in JAVA_DOCS directory holds generated Java documentation; refresh it alongside Java code changes using the development guide. The checked-in coverage directory holds generated coverage reports for all three tested tiers; regenerate it using the commands in that document rather than editing the reports.

[Project overview](../README.md) · [Agent instructions](../AGENTS.md)
