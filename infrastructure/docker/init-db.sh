#!/bin/sh
# Apply the checked-in migrations to the business database, each exactly once.

set -eu

DATABASE_URL="${1:-postgresql://trading_season:changeme@db:5432/trading_season}"
REPO_ROOT="${2:-/workspace}"
MIGRATIONS_DIR="$REPO_ROOT/db/migrations"

echo "[DB-INIT] Waiting for database to be ready..."
attempt=1
until pg_isready -q -d "$DATABASE_URL"; do
  # Fail visibly instead of letting every dependent service wait forever.
  if [ "$attempt" -ge 60 ]; then
    echo "[DB-INIT] Database did not become ready within 60 seconds" >&2
    exit 1
  fi
  attempt=$((attempt + 1))
  sleep 1
done

if [ ! -d "$MIGRATIONS_DIR" ]; then
  echo "[DB-INIT] Migrations directory not found: $MIGRATIONS_DIR" >&2
  exit 1
fi

run_sql() {
  psql "$DATABASE_URL" -X -q -tA -v ON_ERROR_STOP=1 "$@"
}

# The ledger is created only after a migration has run. V001 takes its
# fresh-database path only while public holds no relations, so the table
# cannot exist beforehand.
record_applied() {
  run_sql \
    -c "CREATE TABLE IF NOT EXISTS public.schema_migrations (filename text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())" \
    -c "INSERT INTO public.schema_migrations (filename) VALUES ('$1') ON CONFLICT DO NOTHING"
}

# A database retained from before the ledger existed has no record of what ran.
# V001 refuses to run twice, so treat it as applied when its auth table is
# there; V002 and later are written to be re-runnable.
has_ledger="$(run_sql -c "SELECT to_regclass('public.schema_migrations') IS NOT NULL")"
has_auth_table="$(run_sql -c "SELECT to_regclass('public.user_accounts') IS NOT NULL")"
if [ "$has_ledger" = "f" ] && [ "$has_auth_table" = "t" ]; then
  echo "[DB-INIT] Existing schema without a ledger; recording V001 as applied"
  record_applied "V001__Initialize_database.sql"
fi

found_migration=0
for migration in "$MIGRATIONS_DIR"/V*.sql; do
  if [ ! -f "$migration" ]; then
    continue
  fi
  found_migration=1
  name="$(basename "$migration")"
  # Two statements, not one CASE: PostgreSQL resolves the table name while
  # parsing, so a subquery on a missing ledger fails even in an unused branch.
  applied=0
  if [ "$(run_sql -c "SELECT to_regclass('public.schema_migrations') IS NOT NULL")" = "t" ]; then
    applied="$(run_sql -c "SELECT count(*) FROM public.schema_migrations WHERE filename = '$name'")"
  fi
  if [ "$applied" != "0" ]; then
    echo "[DB-INIT] $name already applied, skipping"
    continue
  fi
  echo "[DB-INIT] Applying $name"
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f "$migration"
  record_applied "$name"
done

if [ "$found_migration" = "0" ]; then
  echo "[DB-INIT] No migrations found in $MIGRATIONS_DIR" >&2
  exit 1
fi

echo "[DB-INIT] Migrations up to date"
