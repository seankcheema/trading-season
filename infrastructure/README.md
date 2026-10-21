# Infrastructure

Container and CI configuration. None of it is a production deployment.

| Resource | Purpose |
| --- | --- |
| [docker-compose.local.yml](docker-compose/docker-compose.local.yml) | Full local stack: UI, services, database, Kafka (which creates both topics), and the reporting service with its consumer in one container |
| [docker-compose.jenkins.yml](docker-compose/docker-compose.jenkins.yml) | Optional Jenkins container (UI on host port 8888) plus a second copy of the stack on `ci-network`, used by [setup-jenkins.sh](docker/setup-jenkins.sh). Keep it in step with the local file |
| [docker-compose.kafka-ec2.yml](docker-compose/docker-compose.kafka-ec2.yml) | Override for a host that runs only Kafka: publishes 9092 and advertises the host's private DNS name; see [Kafka on its own host](#kafka-on-its-own-host) |
| [docker/kafka-start.sh](docker/kafka-start.sh) | Starts the broker, creates both topics, and forwards SIGTERM to the broker |
| [Jenkinsfile](jenkins/Jenkinsfile) | CI pipeline |
| [sonar-project.properties](jenkins/sonar-project.properties), [jacoco-to-sonar-coverage.mjs](jenkins/jacoco-to-sonar-coverage.mjs) | SonarQube analysis settings and the Java coverage conversion it depends on |
| [jenkins/kafka-end-to-end.py](jenkins/kafka-end-to-end.py) | Order-to-consumers check the pipeline runs against the built stack |
| [jenkins/market-fixture.sql](jenkins/market-fixture.sql) | Constant-price PostgreSQL replay fixture for the disposable end-to-end stack |
| [jenkins/with-disposable-postgres.sh](jenkins/with-disposable-postgres.sh) | Fresh PostgreSQL 16 database for order concurrency and migration checks, removed on exit |
| [docker/init-db.sh](docker/init-db.sh) | `db-init`: applies every `db/migrations/V*.sql` once, recorded in `public.schema_migrations` |
| [docker/Dockerfile.market-data](docker/Dockerfile.market-data) | Image for the market-data scripts and the Jenkins integration stage |
| [docker/Dockerfile.playwright](docker/Dockerfile.playwright) | Slim headless-Chromium and Python 3 image for the Playwright E2E stage, which runs the Client UI and Reporting UI suites; tagged with the Playwright version and `-python3` |
| [docker/Dockerfile.jenkins](docker/Dockerfile.jenkins), [setup-jenkins.sh](docker/setup-jenkins.sh) | Optional Jenkins image with Node 24, JDK 21, Docker CLI, and Compose |
| [docker/run-compose.sh](docker/run-compose.sh) | Uses `docker compose`, falling back to `docker-compose` |

## Local stack

Create the JWT keys (the stack refuses to start without them), then start everything from the repository root:

```powershell
node apps/auth-service/scripts/generate-dev-keys.mjs | Add-Content infrastructure/docker-compose/.env
docker compose --project-name trading-season-local -f infrastructure/docker-compose/docker-compose.local.yml up -d --build
```

| Service | Host port |
| --- | --- |
| Client UI | 4200 |
| Reporting UI | 4300 |
| Auth Service | 3001 |
| Order and Sell Service | 8081 |
| Holdings and Trade Service | 8082 |
| Reporting Service | 8083 (one container: gunicorn and the Kafka consumer, started by `serve.py`) |
| PostgreSQL | 5432 |
| Kafka | 29092 on this machine's loopback only (`kafka:9092` in the network) |

