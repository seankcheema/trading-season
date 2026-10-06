#!/usr/bin/env bash

set -Eeuo pipefail

readonly MIN_FREE_KB=$((3 * 1024 * 1024))
readonly EXPECTED_ARCHIVE="apps/market-data/db/seeds/synthetic-market-data-2026-v1"

database_mode="auto"
parquet_source=""
force_install=false

ready() { printf '[READY] %s\n' "$*"; }
done_stage() { printf '[DONE] %s\n' "$*"; }
fail() { printf '[FAIL] %s\n' "$*" >&2; exit 1; }

usage() {
    cat <<'EOF'
Usage: ./scripts/setup-local.sh [options]

Options:
  --database-mode auto|local|docker  Prefer local PostgreSQL, require it, or use Compose (default: auto)
  --parquet-source PATH              Copy and validate an existing archive when the repository archive is absent
  --force-install                    Run both npm ci commands even when lockfiles are unchanged
  -h, --help                         Show this help

Database passwords are read from SPRING_DATASOURCE_PASSWORD and
apps/auth-service/.env. They are never printed.
EOF
}

while (($#)); do
    case "$1" in
        --database-mode)
            (($# >= 2)) || fail '--database-mode requires auto, local, or docker.'
            database_mode="$2"
            shift 2
            ;;
        --parquet-source)
            (($# >= 2)) || fail '--parquet-source requires a directory path.'
            parquet_source="$2"
            shift 2
            ;;
        --force-install)
            force_install=true
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *) fail "Unknown option: $1. Run with --help for usage." ;;
    esac
done

case "$database_mode" in
    auto|local|docker) ;;
    *) fail "Unsupported database mode '$database_mode'; use auto, local, or docker." ;;
esac

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
cd "$repo_root"

auth_dir="$repo_root/apps/auth-service"
ui_dir="$repo_root/apps/client-ui"
env_file="$auth_dir/.env"
compose_file="$repo_root/infrastructure/docker-compose/docker-compose.local.yml"
archive_path="$repo_root/$EXPECTED_ARCHIVE"
archive_staging=""
service_pids=()
tail_pids=()
log_dir=""

cleanup() {
    local status=$?
    trap - EXIT INT TERM
    for pid in "${service_pids[@]:-}"; do
        if kill -0 "$pid" 2>/dev/null; then
            kill -TERM -- "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
        fi
    done
    for pid in "${tail_pids[@]:-}"; do
        kill "$pid" 2>/dev/null || true
    done
    [[ -z "$archive_staging" || ! -d "$archive_staging" ]] || rm -rf -- "$archive_staging"
    [[ -z "$log_dir" || ! -d "$log_dir" ]] || rm -rf -- "$log_dir"
    exit "$status"
}
trap cleanup EXIT INT TERM

version_at_least() {
    local actual="$1" required="$2"
    [[ "$(printf '%s\n%s\n' "$required" "$actual" | sort -V | head -n1)" == "$required" ]]
}

require_command() {
    local command_name="$1" guidance="$2"
    command -v "$command_name" >/dev/null 2>&1 || fail "$command_name was not found. $guidance"
}

free_kb() {
    df -Pk "$1" | awk 'NR == 2 { print $4 }'
}

format_gb() {
    awk -v kb="$1" 'BEGIN { printf "%.1f", kb / 1048576 }'
}

check_storage() {
    local label="$1" path="$2" available
    available="$(free_kb "$path")"
    ((available >= MIN_FREE_KB)) || fail "$label has $(format_gb "$available") GB free; at least 3.0 GB must remain. Free space or expand the volume."
    ready "$label — $(format_gb "$available") GB free."
}

get_env_value() {
    local name="$1" value
    value="$(sed -n "s/^${name}=//p" "$env_file" | tail -n1)"
    value="${value%\"}"
    value="${value#\"}"
    value="${value%\'}"
    value="${value#\'}"
    printf '%s' "$value"
}

port_in_use() {
    local port="$1"
    if command -v ss >/dev/null 2>&1; then
        ss -ltnH "sport = :$port" 2>/dev/null | grep -q .
    elif command -v lsof >/dev/null 2>&1; then
        lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
    else
        (echo >/dev/tcp/127.0.0.1/"$port") >/dev/null 2>&1
    fi
}

