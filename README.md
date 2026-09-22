# Trading Season

Trading simulation monorepo containing:

* **Angular** frontend
* **Spring Boot** business backend
* **NestJS** authentication service
* Placeholder reporting applications

The Java application follows a Spring Boot source layout rooted at:

`apps/business-backend/src/main/java/app`

The bootstrap class is `app.Main`.

---

## Requirements

| Dependency     |            Version | Purpose                            |
| -------------- | -----------------: | ---------------------------------- |
| Node.js        |           `24.8.0` | Angular, NestJS, and build tooling |
| npm            |          `11.16.0` | Node package manager               |
| Angular        |          `21.2.22` | Frontend framework                 |
| Angular CDK    |          `21.2.14` | Angular component utilities        |
| TypeScript     |   `>=5.9.0 <6.0.0` | Angular compilation                |
| JDK            |               `21` | Spring Boot runtime                |
| Maven          |             `3.9+` | Java build system                  |
| Spring Boot    |            `4.1.1` | Business backend                   |
| NestJS         |          `12.0.1+` | Authentication service             |
| Python         | `3.12` recommended | Market-data scripts                |
| PostgreSQL     |   `16` recommended | Application databases              |
| Docker Compose |              `v2+` | Local database orchestration       |

### Version Notes

* Node.js is standardized on **`24.8.0`**.
* Angular is standardized on **`21.2.22`**.
* Angular framework and CLI packages should remain on **`21.2.22`**.
* Angular CDK is pinned separately to **`21.2.14`**.
* TypeScript must remain within **`>=5.9.0 <6.0.0`**.

### Verify Toolchain

| Tool    | Command                  | Expected  |
| ------- | ------------------------ | --------- |
| Node.js | `node --version`         | `v24.8.0` |
| npm     | `npm --version`          | `11.16.0` |
| Java    | `java -version`          | JDK `21`  |
| Maven   | `mvn --version`          | `3.9+`    |
| Python  | `python --version`       | `3.10+`   |
| Docker  | `docker --version`       | Installed |
| Compose | `docker compose version` | `v2+`     |

---

# Linux Setup

Install:

* Git
* Bash
* Node.js `24.8.0`
* npm `11.16.0`
* JDK `21`
* Maven `3.9+`
* PostgreSQL client tools

Docker is only required when using Docker database mode.

---

## Start Setup

| Action                | Command                                           |
| --------------------- | ------------------------------------------------- |
| Automatic setup       | `./scripts/setup-local.sh`                        |
| Use local PostgreSQL  | `./scripts/setup-local.sh --database-mode local`  |
| Use Docker PostgreSQL | `./scripts/setup-local.sh --database-mode docker` |

### Existing Market Data

| Action                    | Command                                                                            |
| ------------------------- | ---------------------------------------------------------------------------------- |
| Load existing market data | `./scripts/setup-local.sh --parquet-source /path/to/synthetic-market-data-2026-v1` |

Setup status:

| Status    | Meaning                     |
| --------- | --------------------------- |
| `[READY]` | Valid stage was skipped     |
| `[DONE]`  | Stage completed             |
| `[FAIL]`  | Setup stopped with an error |

Press `Ctrl+C` to stop running applications.

PostgreSQL data and Docker database containers are preserved.

---

# Linux Toolchain Troubleshooting

## Install NVM

| Action       | Command                                                                            |
| ------------ | ---------------------------------------------------------------------------------- |
| Install NVM  | `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh \| bash` |
| Reload shell | `source ~/.bashrc`                                                                 |
| Verify NVM   | `nvm --version`                                                                    |

---

## Install Node.js 24.8.0

| Action                    | Command                    |
| ------------------------- | -------------------------- |
| Install                   | `nvm install 24.8.0`       |
| Activate                  | `nvm use 24.8.0`           |
| Set default               | `nvm alias default 24.8.0` |
| Verify Node               | `node --version`           |
| Verify active NVM version | `nvm current`              |

---

## Install npm 11.16.0

