# Trading Java Common

Java source that the [Holdings and Trade Service](../../apps/holdings-and-trade-service/README.md) and the [Order and Sell Service](../../apps/order-and-sell-service/README.md) both need. It exists so that code the two services used to hold as copies lives in one place.

This is a source directory, not a Maven artifact. There is no pom here and nothing is published or installed. Each service's pom adds `src/main/java` and `src/test/java` from this directory as extra source roots with the build-helper plugin, so the classes are compiled, tested, measured by JaCoCo and documented as part of each service, in the same `app` packages they were in before. Every `mvn -f apps/<service>/pom.xml ...` command in the [repository instructions](../../AGENTS.md) works unchanged.

## What is here

| Package | Shared source |
| --- | --- |
| `app.auth` | The authenticated caller, 401 and 403 writers, forbidden exception, the resource-server security base class and the common exception handler base class |
| `app.market` | The simulated market feed: controller, replay service, repository, models, responses, timeframes, rate-limit web configuration |
| `app.user`, `app.account`, `app.holding`, `app.cash`, `app.instrument` | Mapped superclasses for the tables both services read, and the lookups both make; each service's entity or service extends the base and adds only what it alone needs |
| `app.config` | The OpenAPI description both services publish |
| `app.record` | The publisher of `platform-records` |

A class belongs here when it is the same in both services, or when the only differences can be expressed as an override or a subclass in each service. Where the two services genuinely differ (which endpoints are public, which columns an entity maps, which messages an exception handler adds) each service keeps its own small subclass:

- `SecurityConfig` extends `ResourceServerSecurity` and names the endpoints only that service leaves public.
- `GlobalExceptionHandler` extends `ApiExceptionHandler` and adds the failures only that service raises.
- Each `Account`, `CashTransaction`, `HoldingMovement`, `Instrument` and `TermsAcceptance` extends its `...Base` mapped superclass.
- Each `UserService` extends `UserLookupService`.

Shared classes may refer to classes that exist in both services under the same name and package (`app.record.PlatformRecord`, `app.user.UserRepository`, `app.Main`); the shared tests may use the same. Neither service can be compiled without this directory, and this directory cannot be compiled by itself.

## Working on it

- Change shared code only with both services' tests in mind: run both `mvn -B -f apps/holdings-and-trade-service/pom.xml test` and `mvn -B -f apps/order-and-sell-service/pom.xml test`. Tests under `src/test/java` here run once in each.
- Both services' JaCoCo floors apply to these classes, each against its own run. A class one service never exercises needs a test here, not in that service.
- Do not add a dependency that only one service has. Both poms must provide everything this source imports.
- The Docker images build from the repository root so this directory is in the build context; see [infrastructure](../../infrastructure/README.md#java-service-images).
- SonarQube analyses this directory once. The coverage it shows for a file here merges the two services' runs: a line or branch covered in either counts as covered ([jacoco-to-sonar-coverage.mjs](../../infrastructure/jenkins/jacoco-to-sonar-coverage.mjs)).
- Both services' checked-in [Javadocs](../../docs/JAVA_DOCS) include these classes, so regenerate both after a change here.