check_toolchain() {
    require_command git 'Install Git and try again.'
    require_command node 'Install Node.js 24.8.0 (exactly).'
    require_command npm 'Install npm 11.16.0 (exactly).'
    require_command java 'Install a JDK 21 or newer.'
    require_command mvn 'Install Maven 3.9 or newer.'
    require_command sha256sum 'Install GNU coreutils.'
    require_command setsid 'Install util-linux.'

    local node_version npm_version java_version maven_version
    node_version="$(node --version | sed 's/^v//')"
    [[ "$node_version" == "24.8.0" ]] || \
        fail "Node $node_version is unsupported. Install Node 24.8.0 (exactly), which is compatible with Angular 21.2.x."
    npm_version="$(npm --version)"
    [[ "$npm_version" == "11.16.0" ]] || fail "npm $npm_version is unsupported. Install npm 11.16.0 (exactly)."
    java_version="$(java -version 2>&1 | awk -F'"' 'NR == 1 { print $2 }')"
    version_at_least "${java_version%%-*}" '21' || fail "Java $java_version is unsupported. Install JDK 21 or newer."
    maven_version="$(mvn --version | awk 'NR == 1 { print $3 }')"
    version_at_least "$maven_version" '3.9' || fail "Maven $maven_version is unsupported. Install Maven 3.9 or newer."
    ready "Toolchain — Node $node_version, npm $npm_version, Java $java_version, and Maven $maven_version."
}

configure_auth() {
    local created=false
    if [[ ! -f "$env_file" ]]; then
        cp "$auth_dir/.env.example" "$env_file"
        sed -i '/^JWT_PRIVATE_KEY=/d; /^JWT_PUBLIC_KEY=/d; /^JWT_ISSUER=/d' "$env_file"
        node "$auth_dir/scripts/generate-dev-keys.mjs" >> "$env_file"
        created=true
    fi

    local private_key public_key issuer
    for name in JWT_PRIVATE_KEY JWT_PUBLIC_KEY JWT_ISSUER; do
        [[ "$(grep -c "^${name}=" "$env_file")" == 1 ]] || fail "Auth configuration must contain exactly one $name entry."
    done
    private_key="$(get_env_value JWT_PRIVATE_KEY)"
    public_key="$(get_env_value JWT_PUBLIC_KEY)"
    issuer="$(get_env_value JWT_ISSUER)"
    [[ "$private_key" == '-----BEGIN PRIVATE KEY-----\n'*'\n-----END PRIVATE KEY-----' && "$private_key" != *'...'* ]] || \
        fail 'Auth configuration contains a missing or placeholder JWT_PRIVATE_KEY. Preserve the file, replace the placeholder, and rerun.'
    [[ "$public_key" == '-----BEGIN PUBLIC KEY-----\n'*'\n-----END PUBLIC KEY-----' && "$public_key" != *'...'* ]] || \
        fail 'Auth configuration contains a missing or placeholder JWT_PUBLIC_KEY. Preserve the file, replace the placeholder, and rerun.'
    [[ -n "$issuer" ]] || fail 'Auth configuration is missing JWT_ISSUER.'
    for name in DB_HOST DB_PORT DB_USER DB_PASSWORD DB_NAME; do
        [[ -n "$(get_env_value "$name")" ]] || fail "Auth configuration is missing $name."
    done
    if [[ "$created" == true ]]; then
        done_stage 'Auth configuration — created and validated .env and development keys.'
    else
        ready 'Auth configuration — existing .env and development keys are valid; skipping.'
    fi
}

install_dependencies() {
    local directory="$1" lockfile="$2" label="$3"
    local stamp="$directory/node_modules/.trading-season-lock.sha256" expected current=''
    expected="$(sha256sum "$lockfile" | awk '{print $1}')"
    [[ -f "$stamp" ]] && current="$(cat "$stamp")"
    if [[ "$force_install" == false && -d "$directory/node_modules" && "$current" == "$expected" ]]; then
        ready "$label — lockfile is unchanged; skipping npm ci."
        return
    fi
    npm --prefix "$directory" ci || fail "$label installation failed. Review npm output above."
    mkdir -p "$(dirname "$stamp")"
    printf '%s\n' "$expected" > "$stamp"
    done_stage "$label — dependencies installed."
    check_storage 'Repository storage' "$repo_root"
}

