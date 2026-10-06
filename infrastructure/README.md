# Infrastructure

Container and CI configuration. None of it is a production deployment.

| Resource | Purpose |
| --- | --- |
| [docker-compose.local.yml](docker-compose/docker-compose.local.yml) | Full local stack: UI, services, database, Kafka, reporting |
| [docker-compose.jenkins.yml](docker-compose/docker-compose.jenkins.yml) | Optional Jenkins container (UI on host port 8888) |
| [Jenkinsfile](jenkins/Jenkinsfile) | CI pipeline |
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
| PostgreSQL | 5432 |
| Kafka | 29092 (`kafka:9092` in the network) |

- `DB_PASSWORD` sets the one database password every service uses. Defaults are for disposable development only.
- `db-init` migrates the database before dependent services start; a failed migration stops it. Data persists in the `db_data` volume; `down -v` deletes it.
- A one-shot `kafka-init` creates the `trade-events` topic with three partitions. Auto-creation is disabled. No service produces or consumes yet.
- Opt-in profiles: `initialize` (first-time empty database) and `seed` (market data steps 0002 to 0004; see [apps/market-data](../apps/market-data/README.md)).
- For Linux VMs, `scripts/setup-local.sh` at the repository root reuses a local PostgreSQL or starts the database from this Compose file.

## Jenkins

The pipeline needs a Linux agent with Docker and Compose, JDK 21 at `/usr/lib/jvm/java-21-amazon-corretto`, a Maven tool named `Maven`, and a NodeJS tool named `NodeJS` running 24.8 or later. It requires 5 GiB of free workspace storage.

Stages: toolchain and preflight checks, depth-1 checkout, `npm ci`, parallel test suites (both Java services, auth, reporting, frontend, synthetic market data), Javadocs, Playwright E2E, then a build of the local stack with build-scoped JWT keys and smoke checks. A failing test stage skips everything after it. Reports are archived per stage, missing JUnit reports fail the build, and each tier enforces its own coverage floor (UI 90, Holdings and Trade 85, Order and Sell 70, auth 70).

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
