#!/usr/bin/env bash

set -Eeuo pipefail

# Starts every service as a host process, with no Docker: the macOS and Linux
# counterpart of start-local.ps1. Written for bash 3.2, which is what macOS
# ships, so it uses no associative arrays and no `wait -n`.

readonly BROKER_PORT=29092
readonly TRADE_EVENTS_TOPIC="trade-events"
readonly PLATFORM_RECORDS_TOPIC="platform-records"
readonly REQUIRED_JAVA=21

kafka_home="${KAFKA_HOME:-}"
use_kafka=true
skip_reporting=false
show_logs=false
force_install=false
run_migrations=false
run_seed=false
report_interval=1

ready() { printf '[READY] %s\n' "$*"; }
done_stage() { printf '[DONE] %s\n' "$*"; }
fail() { printf '[FAIL] %s\n' "$*" >&2; exit 1; }

usage() {
    cat <<'EOF'
Usage: ./scripts/start-local.sh [options]

Starts the Auth, Order and Sell, Holdings and Trade and Reporting services and
both UIs as local processes. PostgreSQL must already be running on this
machine with the trading_season role and database (see docs/local-setup/macos.md).

Options:
  --migrate               Apply pending db/migrations first (needed on an empty database)
  --seed                  Development data: --migrate, then import the market data, load the
                          johndoe demo trader, build the demo trading history, and, once
                          everything is up, publish the database's history to Kafka for
                          reporting. Safe to repeat; each step skips what already exists
  --kafka-home PATH       A Kafka distribution to start a broker from when none is
                          listening on 127.0.0.1:29092 (default: KAFKA_HOME, then
                          Homebrew's kafka if it is installed)
  --no-kafka              Never start a broker; events are off unless one is already running
  --skip-reporting        Do not start the Reporting Service and its consumer
  --report-interval MIN   Minutes between report runs (default: 1)
  --install               Run npm ci in each app even when node_modules exists
  --show-logs             Stream every service's raw log instead of status lines
  -h, --help              Show this help

The database password is read from SPRING_DATASOURCE_PASSWORD, or asked for
once without echo. It is never printed. Press Ctrl+C to stop everything this
script started.
EOF
}

while (($#)); do
    case "$1" in
        --migrate) run_migrations=true; shift ;;
        --seed) run_seed=true; run_migrations=true; shift ;;
        --kafka-home)
            (($# >= 2)) || fail '--kafka-home requires a directory path.'
            kafka_home="$2"
            shift 2
            ;;
        --no-kafka) use_kafka=false; shift ;;
        --skip-reporting) skip_reporting=true; shift ;;
        --report-interval)
            (($# >= 2)) || fail '--report-interval requires a number of minutes.'
            [[ "$2" =~ ^[0-9]+$ ]] && (($2 >= 1 && $2 <= 1440)) || fail '--report-interval must be 1 to 1440.'
            report_interval="$2"
            shift 2
            ;;
        --install) force_install=true; shift ;;
        --show-logs) show_logs=true; shift ;;
        -h|--help) usage; exit 0 ;;
        *) fail "Unknown option: $1. Run with --help for usage." ;;
    esac
done

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
auth_dir="$repo_root/apps/auth-service"
client_ui_dir="$repo_root/apps/client-ui"
reporting_ui_dir="$repo_root/apps/reporting-ui"
reporting_dir="$repo_root/apps/reporting-service"
reporting_python="$reporting_dir/venv/bin/python"
market_data_dir="$repo_root/apps/market-data/db"
market_data_python="$market_data_dir/.venv/bin/python"
tools_dir="$repo_root/db/tools"
tools_python="$tools_dir/.venv/bin/python"
holdings_dir="$repo_root/apps/holdings-and-trade-service"
order_dir="$repo_root/apps/order-and-sell-service"
env_file="$auth_dir/.env"
kafka_root="${TRADING_SEASON_HOME:-$HOME/.trading-season}/kafka"

# One entry per started process, in start order. Parallel arrays: bash 3.2 has
# no associative arrays.
svc_name=()
svc_label=()
svc_port=()
svc_pid=()
svc_seen=()
svc_ready=()
log_dir=""
tail_pids=()
stopping=false