validate_archive() {
    local dataset="$1"
    node - "$dataset" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = process.argv[2];
const manifestPath = path.join(root, 'manifest.json');
if (!fs.existsSync(manifestPath)) throw new Error(`missing ${manifestPath}`);
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
if (manifest.schema_version !== 2 || manifest.dataset_id !== '2026-v1') throw new Error('unsupported manifest');
const hashFile = file => new Promise((resolve, reject) => {
  const digest = crypto.createHash('sha256');
  fs.createReadStream(file).on('error', reject).on('data', chunk => digest.update(chunk)).on('end', () => resolve(digest.digest('hex')));
});
(async () => {
  for (const group of ['tick_files', 'candle_files']) {
    if (!Array.isArray(manifest[group]) || manifest[group].length === 0) throw new Error(`missing ${group}`);
    for (const item of manifest[group]) {
      const file = path.join(root, item.name);
      if (!fs.existsSync(file) || fs.statSync(file).size !== item.bytes) throw new Error(`missing or wrong-sized ${item.name}`);
      if (await hashFile(file) !== item.sha256) throw new Error(`checksum mismatch for ${item.name}`);
    }
  }
})().catch(error => { console.error(error.message); process.exit(1); });
NODE
}

prepare_archive() {
    if [[ -d "$archive_path" ]]; then
        validate_archive "$archive_path" || fail 'The existing Parquet archive is incomplete or corrupt. No files were changed.'
        ready "Parquet archive — existing archive validated at $EXPECTED_ARCHIVE; skipping."
        return
    fi
    if [[ -z "$parquet_source" ]]; then
        ready 'Parquet archive — optional archive is not present; download and generation are skipped.'
        return
    fi
    [[ -d "$parquet_source" ]] || fail "Parquet source does not exist: $parquet_source"
    local source_kb available_kb projected_kb
    source_kb="$(du -sk "$parquet_source" | awk '{print $1}')"
    mkdir -p "$(dirname "$archive_path")"
    available_kb="$(free_kb "$(dirname "$archive_path")")"
    projected_kb=$((available_kb - source_kb))
    ((projected_kb >= MIN_FREE_KB)) || \
        fail "Copying the $(format_gb "$source_kb") GB archive would leave $(format_gb "$projected_kb") GB free; at least 3.0 GB must remain."
    archive_staging="${archive_path}.staging-$$"
    mkdir "$archive_staging"
    cp -a "$parquet_source"/. "$archive_staging"/
    validate_archive "$archive_staging" || fail 'The copied Parquet archive failed validation; the temporary copy will be removed.'
    mv "$archive_staging" "$archive_path"
    archive_staging=""
    done_stage "Parquet archive — copied and validated; approximately $(format_gb "$projected_kb") GB remains."
    check_storage 'Repository storage after archive copy' "$repo_root"
}

business_schema_query="SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('users','user_accounts','refresh_tokens','simulation_sessions','stocks','instruments','accounts','market_states','market_behaviors','quotes','market_ticks','candles','holdings','orders','fills','cash_transactions','holding_movements','audit_trail');"
business_total_query="SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';"
business_v3_query="SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name IN ('password_hash','username');"

validate_business_schema_local() {
    local password="${SPRING_DATASOURCE_PASSWORD:-changeme}" required total removed data_directory
    required="$(PGPASSWORD="$password" psql -h localhost -p 5432 -U trading_season -d trading_season -Atqc "$business_schema_query" 2>/dev/null)" || \
        fail 'Local business database is reachable but could not be authenticated or queried. Check SPRING_DATASOURCE_PASSWORD.'
    total="$(PGPASSWORD="$password" psql -h localhost -p 5432 -U trading_season -d trading_season -Atqc "$business_total_query")"
    removed="$(PGPASSWORD="$password" psql -h localhost -p 5432 -U trading_season -d trading_season -Atqc "$business_v3_query")"
    [[ "$required" == 18 && "$removed" == 0 ]] || \
        fail "Local schema is partial or unexpected ($required/18 required tables, $total total tables). No migrations were run."
    data_directory="$(PGPASSWORD="$password" psql -h localhost -p 5432 -U trading_season -d trading_season -Atqc 'SHOW data_directory' 2>/dev/null || true)"
    if [[ -n "$data_directory" && -e "$data_directory" ]] && df -Pk "$data_directory" >/dev/null 2>&1; then
        check_storage 'Local PostgreSQL storage' "$data_directory"
    else
        ready 'Local PostgreSQL storage — server data path is not inspectable by this user; no import will be started.'
    fi
}