- `DB_PASSWORD` sets the one database password the auth service and the Java services use. The reporting containers are given no database setting and do not depend on `db` or `db-init`. Defaults are for disposable development only.
- `db-init` migrates the database before dependent services start; a failed migration stops it. Data persists in the `db_data` volume; `down -v` deletes it.
- The `kafka` container creates two topics as it starts ([kafka-start.sh](docker/kafka-start.sh)), each with three partitions; auto-creation is disabled, and the container reports healthy only once both exist. `trade-events` is created with `retention.ms=-1`, so nothing is deleted from it: the reporting service rebuilds its files by replaying it. `trade-events`: the Order and Sell Service publishes to it, and three consumer groups read it: `order-status-pusher` (Order and Sell), `portfolio-valuation-capture` (Holdings and Trade) and `reporting-ingester` (`reporting-service`). `platform-records`: the auth service and both Java services publish to it, and `reporting-ingester` is its only reader; it is created with `cleanup.policy=compact`, so it keeps the latest state of every row instead of expiring by age. The auth service, both Java services and the reporting service start only after `kafka` is healthy and receive `KAFKA_BOOTSTRAP_SERVERS=kafka:9092`.
- The `reporting-service` container runs two processes under `serve.py`: the consumer appends the messages of both topics under `/data/reporting` and writes report runs, and the gunicorn workers read them and build the read model from them. If either process stops the container exits and Compose restarts it. Run exactly one replica. The `reporting_files` volume holds the files, and it is all the data reporting has. `down -v` deletes it, and the files rebuild themselves: the consumer resumes from where each file ends, or from the start of the topic when a file is missing (see [apps/reporting-service](../apps/reporting-service/README.md)).
- A fresh stack needs nothing more: everything is published from the first registration. A database that already holds data, or is loaded by SQL, needs [republish_history.py](../db/README.md#reporting-feed-tools) run once against `localhost:29092` for reporting to see it.
- `reporting-ui` serves the Angular app through Nginx and proxies `/api/reporting` to `reporting-service` and `/auth` to `auth-service`, so it starts after both and needs no CORS entry on either.
- `client-ui` does the same for its three upstreams: `/api/orders`, `/api/instruments` and `/api/me/watchlist` and the rest of `/api` go to the two Java services and `/auth` goes to `auth-service`, so it starts after all three. Both UI containers are local stand-ins for S3 behind CloudFront (see [Static UIs on S3](#static-uis-on-s3)); nothing deploys them.
- To inspect the topic: `docker compose --project-name trading-season-local -f infrastructure/docker-compose/docker-compose.local.yml exec kafka /opt/kafka/bin/kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --all-groups` shows each group's lag.
- Opt-in profiles: `initialize` (first-time empty database) and `seed` (market data steps 0002 to 0004; see [apps/market-data](../apps/market-data/README.md)).
- `scripts/backup-database.sh` and `scripts/restore-database.sh` take and restore a dump of the database; see [Database backup and restore](#database-backup-and-restore).
- For Linux VMs, `scripts/setup-local.sh` at the repository root reuses a local PostgreSQL or starts `db` and `kafka` from this Compose file and waits for `kafka` to be healthy, and runs the applications on the host against `localhost:29092`. With a local PostgreSQL it starts no broker, and it never starts the reporting service or its consumer.

### Kafka on its own host

The broker needs only the Kafka service, because it creates its own topics. On a host that runs only Kafka, such as an EC2 instance, add the override and start that one service:

```sh
KAFKA_ADVERTISED_HOST=<private DNS name of this instance> \
  docker compose -f infrastructure/docker-compose/docker-compose.local.yml \
  -f infrastructure/docker-compose/docker-compose.kafka-ec2.yml up -d kafka
```

- Clients on other hosts bootstrap on `<that name>:9092` and are told to reconnect to the advertised address, so it must be the name they can resolve. Use the private DNS name, not a public IP: it survives a stop and start. Set `KAFKA_BOOTSTRAP_SERVERS` on every service to `<that name>:9092`.
- The listener is PLAINTEXT with no authentication. Allow 9092 in the security group from the services' security group only, and never from outside the VPC. This is a described layout, not a production-ready deployment.
- Put `kafka_data` on a dedicated EBS volume that is not deleted when the instance terminates, and snapshot it. One broker with replication factor 1 has no second copy.
- Topic creation runs inside the container on every start and does nothing when the topics exist. A start that cannot create them stops the broker instead of leaving it up without topics.

### What survives a restart

| Data | Survives | Notes |
| --- | --- | --- |
| Database (RDS or `db_data`) | Yes | Not touched by anything on this page |
| Kafka topics and committed offsets | Container restart and instance stop and start | Lost if the `kafka_data` volume is lost; see the recovery steps below |
| Reporting event files | No, on a replaced task | Rebuilt in full by the consumer from the topics |
| The report run (`runs/<timestamp>`) | No, on a replaced task | Only the latest run is ever kept, and a new one is written when the service starts, so nothing is lost. `GET /api/reporting/runs/latest` is built live from the event files and does not use it |

### Kafka outage and recovery

- Publishers (Order and Sell, Holdings and Trade, the auth service) log and drop a send that fails after the database commit, and never retry beyond the Kafka client's own timeouts. Orders still complete, delayed by up to the producer's `max.block.ms` (5 seconds). Events published during an outage can be missing from reporting.
- After the broker returns with its data, run [republish_history.py](../db/README.md#reporting-feed-tools) to fill the gap. It is safe to repeat.
- If the broker returns empty, because the volume was lost, republish the history, then replace the Reporting Service container so it starts with an empty disk. The new topics restart their offsets at 0, and a consumer that kept its old files would skip those messages as already written.
- The services reconnect to a returned broker without a restart as long as its advertised name is unchanged. A replacement instance needs the same name or a DNS alias.

### Described AWS layout

One layout this repository is arranged for. None of it is created or tested here.

| Part | Where | Notes |
| --- | --- | --- |
| Client UI and Reporting UI | S3 behind CloudFront | Static files from `dist/<app>/browser`, not containers. Both call relative paths, so CloudFront sends the API paths to an ALB in front of ECS on the same origin and no CORS entry is needed. See [Static UIs on S3](#static-uis-on-s3) |
| Auth, Order and Sell, Holdings and Trade, Reporting Service | ECS | The Dockerfile `HEALTHCHECK` is ignored by ECS: define a task health check (`/health` on 8083 for reporting). Give `AUTH_SERVICE_URL` and the Java services' `EXECUTION_MARKET_URL` a discoverable name, for example ECS Service Connect |
| Reporting Service | ECS, exactly one task | Local ephemeral disk, rebuilt from Kafka on every replacement. A second task would take half the partitions and show half the events |
| Kafka | One EC2 instance | See [Kafka on its own host](#kafka-on-its-own-host) |
| Database | RDS | Set the `SPRING_DATASOURCE_*` and auth `DB_*` variables. Run the migrations ([init-db.sh](docker/init-db.sh)) as a one-off task or a CI step against RDS |

### Static UIs on S3

Neither UI needs a server. `npm run build` produces a static folder, `apps/client-ui/dist/client-ui/browser` and `apps/reporting-ui/dist/reporting-ui/browser`, and that folder is what an S3 bucket serves. The Dockerfiles and `nginx.conf` files in the two apps are not part of that deployment: they exist so the local Compose stack has something to serve the UIs and route their API paths, the job CloudFront does in AWS. Jenkins builds no UI image. The `location` blocks in those files are the reference for the CloudFront behaviours below. Jenkins builds both folders in the Build UI Bundles stage and archives them as `ui-bundles/client-ui-<build>.tar.gz` and `ui-bundles/reporting-ui-<build>.tar.gz`. Nothing uploads them; to deploy one by hand, extract it and run `aws s3 sync <folder> s3://<bucket> --delete`, then invalidate the distribution.

Both UIs make every call on their own origin (`/api/...` and `/auth/...`), so serve each UI from one CloudFront distribution with a private bucket (origin access control) as the default origin and an ALB in front of ECS as the API origin, with these behaviours:

| UI | Path pattern | Origin |
| --- | --- | --- |
| Client UI | `/api/orders*`, `/api/instruments*` | ALB, to Order and Sell |
| Client UI | `/api/*` (including `/api/me/watchlist*` and `/api/market/*`) | ALB, to Holdings and Trade |
| Client UI | `/auth/*` | ALB, to the Auth Service |
| Reporting UI | `/api/reporting/*` | ALB, to the Reporting Service |
| Reporting UI | `/auth/*` | ALB, to the Auth Service |
| Both | default (`*`) | the S3 bucket |

- CloudFront cannot tell the two Java services apart, so the ALB routes the Client UI's `/api` paths by the same prefixes to a target group for each service.
- API behaviours: caching disabled, every HTTP method allowed, and the `Authorization` header forwarded. The UIs keep tokens in `localStorage` and send them as a bearer header, so no cookies are involved.
- The Client UI opens two server-sent event streams, `/api/market/stream` and `/api/orders/stream`. Set the API origin's response timeout and the ALB idle timeout above the longest gap between events (the market stream sends a `heartbeat` event for this). A stream that a proxy buffers or closes early shows as a feed that stalls; `proxy_buffering off` and `proxy_read_timeout` in the Client UI's `nginx.conf` prevent that locally.
- Cache headers when uploading: hashed `*.js` and `*.css` files and other assets with `Cache-Control: public, max-age=31536000, immutable`; `index.html` and `index.csr.html` with `no-cache`, so a new deployment is picked up at once.
- Single-page routing belongs in a viewer-request CloudFront Function on the S3 behaviour only. Do not use the distribution's custom error responses for it: they apply to the API behaviours too and would replace an API 404 or 403 with the HTML shell.
  - Reporting UI: a request whose path has no file extension is served `/index.html`.
  - Client UI: `/`, `/login` and `/register` are prerendered (the build prints "Prerendered 3 static routes"), so `/login` and `/register` map to `/login/index.html` and `/register/index.html`. Every other path without a file extension, including `/dashboard` and `/dashboard/markets/<symbol>`, is rendered in the browser and gets `/index.csr.html`. A new prerendered route needs a rule of its own.
- The UIs make no cross-origin request, so no `CORS_ORIGINS` change is needed. Keep it that way: a new backend path needs a CloudFront behaviour as well as entries in `proxy.conf.json` and `nginx.conf`.

None of this is created or tested here.

### Java service images

The two Java service images build from the repository root: both Compose files use `context: ../..` and name each service's Dockerfile by path, because the build compiles [packages/trading-java-common](../packages/trading-java-common/README.md) together with the service. To build one by hand, run `docker build -f apps/<service>/Dockerfile .` from the repository root; building from inside the service folder fails because the shared source is outside it.

## Database backup and restore

The database holds the permanent [trade record](../db/README.md#trade-record), which must survive a failed deployment. Triggers stop rows being changed or removed, but not a dropped table, a dropped database, or a deleted `db_data` volume. A backup is the only recovery from those, and nothing takes one automatically: take one before every deployment, manual migration, or `down -v`.

Both scripts need the PostgreSQL client tools on PATH, at the server's major version or newer, and run from the repository root in Bash (Git Bash on Windows). They read the password from `PGPASSWORD`, then `SPRING_DATASOURCE_PASSWORD`, and connect to `localhost:5432` as `trading_season` unless `PGHOST`, `PGPORT`, `PGUSER`, or `PGDATABASE` say otherwise. The Compose database is reachable that way while the stack is up.

```sh
./scripts/backup-database.sh
./scripts/restore-database.sh backups/trading_season-20261019T120000Z.dump trading_season_restored
```

- `backup-database.sh` writes a compressed, timestamped dump to `backups/`, which git ignores, and fails without leaving a file if the dump cannot be read back. `--exclude-market-data` skips the replay rows, which the market-data scripts can regenerate, and keeps the dump small; `--output-dir` changes the destination.
- `restore-database.sh` restores only into a database that does not exist yet, in one transaction, then prints the trade record row counts and the number of protection triggers (22 once V017 is applied). It never restores over an existing database.
- To recover, restore into a new database, check the counts, then point every service at it (`SPRING_DATASOURCE_URL` for the Java services, `DB_NAME` for the auth service) and restart them. Keep the damaged database until the restored one is confirmed.
- Dumps contain personal data and password hashes. Store them off the database host and never commit them. There is no schedule, rotation, or off-site copy; those remain to be set up for any real deployment.

## Jenkins

The pipeline needs a Linux agent with Docker and Compose, JDK 21 at `/usr/lib/jvm/java-21-amazon-corretto`, a Maven tool named `maven`, and a NodeJS tool named `NodeJS` running 24.8 or later. It requires 5 GiB of free workspace storage.

Stages: toolchain and preflight checks, depth-1 checkout, `npm ci`, parallel test suites (both Java services, auth, reporting, the reporting feed tools in `db/tools`, the stock forecast pipeline in `apps/holdings-and-trade-service/stock-forecast` with its TensorFlow-free `requirements-ci.txt`, frontend, reporting UI, synthetic market data), SonarQube analysis and quality gate, Playwright E2E (the Client UI suite against an API stand-in and the Reporting UI suite against the real Reporting Service with only the Auth Service stubbed, run in parallel in separate containers; neither stops the other and either fails the stage), Build UI Bundles (`npm run build` for both UIs on the agent, archived as `ui-bundles/*.tar.gz` for the [S3 layout](#static-uis-on-s3); no AWS credentials or upload), then a build of the local stack with build-scoped JWT keys and smoke checks: every expected container, including `reporting-service`, is running (the stack has no UI containers); the reporting health endpoint answers, as do the auth service's JWKS document and each Java service's OpenAPI document; the `trade-events` topic exists with three partitions and keeps its messages forever; `platform-records` exists with three partitions and is compacted; and the three consumer groups (`order-status-pusher`, `portfolio-valuation-capture`, `reporting-ingester`) have registered, with their partition assignment printed to the console. A missing group fails the build and prints that service's log. The stage ends by pruning dangling images and trimming the Docker build cache to 2 GiB; it does not prune stopped containers, networks, or volumes. A final "Kafka End-to-End Flow" stage then runs [kafka-end-to-end.py](jenkins/kafka-end-to-end.py) inside the `reporting-service` container: it first checks that the reporting image has no database setting and no PostgreSQL driver; then registers a trader, opens the order stream, places a BUY order and checks that the stream received both status frames, that a portfolio valuation was captured and reached reporting, that both events reached the reporting files and a report run that names the account from published records, that the web service refuses that run to the trader and serves it to the seeded development analyst, that the console shows the seeded development admin the trader, the order, its ledger impact and its audit trail, and that every consumer group ends at lag 0 on both topics. Each step is printed as a `[KAFKA-E2E]` line, together with the matching producer and consumer log lines, and archived as `reports/kafka-end-to-end/evidence.txt`. The [SonarQube](#sonarqube) analysis and quality gate run right after the test suites; a disk cleanup before the end-to-end stage keeps only the compiled Java classes, the JaCoCo XML and the UI lcov files. A failing test stage skips everything after it. Reports are archived per stage, missing JUnit reports fail the build, and each tier enforces its own coverage floor (UI 90, Reporting UI 90, Holdings and Trade 85, Order and Sell 70, auth 70).

Maven runs through [maven-retry.sh](jenkins/maven-retry.sh), which repeats a run up to three times when it failed only because Maven Central refused or dropped a download (for example a 502); any other failure, such as a failing test, stops at once. Without it, one bad download in a parallel test branch aborted every other branch.

Cleanup always removes the build-scoped test containers, volumes, and images, tears down the local stack only if this build started it and failed, trims Docker caches, and deletes the workspace. Playwright images and Maven and npm caches are kept only when at least 6 GiB will remain free.

### SonarQube

The analysis stage runs right after the parallel test suites, before the disk cleanup and the end-to-end stages. It imports the coverage reports and compiled classes the test suites left behind, and the quality gate stage logs the returned SonarQube status before aborting the build when the gate fails, so a failed gate stops the pipeline before the end-to-end tests and the local stack build.

Before scanning, the analysis stage runs `docker start sonarqube` if the container named `sonarqube` is not running, then polls `/api/system/status` for up to 5 minutes until it reports `UP`. The Jenkins agent must reach the Docker daemon of the host that runs that container, and the container must be named `sonarqube`.

| Where | Setting |
| --- | --- |
| Jenkins plugin | SonarQube Scanner |
| Manage Jenkins > Tools | A SonarQube Scanner installation named `SonarScanner` |
| Manage Jenkins > System | A SonarQube server named `SonarQube` with the server URL typed in and a Secret text credential holding the project analysis token. A blank URL field still lets the scan run against the `http://localhost:9000` default, but the quality gate stage then fails with `Expected URL scheme 'http' or 'https'` |
| SonarQube > Administration > Webhooks | A webhook to `<jenkins-url>/sonarqube-webhook/`; without it the quality gate stage waits until it times out |
| SonarQube project | Key and name `DuaLeapa-Project`, as set in [sonar-project.properties](jenkins/sonar-project.properties) |

The analysis reads `apps` and `packages`. A class in [packages/trading-java-common](../packages/trading-java-common/README.md) is compiled and tested in both Java services, so [jacoco-to-sonar-coverage.mjs](jenkins/jacoco-to-sonar-coverage.mjs) merges the two reports for it (covered in either service counts as covered) and writes it once, into the first service's `sonar-coverage.xml`.

[sonar-project.properties](jenkins/sonar-project.properties) lists `sonar.coverage.exclusions` for files that hold no logic a unit test can reach: entry points (`main.ts`, `main.server.ts`, `server.ts`), Angular app configuration and route tables, barrel `index.ts` files, the auth service's database configuration and role constant, test helpers under `src/testing`, Playwright configuration, per-app build scripts, and the market-data setup script. The unit-test builders never load these, so without the exclusion the scanner counts each as 0% covered. Do not add a file with behavior to the list; write a test for it instead.

The Jenkinsfile holds no server URL or token; both come from the `SonarQube` server entry. Language rules come from the quality profiles assigned to the project in SonarQube, not from this repository.

Coverage reaches SonarQube from the reports the test stages write: LCOV for the two UIs and the auth service, Cobertura XML for the reporting service and the market-data scripts, and JaCoCo for the Java services. [jacoco-to-sonar-coverage.mjs](jenkins/jacoco-to-sonar-coverage.mjs) first rewrites each JaCoCo report with full file paths, because both services use the same Java packages and SonarQube's JaCoCo importer would otherwise credit one service's coverage to the other. The reporting tests mount the workspace at its own path inside the container so the source path in `coverage.xml` exists on the agent. The market-data scripts have no unit tests, so their stage runs every script of the two-day integration under coverage.py and merges the results into `reports/market-data/coverage.xml`; the figure is what that integration executes. That report names each file relative to the repository root, which the scanner resolves from the workspace.

To scan from a workstation, run the test suites, then from the repository root:

```sh
node infrastructure/jenkins/jacoco-to-sonar-coverage.mjs apps/holdings-and-trade-service apps/order-and-sell-service
SONAR_HOST_URL=<server-url> SONAR_TOKEN=<token> sonar-scanner -Dproject.settings=infrastructure/jenkins/sonar-project.properties
```

### Disk space failures

Symptoms: `No space left on device` during an image build, or the 5 GiB preflight failing. Check usage, then free space in this order, confirming no build is running:

```sh
df -h /
docker system df
```

1. Wipe the workspace of obsolete branches from the Jenkins job page (Workspace > Wipe Out Current Workspace).
2. `docker image prune -af` removes unused images.
3. `docker builder prune -af` removes build cache.

Never run `docker volume prune` or `docker system prune --volumes` on the agent: unattached volumes may hold Jenkins home, databases, or archives. Rerun through Jenkins so files keep the agent's ownership. If cleanup logs show every build removing all caches, give the agent more storage.

An `Operation not permitted` failure under `apps/reporting-service`, `db/tools` or `apps/holdings-and-trade-service/stock-forecast` means a root-owned file from a pytest container survived; the Checkout stage repairs permissions, but a workspace stuck by an older build must be removed once by hand.

Order execution polls Holdings and Trade as the authoritative replay clock. Set `EXECUTION_MARKET_URL` on Order and Sell to that service origin; both Compose configurations set `http://holdings-and-trade-service:8082` on Order and Sell. Holdings and Trade listens on 8082 and Order and Sell on 8081 in both configurations. Apply database V011 before starting the updated Java services. Quote outages leave open orders reserved and retryable; owners can cancel them.

The Kafka end-to-end stage seeds its empty database with [market-fixture.sql](jenkins/market-fixture.sql): one mapped instrument, a completed PostgreSQL-backed simulation, one candle and sixty constant $100 ticks. It does not require a preloaded market archive. The check verifies a new trader defaults to a 1% execution buffer, saves 2%, submits against the Holdings and Trade authoritative quote, and checks cash from the returned actual fill price. It also submits Limit, Stop and Stop-Limit orders that stay open at that quote, verifies they block account archival, cancels them and checks their reservations are released. Confirmed deletion then hides the empty account while archived account and cancelled order history remain readable, including through reporting.

The Order and Sell test stage uses [with-disposable-postgres.sh](jenkins/with-disposable-postgres.sh) to enable `PostgresOrderConcurrencyTest` alongside the H2 tests. The reporting feed tools stage uses its own fresh database to enable the migration contracts through `EXECUTION_MIGRATION_DISPOSABLE_DATABASE_URL`; its Python container uses host networking to reach the loopback-only dynamically assigned port. It mounts `db/tools` at `/app` and `db/migrations` read-only at `/migrations`, where the migration tests resolve their SQL files. Each invocation removes its container and data volume on exit. These tests never use the local stack database. Javadoc generation in both Maven projects fails on warnings as well as errors.