| Action      | Command                      |
| ----------- | ---------------------------- |
| Install npm | `npm install -g npm@11.16.0` |
| Verify      | `npm --version`              |

---

## Install Maven 3.9.11

Run:

```sh
cd /tmp

curl -fLO https://archive.apache.org/dist/maven/maven-3/3.9.11/binaries/apache-maven-3.9.11-bin.tar.gz

sudo tar -xzf apache-maven-3.9.11-bin.tar.gz -C /opt

sudo ln -sfn /opt/apache-maven-3.9.11 /opt/maven

echo 'export M2_HOME=/opt/maven' >> ~/.bashrc
echo 'export PATH=$M2_HOME/bin:$PATH' >> ~/.bashrc

source ~/.bashrc

mvn -version
```

Return to the repository:

| Action                       | Command                    |
| ---------------------------- | -------------------------- |
| Return to previous directory | `cd -`                     |
| Run setup again              | `./scripts/setup-local.sh` |

---

# Windows Setup

Install:

* Node.js `24.8.0`
* npm `11.16.0`
* JDK `21`
* Maven `3.9+`
* PostgreSQL

---

## Start All Services

Set the Spring database password:

| Action                | Command                                        |
| --------------------- | ---------------------------------------------- |
| Set database password | `$env:SPRING_DATASOURCE_PASSWORD = 'password'` |

Start the project:

| Action             | Command                     |
| ------------------ | --------------------------- |
| Start all services | `.\scripts\start-local.ps1` |

The startup script validates:

* Database connectivity
* Authentication configuration
* Environment variables
* Required services

Press `Ctrl+C` to stop all services.

---

## Local Services

| Service      | URL                     |
| ------------ | ----------------------- |
| Angular UI   | `http://localhost:4200` |
| Auth Service | `http://localhost:3001` |
| Java Backend | `http://localhost:8081` |

---

# First-Time Setup

## 1. Install Dependencies

| Workspace      | Command                             |
| -------------- | ----------------------------------- |
| Root workspace | `npm ci`                            |
| Auth service   | `npm --prefix apps/auth-service ci` |

---

## 2. Configure Authentication

Copy the environment file:

| Action        | Command                                                           |
| ------------- | ----------------------------------------------------------------- |
| Create `.env` | `Copy-Item apps/auth-service/.env.example apps/auth-service/.env` |

Remove the placeholder JWT values:

```powershell
(Get-Content apps/auth-service/.env) |
  Where-Object { $_ -notmatch '^JWT_(PRIVATE_KEY|PUBLIC_KEY|ISSUER)=' } |
  Set-Content apps/auth-service/.env
```

Generate development JWT keys:

```powershell
cd apps/auth-service

node scripts/generate-dev-keys.mjs | Add-Content .env

cd ../..
```

---

## 3. Configure PostgreSQL

Complete the business database and authentication database setup below.

---

# Manual PostgreSQL Setup

## Business Database

Connect to the default PostgreSQL database using an administrator account.

### Create Role

```sql
CREATE ROLE trading_season
WITH LOGIN PASSWORD 'password';
```

### Create Database

```sql
CREATE DATABASE trading_season
OWNER trading_season;
```

### Run Business Migrations

Run the migrations in order:

```powershell
psql -h localhost -p 5432 -U trading_season -d trading_season -W -v ON_ERROR_STOP=1 -f apps/business-backend/db/migrations/V001__Initial_schema.sql

psql -h localhost -p 5432 -U trading_season -d trading_season -W -v ON_ERROR_STOP=1 -f apps/business-backend/db/migrations/V002__Synthetic_market_data_replay_metadata.sql

psql -h localhost -p 5432 -U trading_season -d trading_season -W -v ON_ERROR_STOP=1 -f apps/business-backend/db/migrations/V003__Token_authentication.sql
```

---

## Authentication Database

### Create Role

```sql
CREATE ROLE authuser
WITH LOGIN PASSWORD 'password';
```

### Create Database

```sql
CREATE DATABASE auth_db
OWNER authuser;
```

