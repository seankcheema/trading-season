# Local setup (Windows)

This workflow runs PostgreSQL locally and starts the application processes on
the host. Docker Compose is not required.

## Requirements

- Node.js 24.8.x, npm 11.16.x
- JDK 21, Maven 3.9+
- Python 3.14 with the Windows `py` launcher
- PostgreSQL 16 running locally, with `psql` and `pg_isready` on `PATH`
- Apache Kafka 4.1.2, unpacked locally, if reporting is needed

Run these commands from the repository root. Change `$password` and
`$kafkaHome` if your installation uses different values:

```powershell
$password = 'password'
$databaseUrl = "postgresql://trading_season:$([uri]::EscapeDataString($password))@localhost:5432/trading_season"
$kafkaHome = 'C:\tools\kafka_2.13-4.1.2'
```

Keep this PowerShell window open so these variables remain available. If you
opened a new window, run the block again or replace `$databaseUrl` below with
`postgresql://trading_season:password@localhost:5432/trading_season`.

## 1. Install dependencies

```powershell
npm --prefix apps/client-ui ci
npm --prefix apps/reporting-ui ci
npm --prefix apps/auth-service ci
python -m venv apps/reporting-service/venv
apps/reporting-service/venv/Scripts/python -m pip install -r apps/reporting-service/requirements.txt
```

Create the auth configuration once. If `.env` already exists, check that its JWT values are real generated keys rather than placeholders:

```powershell
if (-not (Test-Path apps/auth-service/.env)) {
    Copy-Item apps/auth-service/.env.example apps/auth-service/.env
    (Get-Content apps/auth-service/.env) |
        Where-Object { $_ -notmatch '^JWT_(PRIVATE_KEY|PUBLIC_KEY|ISSUER)=' } |
        Set-Content apps/auth-service/.env
    node apps/auth-service/scripts/generate-dev-keys.mjs |
        Add-Content apps/auth-service/.env
}
```

Set the auth database password to match the value above (also run this after changing it):

```powershell
(Get-Content apps/auth-service/.env) |
    ForEach-Object { if ($_ -match '^DB_PASSWORD=') { 'DB_PASSWORD="{0}"' -f $password } else { $_ } } |
    Set-Content apps/auth-service/.env
```

## 2. Create and prepare PostgreSQL

Run this once in PowerShell, using the PostgreSQL administrator password when prompted. It connects to `postgres` only to create the
application role and database:

```powershell
$sqlPassword = $password.Replace("'", "''")
@"
DO `$`$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'trading_season') THEN
        CREATE ROLE trading_season LOGIN PASSWORD '$sqlPassword';
    END IF;
END
`$`$;
SELECT 'CREATE DATABASE trading_season OWNER trading_season'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'trading_season')\gexec
"@ | psql -h localhost -p 5432 -U postgres -d postgres -v ON_ERROR_STOP=1
```

Apply permissions while connected to `trading_season`, not `postgres`:

```powershell
@"
GRANT CONNECT ON DATABASE trading_season TO trading_season;
GRANT USAGE, CREATE ON SCHEMA public TO trading_season;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO trading_season;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO trading_season;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO trading_season;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO trading_season;
"@ | psql -h localhost -p 5432 -U trading_season -d trading_season -v ON_ERROR_STOP=1
```

Check the connection and permissions:

```powershell
pg_isready -h localhost -p 5432
psql $databaseUrl -c "SELECT current_database(), current_user, has_database_privilege(current_user, current_database(), 'CONNECT') AS can_connect, has_schema_privilege(current_user, 'public', 'USAGE') AS can_use_schema, has_schema_privilege(current_user, 'public', 'CREATE') AS can_create_in_schema;"
```

The query should show `trading_season`, `trading_season`, and `t` for each
privilege column.

## 3. Migrate and seed the database

For a new local database, apply the checked-in migrations in filename order as the application role. Stop if any migration fails:

```powershell
Get-ChildItem db/migrations/V*.sql | Sort-Object Name | ForEach-Object {
    psql $databaseUrl -X -v ON_ERROR_STOP=1 -f $_.FullName
    if ($LASTEXITCODE -ne 0) { throw "Migration failed: $($_.Name)" }
}
```

Use this block once for a fresh database. For an existing database, apply only outstanding files as described in the [database guide](../../db/README.md); do not rerun V001 against an initialized schema. The Compose migration ledger is not created by these commands.

Verify table and sequence access:

```powershell
psql $databaseUrl -c "SELECT current_database(), current_user, has_table_privilege(current_user, 'public.user_accounts', 'SELECT') AS can_read_accounts, has_sequence_privilege(current_user, 'public.accounts_account_id_seq', 'USAGE') AS can_use_sequences;"
```

Generate and import the market data, then load the dummy account:

