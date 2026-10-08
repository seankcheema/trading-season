# Infrastructure

Container and CI configuration. None of it is a production deployment.

| Resource | Purpose |
| --- | --- |
| [docker-compose.local.yml](docker-compose/docker-compose.local.yml) | Full local stack: UI, services, database, Kafka, the reporting service and its consumer |
| [docker-compose.jenkins.yml](docker-compose/docker-compose.jenkins.yml) | Optional Jenkins container (UI on host port 8888) |
| [Jenkinsfile](jenkins/Jenkinsfile) | CI pipeline |
| [jenkins/kafka-end-to-end.py](jenkins/kafka-end-to-end.py) | Order-to-consumers check the pipeline runs against the built stack |
| [docker/init-db.sh](docker/init-db.sh) | `db-init`: applies every `db/migrations/V*.sql` once, recorded in `public.schema_migrations` |
| [docker/Dockerfile.market-data](docker/Dockerfile.market-data) | Image for the market-data scripts and the Jenkins integration stage |
| [docker/Dockerfile.playwright](docker/Dockerfile.playwright) | Slim Chromium-only image for the Playwright E2E stage |
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
| Reporting Service | 8083 |
| Reporting consumer | none (`reporting-consumer`, same image as the Reporting Service, runs `python consumer.py`) |
| PostgreSQL | 5432 |
| Kafka | 29092 (`kafka:9092` in the network) |

- `DB_PASSWORD` sets the one database password every service uses. Defaults are for disposable development only.
- `db-init` migrates the database before dependent services start; a failed migration stops it. Data persists in the `db_data` volume; `down -v` deletes it.
- A one-shot `kafka-init` creates the `trade-events` topic with three partitions; auto-creation is disabled. The Order and Sell Service publishes to it, and three consumer groups read it: `order-status-pusher` (Order and Sell), `portfolio-valuation-capture` (Holdings and Trade) and `reporting-ingester` (`reporting-consumer`). Both Java services and the consumer start only after `kafka-init` completes and receive `KAFKA_BOOTSTRAP_SERVERS=kafka:9092`.
- The `reporting-consumer` and `reporting-service` containers share the `reporting_files` volume at `/data/reporting`: the consumer appends trade events and writes report runs, the web service reads them. `down -v` deletes it; the files can be rebuilt by resetting the `reporting-ingester` group's offset (see [apps/reporting-service](../apps/reporting-service/README.md)).
- `reporting-ui` serves the Angular app through Nginx and proxies `/api/reporting` to `reporting-service` and `/auth` to `auth-service`, so it starts after both and needs no CORS entry on either.
- To inspect the topic: `docker compose --project-name trading-season-local -f infrastructure/docker-compose/docker-compose.local.yml exec kafka /opt/kafka/bin/kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --all-groups` shows each group's lag.
- Opt-in profiles: `initialize` (first-time empty database) and `seed` (market data steps 0002 to 0004; see [apps/market-data](../apps/market-data/README.md)).
- For Linux VMs, `scripts/setup-local.sh` at the repository root reuses a local PostgreSQL or starts the database from this Compose file.

## Jenkins

The pipeline needs a Linux agent with Docker and Compose, JDK 21 at `/usr/lib/jvm/java-21-amazon-corretto`, a Maven tool named `Maven`, and a NodeJS tool named `NodeJS` running 24.8 or later. It requires 5 GiB of free workspace storage.

Stages: toolchain and preflight checks, depth-1 checkout, `npm ci`, parallel test suites (both Java services, auth, reporting, frontend, reporting UI, synthetic market data), Javadocs, Playwright E2E, then a build of the local stack with build-scoped JWT keys and smoke checks: every expected container, including `reporting-consumer`, is running; the UIs and the reporting health endpoint answer; the `trade-events` topic exists with three partitions; and the three consumer groups (`order-status-pusher`, `portfolio-valuation-capture`, `reporting-ingester`) have registered on it, with their partition assignment printed to the console. A missing group fails the build and prints that service's log. A final "Kafka End-to-End Flow" stage then runs [kafka-end-to-end.py](jenkins/kafka-end-to-end.py) inside the `reporting-consumer` container: it registers a trader, opens the order stream, places a BUY order and checks that the stream received both status frames, that a portfolio valuation was captured, that both events reached the reporting files and a report run, that the web service refuses that run to the trader and serves it to the seeded development analyst, and that every consumer group ends at lag 0. Each step is printed as a `[KAFKA-E2E]` line, together with the matching producer and consumer log lines, and archived as `reports/kafka-end-to-end/evidence.txt`. A failing test stage skips everything after it. Reports are archived per stage, missing JUnit reports fail the build, and each tier enforces its own coverage floor (UI 90, Reporting UI 90, Holdings and Trade 85, Order and Sell 70, auth 70).

Cleanup always removes the build-scoped test containers, volumes, and images, tears down the local stack only if this build started it and failed, trims Docker caches, and deletes the workspace. Playwright images and Maven and npm caches are kept only when at least 6 GiB will remain free.

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

An `Operation not permitted` failure under `apps/reporting-service` means a root-owned file from the pytest container survived; the Checkout stage repairs permissions, but a workspace stuck by an older build must be removed once by hand.