cleanup() {
    local status=$?
    trap - EXIT INT TERM
    stopping=true
    local count=${#svc_pid[@]} i
    if ((count > 0)); then
        printf '\nStopping services...\n'
    fi
    # Newest first, so the broker outlives the services that talk to it. Each
    # service leads its own process group (job control), so the signal reaches
    # the children npm and Maven start as well.
    for ((i = count - 1; i >= 0; i--)); do
        if kill -0 "${svc_pid[$i]}" 2>/dev/null; then
            kill -TERM -- "-${svc_pid[$i]}" 2>/dev/null || kill -TERM "${svc_pid[$i]}" 2>/dev/null || true
        fi
    done
    for ((i = count - 1; i >= 0; i--)); do
        local waited=0
        while kill -0 "${svc_pid[$i]}" 2>/dev/null && ((waited < 20)); do
            sleep 0.5
            waited=$((waited + 1))
        done
        if kill -0 "${svc_pid[$i]}" 2>/dev/null; then
            kill -KILL -- "-${svc_pid[$i]}" 2>/dev/null || kill -KILL "${svc_pid[$i]}" 2>/dev/null || true
        fi
    done
    if ((${#tail_pids[@]} > 0)); then
        for i in "${tail_pids[@]}"; do kill -TERM -- "-$i" 2>/dev/null || kill "$i" 2>/dev/null || true; done
    fi
    if [[ -n "$log_dir" && -d "$log_dir" && "$log_dir" == */trading-season.* ]]; then
        rm -rf -- "$log_dir"
    fi
    exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT TERM

# Job control gives every background job its own process group.
set -m

require_command() {
    command -v "$1" >/dev/null 2>&1 || fail "$1 was not found. $2"
}

port_in_use() {
    lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
}

# Names what holds a port, because the usual culprit is the Docker stack, whose
# published ports show up on the host as a Docker VM process rather than as the
# service itself.
port_holder() {
    local container=""
    if command -v docker >/dev/null 2>&1; then
        container="$(docker ps --filter "publish=$1" --format '{{.Names}}' 2>/dev/null | head -n1 || true)"
    fi
    if [[ -n "$container" ]]; then
        local stop_hint="docker compose --project-name trading-season-local -f infrastructure/docker-compose/docker-compose.local.yml down"
        [[ ! -x "$repo_root/scripts/start-stack.sh" ]] || stop_hint="./scripts/start-stack.sh --stop"
        printf 'Docker container %s (stop the Docker stack with: %s)' "$container" "$stop_hint"
    else
        lsof -nP -iTCP:"$1" -sTCP:LISTEN 2>/dev/null | awk 'NR == 2 { printf "%s (pid %s)", $1, $2 }'
    fi
}

check_ports() {
    local port busy=false ports="3001 4200 4300 8081 8082"
    [[ "$skip_reporting" == true ]] || ports="$ports 8083"
    for port in $ports; do
        if port_in_use "$port"; then
            printf '[FAIL] Port %s is held by %s.\n' "$port" "$(port_holder "$port")" >&2
            busy=true
        fi
    done
    [[ "$busy" == false ]] || exit 1
    ready "Ports - ${ports// /, } are free."
}

env_value() {
    local value
    value="$(sed -n "s/^$1=//p" "$env_file" | tail -n1)"
    value="${value%\"}"; value="${value#\"}"; value="${value%\'}"; value="${value#\'}"
    printf '%s' "$value"
}

java_major() {
    "$1/bin/java" -version 2>&1 | awk -F'"' 'NR == 1 { split($2, v, "."); print v[1]; exit }'
}

# Prefer the JDK the projects target, then any newer one. An explicit JAVA_HOME
# wins if it is new enough.
find_java_home() {
    local candidate major
    if [[ -n "${JAVA_HOME:-}" && -x "$JAVA_HOME/bin/java" ]]; then
        major="$(java_major "$JAVA_HOME")"
        if [[ "$major" =~ ^[0-9]+$ ]] && ((major >= REQUIRED_JAVA)); then
            printf '%s' "$JAVA_HOME"
            return 0
        fi
    fi
    for candidate in \
        "$(/usr/libexec/java_home -v "$REQUIRED_JAVA" 2>/dev/null || true)" \
        /opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
        /usr/local/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
        "$(/usr/libexec/java_home -v "${REQUIRED_JAVA}+" 2>/dev/null || true)" \
        /opt/homebrew/opt/openjdk/libexec/openjdk.jdk/Contents/Home \
        /usr/local/opt/openjdk/libexec/openjdk.jdk/Contents/Home \
        /usr/lib/jvm/java-21-openjdk-amd64 \
        /usr/lib/jvm/java-21-openjdk-arm64; do
        [[ -n "$candidate" && -x "$candidate/bin/java" ]] || continue
        major="$(java_major "$candidate")"
        if [[ "$major" =~ ^[0-9]+$ ]] && ((major >= REQUIRED_JAVA)); then
            printf '%s' "$candidate"
            return 0
        fi
    done
    return 1
}

check_toolchain() {
    require_command node 'Install Node.js 24.8 or newer 24.x.'
    require_command npm 'Install npm 11.6 or newer.'
    require_command mvn 'Install Maven 3.9 or newer (brew install maven).'
    require_command psql 'Install the PostgreSQL client tools (brew install postgresql@16).'
    require_command pg_isready 'Install the PostgreSQL client tools (brew install postgresql@16).'
    require_command curl 'Install curl.'
    require_command lsof 'Install lsof.'

    local node_version node_major node_minor
    node_version="$(node --version | sed 's/^v//')"
    IFS=. read -r node_major node_minor _ <<< "$node_version"
    ((node_major == 24 && node_minor >= 8)) || fail "Node $node_version is unsupported. The apps require Node ^24.8.0."

    local java_home
    java_home="$(find_java_home)" || fail "No JDK $REQUIRED_JAVA or newer was found. Install one (brew install openjdk@21) or set JAVA_HOME."
    export JAVA_HOME="$java_home"
    export PATH="$JAVA_HOME/bin:$PATH"
    ready "Toolchain - Node $node_version, JDK $(java_major "$JAVA_HOME") at $JAVA_HOME."
    if [[ "$(java_major "$JAVA_HOME")" != "$REQUIRED_JAVA" ]]; then
        ready "The services target Java $REQUIRED_JAVA; running them on a newer JDK works only if their dependencies support it."
    fi
}

configure_auth() {
    if [[ ! -f "$env_file" ]]; then
        [[ -f "$auth_dir/.env.example" ]] || fail 'apps/auth-service/.env.example is missing.'
        grep -vE '^JWT_(PRIVATE_KEY|PUBLIC_KEY|ISSUER)=' "$auth_dir/.env.example" > "$env_file"
        node "$auth_dir/scripts/generate-dev-keys.mjs" >> "$env_file" || fail 'Could not generate the development signing keys.'
        done_stage 'Auth configuration - created apps/auth-service/.env with new development keys.'
    fi
    local name value
    for name in JWT_PRIVATE_KEY JWT_PUBLIC_KEY JWT_ISSUER; do
        [[ "$(grep -c "^${name}=" "$env_file")" == 1 ]] || fail "apps/auth-service/.env must contain exactly one $name entry."
        value="$(env_value "$name")"
        [[ -n "$value" && "$value" != *'...'* ]] || fail "$name in apps/auth-service/.env is empty or a placeholder. Remove the three JWT lines and run: node apps/auth-service/scripts/generate-dev-keys.mjs >> apps/auth-service/.env"
    done
    # The environment wins over the file, as it does for the Auth Service itself.
    db_host="${DB_HOST:-$(env_value DB_HOST)}"
    db_port="${DB_PORT:-$(env_value DB_PORT)}"
    [[ "$db_host" == localhost || "$db_host" == 127.0.0.1 ]] || fail 'Local startup requires DB_HOST=localhost (or 127.0.0.1) in apps/auth-service/.env.'
    [[ "$db_port" =~ ^[0-9]+$ ]] || fail 'DB_PORT in apps/auth-service/.env must be a TCP port.'
    issuer="$(env_value JWT_ISSUER)"
    ready 'Auth configuration - apps/auth-service/.env is valid.'
}

install_node_dependencies() {
    local dir="$1" label="$2"
    if [[ "$force_install" == false && -d "$dir/node_modules" ]]; then
        ready "$label dependencies - installed; skipping (pass --install to reinstall)."
        return
    fi
    npm --prefix "$dir" ci || fail "$label installation failed. Review the npm output above."
    done_stage "$label dependencies - installed."
}

ensure_reporting_environment() {
    if [[ -x "$reporting_python" ]] && "$reporting_python" -c 'import flask, confluent_kafka' 2>/dev/null; then
        ready 'Reporting Service dependencies - installed; skipping.'
        return
    fi
    require_command python3 'Install Python 3.14, or pass --skip-reporting.'
    [[ -x "$reporting_python" ]] || python3 -m venv "$reporting_dir/venv" || fail 'Could not create apps/reporting-service/venv.'
    "$reporting_python" -m pip install -r "$reporting_dir/requirements.txt" || fail 'Installing the Reporting Service requirements failed.'
    done_stage 'Reporting Service dependencies - installed into apps/reporting-service/venv.'
}

# The password comes from the environment or one silent prompt, and is passed
# on by variable only, never as an argument or in output.
read_password() {
    if [[ -z "${SPRING_DATASOURCE_PASSWORD:-}" ]]; then
        [[ -t 0 ]] || fail 'Set SPRING_DATASOURCE_PASSWORD to the trading_season role password; there is no terminal to ask on.'
        read -r -s -p 'Database password for trading_season: ' SPRING_DATASOURCE_PASSWORD
        printf '\n'
    fi
    [[ -n "$SPRING_DATASOURCE_PASSWORD" ]] || fail 'The database password cannot be empty.'
    export SPRING_DATASOURCE_PASSWORD
}

check_database() {
    pg_isready -h "$db_host" -p "$db_port" -q || \
        fail "PostgreSQL is not accepting connections at $db_host:$db_port. Start it (brew services start postgresql@16)."
    read_password

    if [[ "$run_migrations" == true ]]; then
        PGPASSWORD="$SPRING_DATASOURCE_PASSWORD" sh "$repo_root/infrastructure/docker/init-db.sh" \
            "postgresql://trading_season@$db_host:$db_port/trading_season" "$repo_root" || fail 'Applying the migrations failed.'
        done_stage 'Database - migrations are up to date.'
    fi

    local has_schema
    has_schema="$(PGPASSWORD="$SPRING_DATASOURCE_PASSWORD" psql -h "$db_host" -p "$db_port" -U trading_season -d trading_season -Atq \
        -c "SELECT to_regclass('public.user_accounts') IS NOT NULL" 2>/dev/null)" || \
        fail "Could not sign in to database trading_season at $db_host:$db_port as role trading_season. Check the password, and that the role and database exist (docs/local-setup/windows.md step 2 creates them)."
    [[ "$has_schema" == t ]] || fail 'The trading_season database has no schema yet. Run again with --migrate (or --seed for development data too).'
    ready "PostgreSQL - $db_host:$db_port, database trading_season."
}

# --- Development data -------------------------------------------------------

database_psql() {
    env PGPASSWORD="$SPRING_DATASOURCE_PASSWORD" psql -h "$db_host" -p "$db_port" -U trading_season -d trading_season -X -Atq "$@"
}

# The password goes to the Python tools by variable, not in the URL, so it
# never appears in a process listing.
database_url() { printf 'postgresql://trading_season@%s:%s/trading_season' "$db_host" "$db_port"; }

ensure_python_environment() {
    local venv="$1" requirements="$2" check="$3" label="$4"
    if [[ -x "$venv/bin/python" ]] && "$venv/bin/python" -c "$check" 2>/dev/null; then
        ready "$label - installed; skipping."
        return
    fi
    require_command python3 'Install Python 3.14 to seed development data.'
    [[ -x "$venv/bin/python" ]] || python3 -m venv "$venv" || fail "Could not create $venv."
    "$venv/bin/python" -m pip install --disable-pip-version-check -r "$requirements" || fail "Installing the $label requirements failed."
    done_stage "$label - installed into ${venv#$repo_root/}."
}

# Each step looks before it writes, so running with --seed again adds nothing
# that exists. The sign-ins for the analyst and the reporting admin are not
# seeded here: the Auth Service creates them itself when it starts, outside
# production.
seed_database() {
    local candles trader
    candles="$(database_psql -c 'SELECT count(*) FROM candles')" || fail 'Could not read the candles table.'
    if ((candles > 0)); then
        ready "Market data - $candles candles already imported; skipping."
    else
        ensure_python_environment "$market_data_dir/.venv" "$market_data_dir/scripts/python/requirements.txt" \
            'import duckdb, asyncpg' 'Market data tools'
        # The importer checks free disk before each month, and the application
        # role cannot read the server's data directory, so it must be told. The
        # repository's disk stands in for the database's, which is normally the
        # same one on a laptop; set MARKET_DATA_AVAILABLE_DISK_GB if it is not.
        local free_gb="${MARKET_DATA_AVAILABLE_DISK_GB:-$(df -Pk "$repo_root" | awk 'NR == 2 { printf "%d", $4 / 1048576 }')}"
        printf 'Importing market data from the existing archive (validation and import take several minutes; %s GiB free)...\n' "$free_gb"
        ( cd "$market_data_dir/scripts/python" && env PGPASSWORD="$SPRING_DATASOURCE_PASSWORD" \
            "$market_data_python" 0000-setup-synthetic-market-data.py --database-url "$(database_url)" \
            --available-disk-gb "$free_gb" ) || \
            fail 'The market data import failed. Review the output above; rerunning resumes from its checkpoints.'
        done_stage 'Market data - imported.'
    fi

    trader="$(database_psql -c "SELECT count(*) FROM user_accounts WHERE lower(email) = 'johndoe@gmail.com'")"
    if ((trader > 0)); then
        ready 'Demo trader - johndoe@gmail.com already exists; skipping.'
    else
        database_psql -v ON_ERROR_STOP=1 -f "$market_data_dir/seeds/demo-trader.sql" >/dev/null || \
            fail 'Loading apps/market-data/db/seeds/demo-trader.sql failed. It needs the market data imported first.'
        done_stage 'Demo trader - johndoe@gmail.com created (password #Password12345).'
    fi

    ensure_python_environment "$tools_dir/.venv" "$tools_dir/requirements.txt" 'import psycopg, confluent_kafka' 'Reporting feed tools'
    env PGPASSWORD="$SPRING_DATASOURCE_PASSWORD" "$tools_python" "$tools_dir/seed_demo_history.py" --database-url "$(database_url)" || \
        fail 'Seeding the demo history failed. Review the output above.'
    done_stage 'Demo history - eight demo traders seeded up to the present moment.'
}

# Needs the broker and, for the sign-ins of the development users, the Auth
# Service to have started. A failure here is reported, not fatal: the stack is
# up either way, and the tool is safe to run again.
republish_history() {
    printf '\nPublishing the database history to Kafka for reporting...\n'
    if env PGPASSWORD="$SPRING_DATASOURCE_PASSWORD" "$tools_python" "$tools_dir/republish_history.py" \
        --database-url "$(database_url)" --bootstrap-servers "127.0.0.1:$BROKER_PORT"; then
        done_stage 'History published. The Reporting UI shows it within a few seconds; its report within the report interval.'
    else
        printf '[WARN] Republishing failed; the stack is still running. Rerun db/tools/republish_history.py once the cause is fixed.\n' >&2
    fi
}

# --- Kafka ----------------------------------------------------------------

kafka_bin=""

find_kafka_bin() {
    local dir
    for dir in \
        "${kafka_home:+$kafka_home/bin}" \
        /opt/homebrew/opt/kafka/bin \
        /usr/local/opt/kafka/bin; do
        [[ -n "$dir" ]] || continue
        if [[ -x "$dir/kafka-server-start" || -x "$dir/kafka-server-start.sh" ]]; then
            kafka_bin="$dir"
            return 0
        fi
    done
    return 1
}

kafka_tool() {
    local name="$1"
    shift
    if [[ -x "$kafka_bin/$name.sh" ]]; then "$kafka_bin/$name.sh" "$@"; else "$kafka_bin/$name" "$@"; fi
}

kafka_tool_path() {
    if [[ -x "$kafka_bin/$1.sh" ]]; then printf '%s' "$kafka_bin/$1.sh"; else printf '%s' "$kafka_bin/$1"; fi
}

write_kafka_config() {
    local data_dir="$kafka_root/data" controller_port=$((BROKER_PORT + 1))
    mkdir -p "$data_dir"
    # A single-node KRaft broker on the Compose stack's host port, bound to IPv4
    # loopback. Its data is kept between runs: the reporting consumer skips
    # offsets it has already stored, so a broker that restarted from offset 0
    # would lose it new events.
    cat > "$kafka_root/server.properties" <<EOF
process.roles=broker,controller
node.id=1
controller.quorum.voters=1@127.0.0.1:$controller_port
listeners=PLAINTEXT://127.0.0.1:$BROKER_PORT,CONTROLLER://127.0.0.1:$controller_port
advertised.listeners=PLAINTEXT://127.0.0.1:$BROKER_PORT
controller.listener.names=CONTROLLER
inter.broker.listener.name=PLAINTEXT
listener.security.protocol.map=CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT
log.dirs=$data_dir
offsets.topic.replication.factor=1
transaction.state.log.replication.factor=1
transaction.state.log.min.isr=1
share.coordinator.state.topic.replication.factor=1
share.coordinator.state.topic.min.isr=1
group.initial.rebalance.delay.ms=0
auto.create.topics.enable=false
EOF
    if [[ ! -f "$data_dir/meta.properties" ]]; then
        local cluster_id
        cluster_id="$(kafka_tool kafka-storage random-uuid 2>/dev/null | tail -n1)"
        [[ -n "$cluster_id" ]] || fail 'Could not generate a Kafka cluster id.'
        kafka_tool kafka-storage format -t "$cluster_id" -c "$kafka_root/server.properties" >/dev/null 2>&1 || \
            fail "Could not format Kafka storage in $data_dir."
    fi
}

create_topics() {
    # As the Compose stack's kafka container creates them. Three partitions each:
    # one key's messages share a partition and keep their order. trade-events is
    # kept forever, because the reporting service rebuilds its files by replaying
    # it; platform-records is compacted, because each message is the current
    # state of one row.
    kafka_tool kafka-topics --bootstrap-server "127.0.0.1:$BROKER_PORT" --create --if-not-exists \
        --topic "$TRADE_EVENTS_TOPIC" --partitions 3 --replication-factor 1 --config retention.ms=-1 >/dev/null 2>&1 && \
    kafka_tool kafka-topics --bootstrap-server "127.0.0.1:$BROKER_PORT" --create --if-not-exists \
        --topic "$PLATFORM_RECORDS_TOPIC" --partitions 3 --replication-factor 1 --config cleanup.policy=compact >/dev/null 2>&1 || \
        fail "Could not create the Kafka topics on 127.0.0.1:$BROKER_PORT."
}

# --- Process management ---------------------------------------------------

# start_service NAME LABEL PORT DIRECTORY COMMAND [ARG...]
# The command may begin with `env VAR=value ...` to give it variables of its own.
start_service() {
    local name="$1" label="$2" port="$3" directory="$4"
    shift 4
    local log="$log_dir/$name.log"
    : > "$log"
    ( cd "$directory" && exec "$@" ) >"$log" 2>&1 &
    svc_name+=("$name")
    svc_label+=("$label")
    svc_port+=("$port")
    svc_pid+=("$!")
    svc_seen+=(0)
    svc_ready+=(false)
    if [[ "$show_logs" == true ]]; then
        # awk, not sed -u/-l: the flag differs between BSD and GNU sed.
        tail -n +1 -F "$log" 2>/dev/null | awk -v p="[$name]" '{ print p, $0; fflush() }' &
        tail_pids+=("$!")
    fi
}

index_of() {
    local i
    for ((i = 0; i < ${#svc_name[@]}; i++)); do
        [[ "${svc_name[$i]}" == "$1" ]] && { printf '%s' "$i"; return 0; }
    done
    return 1
}

status_line() { printf '  %-9s%-26s%s\n' "$1" "$2" "$3"; }

show_log_tail() {
    local i="$1"
    printf -- '--- last 40 lines of %s ---\n' "${svc_label[$i]}"
    tail -n 40 "$log_dir/${svc_name[$i]}.log" | sed 's/^/  /'
}

# Error lines worth showing when the raw logs are not streamed.
echo_new_errors() {
    local i="$1" log total
    log="$log_dir/${svc_name[$i]}.log"
    total="$(wc -l < "$log" | tr -d ' ')"
    if ((total > svc_seen[i])); then
        tail -n +$((svc_seen[i] + 1)) "$log" | head -n $((total - svc_seen[i])) | \
            grep -E '\b(ERROR|FATAL|SEVERE)\b|Exception in thread|Traceback \(most recent call last\)' | \
            sed "s/^/[${svc_name[$i]}] /" || true
        svc_seen[$i]=$total
    fi
}

start_kafka_broker() {
    start_service kafka 'Kafka' "$BROKER_PORT" "$kafka_root" \
        env KAFKA_HEAP_OPTS='-Xmx512m -Xms256m' LOG_DIR="$kafka_root/logs" \
        "$(kafka_tool_path kafka-server-start)" "$kafka_root/server.properties"
    local i attempt
    i="$(index_of kafka)"
    for attempt in $(seq 1 60); do
        port_in_use "$BROKER_PORT" && return 0
        kill -0 "${svc_pid[$i]}" 2>/dev/null || break
        sleep 1
    done
    show_log_tail "$i"
    fail "The Kafka broker did not start listening on 127.0.0.1:$BROKER_PORT."
}

# --- Main -----------------------------------------------------------------

check_toolchain
configure_auth
install_node_dependencies "$auth_dir" 'Auth Service'
install_node_dependencies "$client_ui_dir" 'Client UI'
install_node_dependencies "$reporting_ui_dir" 'Reporting UI'
[[ "$skip_reporting" == true ]] || ensure_reporting_environment
check_ports
check_database
[[ "$run_seed" == false ]] || seed_database

log_dir="$(mktemp -d "${TMPDIR:-/tmp}/trading-season.XXXXXX")"
printf '\nTrading Season local stack\n'
if [[ "$show_logs" == true ]]; then
    printf '  Logs stream below; they are also in %s\n\n' "$log_dir"
else
    printf '  Logs: %s (removed on exit; --show-logs streams them here)\n\n' "$log_dir"
fi

# Events need a broker, and reporting has nothing else: it reads Kafka, not the
# database. Use the broker already listening; otherwise start one from a Kafka
# distribution; otherwise run without events.
events_enabled=false
if port_in_use "$BROKER_PORT"; then
    events_enabled=true
    status_line ready Kafka "127.0.0.1:$BROKER_PORT (already running)"
elif [[ "$use_kafka" == true ]] && find_kafka_bin; then
    mkdir -p "$kafka_root"
    require_command java 'A JDK is required to run Kafka.'
    write_kafka_config
    status_line starting Kafka "broker from $kafka_bin"
    start_kafka_broker
    create_topics
    events_enabled=true
    status_line ready Kafka "127.0.0.1:$BROKER_PORT"
else
    status_line off Kafka "no broker on 127.0.0.1:$BROKER_PORT; events are off (see --kafka-home in --help)"
fi

# By address: a Kafka client may try IPv6 first for "localhost", and the broker
# listens on IPv4 only.
broker_address="127.0.0.1:$BROKER_PORT"

auth_env=(KAFKA_BOOTSTRAP_SERVERS="$broker_address" DB_PASSWORD="$SPRING_DATASOURCE_PASSWORD" DB_HOST="$db_host" DB_PORT="$db_port")
java_env=(SPRING_DATASOURCE_PASSWORD="$SPRING_DATASOURCE_PASSWORD"
          SPRING_DATASOURCE_URL="jdbc:postgresql://$db_host:$db_port/trading_season"
          KAFKA_BOOTSTRAP_SERVERS="$broker_address")
if [[ "$events_enabled" == false ]]; then
    # Without a broker the services would wait on one at every order.
    [[ -n "${EVENTS_ENABLED:-}" ]] || auth_env+=(EVENTS_ENABLED=false)
    [[ -n "${APP_EVENTS_ENABLED:-}" ]] || java_env+=(APP_EVENTS_ENABLED=false)
fi

start_service auth 'Auth Service' 3001 "$auth_dir" env "${auth_env[@]}" npm run start:dev
start_service holdings-and-trade 'Holdings and Trade' 8082 "$holdings_dir" env "${java_env[@]}" mvn spring-boot:run
start_service order-and-sell 'Order and Sell' 8081 "$order_dir" env "${java_env[@]}" mvn spring-boot:run

if [[ "$skip_reporting" == false ]]; then
    # No database setting: reporting is given a broker and nothing else. Both
    # processes run from the service directory, so they share its data/reporting.
    reporting_env=(AUTH_SERVICE_URL=http://localhost:3001 AUTH_JWT_ISSUER="$issuer" FLASK_ENV=development
                   REPORTING_SERVICE_HOST=127.0.0.1 SCHEDULER_INTERVAL_MINUTES="$report_interval"
                   KAFKA_BOOTSTRAP_SERVERS="$broker_address" PYTHONUNBUFFERED=1)
    start_service reporting 'Reporting Service' 8083 "$reporting_dir" env "${reporting_env[@]}" "$reporting_python" app.py
    if [[ "$events_enabled" == true ]]; then
        start_service reporting-consumer 'Reporting consumer' 0 "$reporting_dir" env "${reporting_env[@]}" "$reporting_python" consumer.py
    fi
else
    status_line skipped 'Reporting Service' 'the Reporting UI signs in but cannot load a report'
fi

start_service ui 'Client UI' 4200 "$client_ui_dir" npm start
# Serves on 4300 and proxies /auth to the Auth Service and /api/reporting to the
# Reporting Service, both started above.
start_service reporting-ui 'Reporting UI' 4300 "$reporting_ui_dir" npm start

printf '\nStarting services (the first start compiles the apps and can take a minute or two)...\n'

# The broker was reported above; everything else is waited for.
kafka_index="$(index_of kafka || true)"
[[ -z "$kafka_index" ]] || svc_ready[$kafka_index]=true
started_at=$SECONDS
announced=false
tick=0
while true; do
    for ((i = 0; i < ${#svc_name[@]}; i++)); do
        if ! kill -0 "${svc_pid[$i]}" 2>/dev/null; then
            [[ "$show_logs" == true ]] || show_log_tail "$i"
            fail "${svc_label[$i]} exited. Review its log above."
        fi
    done

    all_ready=true
    for ((i = 0; i < ${#svc_name[@]}; i++)); do
        [[ "${svc_ready[$i]}" == true ]] && continue
        if [[ "${svc_port[$i]}" == 0 ]] || port_in_use "${svc_port[$i]}"; then
            svc_ready[$i]=true
            if [[ "${svc_port[$i]}" == 0 ]]; then detail=running; else detail="http://localhost:${svc_port[$i]}"; fi
            status_line ready "${svc_label[$i]}" "$detail"
        else
            all_ready=false
        fi
    done

    if [[ "$show_logs" == false ]] && ((tick % 2 == 0)); then
        for ((i = 0; i < ${#svc_name[@]}; i++)); do echo_new_errors "$i"; done
    fi

    if [[ "$all_ready" == true && "$announced" == false ]]; then
        announced=true
        if [[ "$run_seed" == true && "$events_enabled" == true ]]; then
            republish_history
        elif [[ "$run_seed" == true ]]; then
            printf '[WARN] Kafka is off, so the database history was not published for reporting. Start a broker and rerun with --seed.\n' >&2
        fi
        printf '\nAll services ready in %ss. Press Ctrl+C to stop them.\n' "$((SECONDS - started_at))"
        if [[ "$events_enabled" == false ]]; then
            printf 'Events are off, so the Reporting UI shows nothing new.\n'
        elif [[ "$skip_reporting" == false ]]; then
            printf 'New activity reaches the reporting console within seconds and its report within %s minute(s). History written earlier needs db/tools/republish_history.py once.\n' "$report_interval"
        fi
    fi
    tick=$((tick + 1))
    sleep 1
done