docker_compose() {
    # A dedicated project name prevents the local database volumes and service
    # identities from colliding with infrastructure/docker-compose Jenkins runs.
    docker compose --project-name trading-season-local --env-file "$env_file" -f "$compose_file" "$@"
}

ensure_docker_compose() {
    if docker compose version >/dev/null 2>&1; then
        ready 'Docker Compose — CLI plugin is available; skipping.'
        return
    fi

    local standalone plugin_dir plugin_path compose_version
    standalone="$(command -v docker-compose 2>/dev/null || true)"
    [[ -n "$standalone" ]] || fail 'Docker Compose v2 is unavailable. Install the docker compose CLI plugin.'
    compose_version="$("$standalone" version --short 2>/dev/null || true)"
    [[ "$compose_version" == 2.* || "$compose_version" == v2.* ]] || \
        fail "The standalone Docker Compose at $standalone is not v2. Install the Compose v2 CLI plugin."

    plugin_dir="${DOCKER_CONFIG:-$HOME/.docker}/cli-plugins"
    plugin_path="$plugin_dir/docker-compose"
    if [[ -e "$plugin_path" || -L "$plugin_path" ]]; then
        fail "Docker Compose is not discoverable, and $plugin_path already exists. Inspect that path manually; it was not overwritten."
    fi
    mkdir -p "$plugin_dir" || fail "Could not create Docker CLI plugin directory $plugin_dir."
    ln -s "$standalone" "$plugin_path" || fail "Could not link $standalone to $plugin_path."
    docker compose version >/dev/null 2>&1 || fail "Created $plugin_path, but Docker still cannot load the Compose plugin."
    done_stage "Docker Compose — linked existing v2 standalone binary into $plugin_path."
}

wait_for_compose_health() {
    local service="$1" id health attempt
    for attempt in $(seq 1 40); do
        id="$(docker_compose ps -q "$service")"
        if [[ -n "$id" ]]; then
            health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$id")"
            [[ "$health" == healthy ]] && return 0
            [[ "$health" == unhealthy || "$health" == exited || "$health" == dead ]] && return 1
        fi
        sleep 3
    done
    return 1
}

validate_or_initialize_docker_business() {
    local required total removed migration
    required="$(docker_compose exec -T db psql -U trading_season -d trading_season -Atqc "$business_schema_query")"
    total="$(docker_compose exec -T db psql -U trading_season -d trading_season -Atqc "$business_total_query")"
    if [[ "$total" == 0 ]]; then
        docker_compose exec -T db psql -v ON_ERROR_STOP=1 -U trading_season -d trading_season < db/migrations/V001__Initialize_database.sql || \
            fail "Database schema initialization failed."
        done_stage 'Schema — initialized empty Docker database with V001__Initialize_database.sql.'
        return
    fi
    removed="$(docker_compose exec -T db psql -U trading_season -d trading_season -Atqc "$business_v3_query")"
    [[ "$required" == 18 && "$removed" == 0 ]] || \
        fail "Docker schema is partial or unexpected ($required/18 required tables, $total total tables). No migrations were run."
    ready 'Schema — existing Docker schema is valid; skipping.'
}

check_docker_database_storage() {
    local available
    available="$(docker_compose exec -T db df -Pk /var/lib/postgresql/data | awk 'NR == 2 { print $4 }')"
    ((available >= MIN_FREE_KB)) || fail "Docker PostgreSQL storage has $(format_gb "$available") GB free; at least 3.0 GB must remain."
    ready "Docker PostgreSQL storage — $(format_gb "$available") GB free."
}

