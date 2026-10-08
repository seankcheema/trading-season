#!/usr/bin/env bash

set -Eeuo pipefail

output_dir="backups"
include_market_data=true

done_stage() { printf '[DONE] %s\n' "$*"; }
fail() { printf '[FAIL] %s\n' "$*" >&2; exit 1; }

usage() {
    cat <<'EOF'
Usage: ./scripts/backup-database.sh [options]

Writes a compressed pg_dump of the business database, including the permanent
trade record, to a timestamped file. Take one before every deployment or
manual migration.

Options:
  --output-dir PATH       Directory for the dump (default: backups, which git ignores)
  --exclude-market-data   Skip the rows of the replay tables, which the market-data
                          scripts can regenerate. Their definitions are still dumped.
  -h, --help              Show this help

The connection is read from PGHOST, PGPORT, PGUSER and PGDATABASE (defaults:
localhost, 5432, trading_season, trading_season). The password is read from
PGPASSWORD, then SPRING_DATASOURCE_PASSWORD. It is never printed.
EOF
}

while (($#)); do
    case "$1" in
        --output-dir)
            (($# >= 2)) || fail '--output-dir requires a directory path.'
            output_dir="$2"
            shift 2
            ;;
        --exclude-market-data)
            include_market_data=false
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *) fail "Unknown option: $1. Run with --help for usage." ;;
    esac
done

command -v pg_dump >/dev/null 2>&1 || fail 'pg_dump is not on PATH. Install the PostgreSQL client tools.'
command -v pg_restore >/dev/null 2>&1 || fail 'pg_restore is not on PATH. Install the PostgreSQL client tools.'

export PGHOST="${PGHOST:-localhost}"
export PGPORT="${PGPORT:-5432}"
export PGUSER="${PGUSER:-trading_season}"
export PGDATABASE="${PGDATABASE:-trading_season}"
export PGPASSWORD="${PGPASSWORD:-${SPRING_DATASOURCE_PASSWORD:-}}"

dump_args=(--format=custom --no-password)
if [[ "$include_market_data" == false ]]; then
    # Replay data only. Nothing in the trade record references these rows.
    for table in market_ticks quotes candles market_states market_behaviors; do
        dump_args+=(--exclude-table-data="public.$table")
    done
fi

mkdir -p "$output_dir"
target="$output_dir/$PGDATABASE-$(date -u +%Y%m%dT%H%M%SZ).dump"
partial="$target.partial"
trap 'rm -f "$partial"' EXIT

pg_dump "${dump_args[@]}" --file="$partial" || \
    fail "pg_dump could not back up $PGDATABASE on $PGHOST:$PGPORT. No backup was written."

# A dump that cannot be read back is not a backup.
pg_restore --list "$partial" >/dev/null || fail 'The dump could not be read back. No backup was written.'

mv "$partial" "$target"
done_stage "Backup written to $target"
