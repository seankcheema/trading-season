#!/bin/sh
# Initialize business database with required schemas and migrations

set -e

DATABASE_URL="${1:-postgresql://trading_season:changeme@db:5432/trading_season}"
REPO_ROOT="${2:-/workspace}"
MIGRATIONS_DIR="$REPO_ROOT/apps/market-data/db/migrations"

echo "[DB-INIT] Waiting for database to be ready..."
until pg_isready -q "$(echo "$DATABASE_URL" | sed 's|postgresql://||; s|/.*||')"; do
  sleep 1
done

echo "[DB-INIT] Checking if database needs initialization..."

# Check if any tables exist (quick way to detect if already initialized)
TABLE_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';" 2>/dev/null || echo "0")

if [ "$TABLE_COUNT" = "0" ]; then
    echo "[DB-INIT] Database is empty, applying migrations from $MIGRATIONS_DIR..."

    if [ ! -d "$MIGRATIONS_DIR" ]; then
      echo "[DB-INIT] Migrations directory not found: $MIGRATIONS_DIR" >&2
      exit 1
    fi

    found_migration=0
    for migration in "$MIGRATIONS_DIR"/V*.sql; do
      if [ ! -f "$migration" ]; then
        continue
      fi
      found_migration=1
      echo "[DB-INIT] Applying $(basename "$migration")"
      psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$migration"
    done

    if [ "$found_migration" = "0" ]; then
      echo "[DB-INIT] No migrations found in $MIGRATIONS_DIR" >&2
      exit 1
    fi

    echo "[DB-INIT] Migrations applied successfully"
else
    echo "[DB-INIT] Database already initialized with $TABLE_COUNT tables, skipping migrations"
fi