### Grant Schema Access

Connect to `auth_db` as `authuser`:

```sql
GRANT ALL PRIVILEGES
ON SCHEMA public
TO authuser;
```

---

# Configure Auth Service

Copy the environment file:

| Action        | Command                                                           |
| ------------- | ----------------------------------------------------------------- |
| Create `.env` | `Copy-Item apps/auth-service/.env.example apps/auth-service/.env` |

Set:

```text
DB_PORT=5432
DB_PASSWORD=password
```

Remove the placeholder JWT values:

```powershell
(Get-Content apps/auth-service/.env) |
  Where-Object { $_ -notmatch '^JWT_(PRIVATE_KEY|PUBLIC_KEY|ISSUER)=' } |
  Set-Content apps/auth-service/.env
```

Generate JWT keys:

```powershell
cd apps/auth-service

node scripts/generate-dev-keys.mjs | Add-Content .env

cd ../..
```

---

# Start Applications Manually

## Angular UI

| Action               | Command                                   |
| -------------------- | ----------------------------------------- |
| Install dependencies | `npm ci`                                  |
| Start frontend       | `npm --workspace business-logic-ui start` |

---

## Java Backend

| Action        | Command                    |
| ------------- | -------------------------- |
| Open backend  | `cd apps/business-backend` |
| Start backend | `mvn spring-boot:run`      |

---

## Authentication Service

| Action            | Command                |
| ----------------- | ---------------------- |
| Open auth service | `cd apps/auth-service` |
| Start service     | `npm run start:dev`    |

Database migrations run when the authentication service starts.

---

# Verify Authentication Database

Connect to `auth_db` and run:

```sql
SELECT
    id,
    email,
    role,
    is_active,
    failed_attempts,
    locked_until,
    created_at
FROM users
ORDER BY created_at DESC;
```

---

# Service Map

| Area                                                 | Responsibility                                          |   Port |
| ---------------------------------------------------- | ------------------------------------------------------- | -----: |
| [Business UI](apps/business-logic-ui/README.md)      | Login, registration, dashboard, simulated stock tickers | `4200` |
| [Business Backend](apps/business-backend/README.md)  | Registration, sessions, and simulated stock data        | `8081` |
| [Auth Service](apps/auth-service/README.md)          | RS256 JWTs, refresh tokens, authentication DB           | `3001` |
| [Shared UI](packages/shared-ui-components/README.md) | Reusable Angular components                             |      — |
| [Reporting](docs/reference/reporting.md)             | Future analytics UI and service                         |      — |
| [Infrastructure](infrastructure/README.md)           | Docker Compose and Jenkins configuration                |      — |

---

# Documentation

| Document                                       | Description                                        |
| ---------------------------------------------- | -------------------------------------------------- |
| [Documentation Index](docs/README.md)          | Full documentation index                           |
| [Development](docs/guides/development.md)      | Setup, commands, tests, and development workflow   |
| [Architecture](docs/reference/architecture.md) | Application boundaries and source navigation       |
| [API Reference](docs/reference/api.md)         | Implemented HTTP contracts                         |
| [Database](docs/reference/database.md)         | Schema ownership, migrations, and ERD              |
| [Operations](docs/guides/operations.md)        | CI, deployment, configuration, and troubleshooting |
| [Agent Instructions](AGENTS.md)                | Repository rules and completion checks             |
| [Javadocs](docs/JAVA_DOCS/index.html)          | Generated Java API documentation                   |

---

# Business Database ERD

The following diagram represents the business SQL schema after:

* `V001`
* `V002`
* `V003`

The SQL migration files remain the source of truth for exact columns and constraints.

`instruments.simulated_stock_symbol` optionally links an instrument to a simulated stock.

Market data belongs to both a simulation session and a stock.

