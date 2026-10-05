#!/bin/sh
# Initialize business database with required schemas and migrations

set -e

DATABASE_URL="${1:-postgresql://trading_season:changeme@db:5432/trading_season}"
REPO_ROOT="${2:-/workspace}"

echo "[DB-INIT] Waiting for database to be ready..."
until pg_isready -q "$(echo "$DATABASE_URL" | sed 's|postgresql://||; s|/.*||')"; do
  sleep 1
done

echo "[DB-INIT] Checking if database needs initialization..."

# Check if any tables exist (quick way to detect if already initialized)
TABLE_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';" 2>/dev/null || echo "0")

if [ "$TABLE_COUNT" = "0" ]; then
    echo "[DB-INIT] Database is empty, applying migrations..."

    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$REPO_ROOT/apps/market-data/db/migrations/V001__Initialize_database.sql"
    echo "[DB-INIT] Migrations applied successfully"
else
    echo "[DB-INIT] Database already initialized with $TABLE_COUNT tables, skipping migrations"
fi