select_databases() {
    local use_local=false
    if [[ "$database_mode" != docker ]] && command -v pg_isready >/dev/null 2>&1 && pg_isready -h localhost -p 5432 -q; then
        use_local=true
    fi
    if [[ "$database_mode" == local && "$use_local" == false ]]; then
        fail 'Local database mode requires PostgreSQL on localhost:5432 and PostgreSQL client tools.'
    fi
    if [[ "$use_local" == true ]]; then
        require_command psql 'Install the PostgreSQL client tools to verify the existing databases.'
        validate_business_schema_local
        ready 'Databases — using the verified local trading_season database; Docker skipped.'
        return
    fi
    require_command docker 'Install the Docker CLI and Docker Compose v2, then start Docker Engine.'
    docker info >/dev/null 2>&1 || fail 'Docker CLI is installed, but the daemon is unavailable. Start Docker Engine or correct the active context.'
    [[ "$(docker info --format '{{.OSType}}')" == linux ]] || fail 'The Docker daemon is not using Linux containers; PostgreSQL requires a Linux daemon.'
    ensure_docker_compose
    check_storage 'Docker storage' "$(docker info --format '{{.DockerRootDir}}')"

    local existing had_database=true
    existing="$(docker_compose ps -q db 2>/dev/null || true)"
    [[ -n "$existing" ]] || had_database=false
    if [[ -z "$existing" ]] && port_in_use 5432; then
        fail 'Port 5432 is already in use by a non-Compose service. The Docker database was not started.'
    fi

    local existing_broker
    existing_broker="$(docker_compose ps -q kafka 2>/dev/null || true)"
    if [[ -z "$existing_broker" ]] && port_in_use 29092; then
        fail 'Port 29092 is already in use by a non-Compose service. The Docker broker was not started.'
    fi

    export DB_PASSWORD="${SPRING_DATASOURCE_PASSWORD:-changeme}"
    docker_compose up -d db kafka || fail 'Docker database or broker startup failed. Review the Compose output above.'
    wait_for_compose_health db || fail 'Docker database did not become healthy within two minutes.'
    wait_for_compose_health kafka || fail 'Docker Kafka broker did not become healthy within two minutes.'
    # Separate from the broker starting: auto-creation is disabled, so
    # trade-events exists only once this one-shot container has run.
    docker_compose up -d kafka-init || fail 'Creating the trade-events topic failed. Review the Compose output above.'
    if [[ "$had_database" == true && -n "$existing_broker" ]]; then
        ready 'Docker database and broker — the existing containers are healthy; skipping startup.'
    else
        done_stage 'Docker database and broker — the PostgreSQL and Kafka containers are healthy.'
    fi
    validate_or_initialize_docker_business
    check_docker_database_storage
    check_storage 'Storage after Docker startup' "$repo_root"

    # The applications run on the VM, so expose the Compose database port to
    # their inherited environment even when an existing .env targets local
    # PostgreSQL. Auth connects to the same database as the Java services.
    export SPRING_DATASOURCE_PASSWORD="$DB_PASSWORD"
    export DB_HOST=localhost
    export DB_PORT=5432
    export DB_USER=trading_season
    export DB_NAME=trading_season
    # The broker is published on the host as localhost:29092; inside Compose it
    # is kafka:9092. These applications run on the VM, so they take the former.
    # Nothing reads this yet -- no service publishes or consumes.
    export KAFKA_BOOTSTRAP_SERVERS=localhost:29092
}

start_service() {
    local name="$1" directory="$2"
    shift 2
    local log="$log_dir/$name.log"
    setsid bash -c 'cd "$1"; shift; exec "$@"' _ "$directory" "$@" >"$log" 2>&1 &
    service_pids+=("$!")
    tail -n +1 -F "$log" 2>/dev/null | sed -u "s/^/[$name] /" &
    tail_pids+=("$!")
}

start_applications() {
    local port
    for port in 3001 4200 8081 8082; do
        port_in_use "$port" && fail "Application port $port is already in use. Stop the existing process or use the manual startup path."
    done
    log_dir="$(mktemp -d "${TMPDIR:-/tmp}/trading-season.XXXXXX")"
    start_service auth "$auth_dir" npm run start:dev
    start_service holdings-and-trade "$repo_root/apps/holdings-and-trade-service" mvn spring-boot:run
    start_service order-and-sell "$repo_root/apps/order-and-sell-service" mvn spring-boot:run
    start_service ui "$ui_dir" npm start
    done_stage 'Applications — starting UI :4200, auth :3001, holdings-and-trade :8081, and order-and-sell :8082. Press Ctrl+C to stop them.'

    set +e
    wait -n "${service_pids[@]}"
    local status=$?
    set -e
    fail "An application process exited with status $status. Review the labeled logs above."
}

check_toolchain
check_storage 'Repository storage' "$repo_root"
configure_auth
install_dependencies "$ui_dir" "$ui_dir/package-lock.json" 'UI dependencies'
install_dependencies "$auth_dir" "$auth_dir/package-lock.json" 'Auth dependencies'
prepare_archive
select_databases
start_applications