```mermaid
erDiagram

    users ||--o{ accounts : owns

    stocks o|--o| instruments : "optionally powers"

    simulation_sessions ||--o{ market_states : contains
    simulation_sessions ||--o{ market_behaviors : contains
    simulation_sessions ||--o{ quotes : contains
    simulation_sessions ||--o{ market_ticks : contains
    simulation_sessions ||--o{ candles : contains

    stocks ||--o{ market_states : describes
    stocks ||--o{ market_behaviors : receives
    stocks ||--o{ quotes : quoted_as
    stocks ||--o{ market_ticks : traded_as
    stocks ||--o{ candles : aggregated_as

    accounts ||--o{ holdings : has
    instruments ||--o{ holdings : held_as

    accounts ||--o{ orders : submits
    instruments ||--o{ orders : targets

    orders ||--o| fills : executes_as
    orders ||--o{ audit_trail : records

    accounts ||--o{ cash_transactions : posts
    fills o|--o| cash_transactions : creates

    accounts ||--o{ holding_movements : posts
    instruments ||--o{ holding_movements : changes
    fills ||--o| holding_movements : creates

    users {
        UUID user_id PK
        TEXT email UK
        TEXT user_role
        TEXT account_status
    }

    simulation_sessions {
        BIGINT id PK
        INTEGER seed
        DOUBLE drift
        JSONB config
        INTEGER config_version
        TEXT status
        TEXT failure_code
        TEXT failure_detail
        TIMESTAMPTZ started_at
        TIMESTAMPTZ ended_at
    }

    stocks {
        VARCHAR symbol PK
        TEXT company_name
        NUMERIC starting_price
        BIGINT average_volume
        NUMERIC base_volatility
    }

    instruments {
        INTEGER instrument_id PK
        TEXT ticker UK
        TEXT asset_class
        TEXT market
        VARCHAR simulated_stock_symbol FK
    }

    accounts {
        INTEGER account_id PK
        UUID user_id FK
        NUMERIC cash_balance
        TEXT currency
    }

    market_states {
        BIGINT id PK
        BIGINT session_id FK
        VARCHAR symbol FK
        TEXT trend
        NUMERIC volatility
        NUMERIC liquidity
        NUMERIC momentum
    }

    market_behaviors {
        BIGINT id PK
        BIGINT session_id FK
        VARCHAR symbol FK
        TEXT behavior_type
        TIMESTAMPTZ start_time
        NUMERIC duration_seconds
        NUMERIC strength
    }

    quotes {
        BIGINT id PK
        BIGINT session_id FK
        VARCHAR symbol FK
        TIMESTAMPTZ timestamp
        NUMERIC bid
        NUMERIC ask
    }

    market_ticks {
        BIGINT id PK
        BIGINT session_id FK
        VARCHAR symbol FK
        TIMESTAMPTZ timestamp
        NUMERIC price
        BIGINT sequence_number
    }

    candles {
        BIGINT id PK
        BIGINT session_id FK
        VARCHAR symbol FK
        TEXT interval
        TIMESTAMPTZ timestamp
        NUMERIC open
        NUMERIC high
        NUMERIC low
        NUMERIC close
        BIGINT volume
    }

    holdings {
        INTEGER holding_id PK
        INTEGER account_id FK
        INTEGER instrument_id FK
        NUMERIC quantity
    }

    orders {
        INTEGER order_id PK
        INTEGER account_id FK
        INTEGER instrument_id FK
        UUID client_reference UK
        TEXT order_type
        TEXT status
        NUMERIC quantity
    }

    fills {
        INTEGER fill_id PK
        INTEGER order_id FK
        NUMERIC quote_price
        NUMERIC quantity
    }

    cash_transactions {
        INTEGER cash_transaction_id PK
        INTEGER account_id FK
        INTEGER fill_id FK
        NUMERIC amount
        TEXT reason
    }

    holding_movements {
        INTEGER holding_movement_id PK
        INTEGER account_id FK
        INTEGER instrument_id FK
        INTEGER fill_id FK
        NUMERIC quantity_delta
    }

    audit_trail {
        INTEGER audit_id PK
        INTEGER order_id FK
        TEXT event_type
        TIMESTAMPTZ recorded_at
    }
```