```powershell
apps/market-data/db/scripts/powershell/setup-market-data.ps1 `
    -DatabaseUrl $databaseUrl `
    -AvailableDiskGb ([math]::Floor((Get-PSDrive C).Free / 1GB))

Get-Content -Raw apps/market-data/db/seeds/demo-trader.sql |
    psql $databaseUrl -v ON_ERROR_STOP=1
```

The dummy login is `johndoe@gmail.com`. The seed is additive and refuses to
overwrite an existing demo identity. See the [market data guide](../../apps/market-data/README.md) for archive size and import options. Use the free space of the drive holding PostgreSQL data for `-AvailableDiskGb` if it is not C:.

## 4. Start the services

The Kafka path must contain a `libs` directory. Check it before starting:

```powershell
Test-Path (Join-Path $kafkaHome 'libs') # Must print True
```

The launcher uses IPv4 for the local Kafka JVM and broker connections.

Start Kafka and create its topics through the launcher, then start all
services:

```powershell
$env:SPRING_DATASOURCE_PASSWORD = $password
.\scripts\start-local.ps1 -KafkaHome $kafkaHome
```

The launcher starts the processes and streams their logs in this terminal. Wait for the service startup messages before opening the UIs:

| Service | Port |
| --- | ---: |
| Client UI | 4200 |
| Reporting UI | 4300 |
| Auth Service | 3001 |
| Order and Sell Service | 8081 |
| Holdings and Trade Service | 8082 |
| Reporting Service | 8083 |
| PostgreSQL | 5432 |
| Kafka | 29092 |

If reporting is not needed, omit `-KafkaHome` and add `-SkipReporting`. The Reporting UI still starts, but its API is unavailable. If no broker is listening and `KAFKA_HOME` is unset, the launcher disables event publishing.
Press `Ctrl+C` to stop the host services.

## Kafka and reporting options

Reporting reads Kafka and nothing else, so everything the Reporting UI shows needs a Kafka broker on `localhost:29092`. The script handles the three cases:

| Broker | What the script does |
| --- | --- |
| Already listening on `localhost:29092`, for example the `kafka` service of the Compose file | Uses it |
| Not running, and `-KafkaHome` or `KAFKA_HOME` names an unpacked [Apache Kafka](https://kafka.apache.org/downloads) distribution | Starts a single-node broker from it with the JDK, keeps its data in `%LOCALAPPDATA%\trading-season\kafka`, and creates `trade-events` and the compacted `platform-records`, each with three partitions. For a machine without Docker. The broker runs with the log cleaner off (`log.cleaner.enable=false`), because Windows cannot rename the index files compaction swaps and Kafka would shut the broker down; `platform-records` is therefore not compacted here, which only costs disk |
| Neither | Sets `app.events.enabled=false` on both Java services and `EVENTS_ENABLED=false` on the auth service, does not start the consumer, and warns that the Reporting UI shows nothing new |

```powershell
.\scripts\start-local.ps1 -KafkaHome C:\tools\kafka_2.13-4.1.2
```

Only what the services do while a broker is running is published. The consumer writes a report when it starts and then every minute (`-ReportIntervalMinutes`; the Compose stack uses 15), so an order placed in the Client UI appears on the Reporting UI's console within seconds and in its report runs within that time. `-SkipReporting` starts the stack without the Reporting Service and its consumer, for a machine without Python. See [Reporting Service](../../apps/reporting-service/README.md).

## Reporting history

Keep the launcher running. In a second PowerShell terminal at the repository root, run the password and database URL variable block from Requirements again, then publish SQL data to Kafka so the Reporting UI can see it:

```powershell
python -m venv db/tools/.venv
db/tools/.venv/Scripts/python -m pip install -r db/tools/requirements.txt
db/tools/.venv/Scripts/python db/tools/republish_history.py `
    --database-url $databaseUrl `
    --bootstrap-servers 127.0.0.1:29092
```

Use the same password as the application database role. Kafka must be running on `127.0.0.1:29092`.

For the containerized workflow, see
[infrastructure/README.md](../../infrastructure/README.md).

## Development accounts

These accounts are seeded for local development only:

| Account | Email | Password | Role | Use |
| --- | --- | --- | --- | --- |
| Dummy client | `johndoe@gmail.com` | `#Password12345` | `TRADER` | Client UI at http://localhost:4200 |
| Default trader | `admin@example.com` | `admin123` | `TRADER` | Client UI at http://localhost:4200 |
| Analyst | `analyst@example.com` | `analyst123` | `ANALYST` | Reporting UI report runs at http://localhost:4300 |
| Reporting admin | `reporting-admin@example.com` | `admin123` | `ADMIN` | Reporting UI, every screen |

The analyst account cannot access the admin-only activity, customers, or
orders screens. Production does not seed these accounts.
