#!/usr/bin/env bash

set -Eeuo pipefail

done_stage() { printf '[DONE] %s\n' "$*"; }
fail() { printf '[FAIL] %s\n' "$*" >&2; exit 1; }

usage() {
    cat <<'EOF'
Usage: ./scripts/restore-database.sh DUMP_FILE NEW_DATABASE

Restores a dump written by backup-database.sh into a database that does not
exist yet. It never restores over an existing database, so a restore cannot
replace or remove a trade record. Point the services at NEW_DATABASE once the
reported counts are as expected.

The connection is read from PGHOST, PGPORT and PGUSER (defaults: localhost,
5432, trading_season). The role must be allowed to create databases. The
password is read from PGPASSWORD, then SPRING_DATASOURCE_PASSWORD. It is never
printed.
EOF
}

case "${1:-}" in
    -h|--help)
        usage
        exit 0
        ;;
esac
(($# == 2)) || { usage >&2; exit 1; }

dump_file="$1"
new_database="$2"

[[ -f "$dump_file" ]] || fail "Dump file not found: $dump_file"
[[ "$new_database" =~ ^[a-z_][a-z0-9_]*$ ]] || \
    fail 'NEW_DATABASE may contain only lowercase letters, digits and underscores, and must not start with a digit.'
for tool in psql pg_restore; do
    command -v "$tool" >/dev/null 2>&1 || fail "$tool is not on PATH. Install the PostgreSQL client tools."
done

export PGHOST="${PGHOST:-localhost}"
export PGPORT="${PGPORT:-5432}"
export PGUSER="${PGUSER:-trading_season}"
export PGPASSWORD="${PGPASSWORD:-${SPRING_DATASOURCE_PASSWORD:-}}"

run_sql() {
    psql --no-password -X -q -tA -v ON_ERROR_STOP=1 -d "$1" -c "$2"
}

exists="$(run_sql postgres "SELECT count(*) FROM pg_database WHERE datname = '$new_database'")" || \
    fail "Could not connect to PostgreSQL on $PGHOST:$PGPORT."
[[ "$exists" == 0 ]] || fail "Database $new_database already exists. Choose a new name; nothing was changed."

run_sql postgres "CREATE DATABASE $new_database" || fail "Could not create database $new_database."

# One transaction: a failed restore leaves an empty database, not half a record.
pg_restore --no-password --exit-on-error --single-transaction --dbname="$new_database" "$dump_file" || \
    fail "Restore into $new_database failed and was rolled back. Drop the empty database before retrying."

counts="$(run_sql "$new_database" "
    SELECT format('%s orders, %s audit events, %s fills, %s cash transactions, %s holding movements, %s protection triggers',
        (SELECT count(*) FROM orders), (SELECT count(*) FROM audit_trail), (SELECT count(*) FROM fills),
        (SELECT count(*) FROM cash_transactions), (SELECT count(*) FROM holding_movements),
        (SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal
            AND tgname LIKE ANY (ARRAY['%append_only', '%no_truncate', '%no_delete', '%guard%'])))
")"
done_stage "Restored $dump_file into $new_database: $counts"
