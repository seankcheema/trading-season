# Business backend

Spring Boot application targeting Java 21. Implements registration and username/password login with database sessions. Its identities are separate from NestJS auth users.

Follow [database setup](../../docs/reference/database.md#disposable-business-database-setup) before exercising the API. From this directory:

```sh
mvn spring-boot:run
mvn test
```

The app defaults to port 8080 and a business PostgreSQL database; tests use H2. Configuration lives in [application.properties](src/main/resources/application.properties).

See [API contracts](../../docs/reference/api.md), [development and Javadocs](../../docs/guides/development.md#javadocs), and the [database ERD](db/erd.md). Update affected Javadoc comments and regenerate documentation with every Java code change.
