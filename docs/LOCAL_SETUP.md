# Local setup (Windows)

This workflow runs PostgreSQL locally and starts the application processes on
the host. Docker Compose is not required.

## Requirements

- Node.js 24.8.x, npm 11.16.x
- JDK 21, Maven 3.9+
- Python 3.14
- PostgreSQL 16 with `psql` and `pg_isready` on `PATH`
- Apache Kafka 4.1.1, unpacked locally, if reporting is needed

Run these commands from the repository root. Change `$password` and
`$kafkaHome` if your installation uses different values:

```powershell
$password = 'password'
$databaseUrl = "postgresql://trading_season:$password@localhost:5432/trading_season"
$kafkaHome = 'C:\tools\kafka_2.13-4.1.1'
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

Create the auth configuration once:

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

## 2. Create and prepare PostgreSQL

Run this once in PowerShell. It connects to `postgres` only to create the
application role and database:

```powershell
@"
DO `$`$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'trading_season') THEN
        CREATE ROLE trading_season LOGIN PASSWORD '$password';
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

Apply all migrations:

```powershell
.\scripts\apply-migrations.ps1 -DatabaseUrl $databaseUrl
```

If `$databaseUrl` is empty, initialize it again:

```powershell
$databaseUrl = 'postgresql://trading_season:password@localhost:5432/trading_season'
.\scripts\apply-migrations.ps1 -DatabaseUrl $databaseUrl
```

After migrations complete, verify the migration table and sequence access:

```powershell
psql $databaseUrl -c "SELECT current_database(), current_user, has_table_privilege(current_user, 'public.schema_migrations', 'SELECT') AS can_read_migrations, has_sequence_privilege(current_user, 'public.accounts_account_id_seq', 'USAGE') AS can_use_sequences;"
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
overwrite an existing demo identity.

## 4. Start the services

Start Kafka and create its topics through the launcher, then start all
services:

```powershell
$env:SPRING_DATASOURCE_PASSWORD = 'password'
.\scripts\start-local.ps1 -KafkaHome $kafkaHome
```

The launcher prints the endpoint list when ready:

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

If reporting is not needed, omit `-KafkaHome` and add `-SkipReporting`.
Press `Ctrl+C` to stop the host services.

## Reporting history

After SQL data is added, publish it to Kafka so the Reporting UI can see it:

```powershell
python -m venv db/tools/.venv
db/tools/.venv/Scripts/python -m pip install -r db/tools/requirements.txt
db/tools/.venv/Scripts/python db/tools/republish_history.py `
    --database-url postgresql://trading_season:password@localhost:5432/trading_season `
    --bootstrap-servers 127.0.0.1:29092
```

If you use a different PostgreSQL password, replace `password` in the
database URL. Kafka must be running on `127.0.0.1:29092`.

For the containerized workflow, see
[infrastructure/README.md](../infrastructure/README.md).

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
