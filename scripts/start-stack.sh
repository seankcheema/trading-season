#!/usr/bin/env bash

set -Eeuo pipefail

readonly PROJECT_NAME="trading-season-local"
readonly WAIT_SECONDS=300

build=true
action="start"

ready() { printf '[READY] %s\n' "$*"; }
done_stage() { printf '[DONE] %s\n' "$*"; }
fail() { printf '[FAIL] %s\n' "$*" >&2; exit 1; }

usage() {
    cat <<'EOF'
Usage: ./scripts/start-stack.sh [options]

Starts the whole application in Docker: database, Kafka, the auth, order and
sell, holdings and trade, and reporting services, and both UIs. Works on macOS
and Linux. The only requirements are Docker with Compose v2 and Node.js, which
generates the development signing keys the first time.

Options:
  --no-build   Start from the images already built instead of rebuilding them
  --stop       Stop and remove the containers; database and report volumes are kept
  -h, --help   Show this help

The development signing keys are appended once to
infrastructure/docker-compose/.env, which git ignores. Set DB_PASSWORD,
JWT_ISSUER or CORS_ORIGINS in your environment or that file to override the
defaults in docker-compose.local.yml.
EOF
}

while (($#)); do
    case "$1" in
        --no-build) build=false; shift ;;
        --stop) action="stop"; shift ;;
        -h|--help) usage; exit 0 ;;
        *) fail "Unknown option: $1. Run with --help for usage." ;;
    esac
done

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
compose_dir="$repo_root/infrastructure/docker-compose"
compose_file="$compose_dir/docker-compose.local.yml"
env_file="$compose_dir/.env"

# The project name keeps these containers and volumes apart from the Jenkins
# copy of the stack. Compose reads .env from the directory of the -f file.
compose() {
    docker compose --project-name "$PROJECT_NAME" -f "$compose_file" "$@"
}

check_docker() {
    command -v docker >/dev/null 2>&1 || fail 'docker was not found. Install Docker Desktop (macOS) or Docker Engine and Compose v2.'
    docker compose version >/dev/null 2>&1 || fail 'Docker Compose v2 is unavailable. Install the docker compose plugin.'
    docker info >/dev/null 2>&1 || fail 'The Docker daemon is not running. Start Docker Desktop or Docker Engine and try again.'
    ready 'Docker - the daemon and Compose v2 are available.'
}

port_in_use() {
    local port="$1"
    if command -v lsof >/dev/null 2>&1; then
        lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
    else
        (echo >/dev/tcp/127.0.0.1/"$port") >/dev/null 2>&1
    fi
}

# A port held by something other than this stack makes `compose up` fail
# part-way, after it has built the images. Say so first. Skipped when the stack
# already has containers, since then the ports are expected to be ours.
check_ports() {
    if [[ -n "$(compose ps -q 2>/dev/null)" ]]; then
        return
    fi
    local busy="" port
    for port in 5432 29092 3001 4200 4300 8081 8082 8083; do
        if port_in_use "$port"; then
            busy="$busy $port"
        fi
    done
    if [[ -n "$busy" ]]; then
        fail "Port(s)$busy are already in use by another process (5432 is usually a local PostgreSQL). Stop it, or use a different setup path from the README."
    fi
    ready 'Ports - 5432, 29092, 3001, 4200, 4300, 8081, 8082 and 8083 are free.'
}

ensure_keys() {
    if [[ -f "$env_file" ]] && grep -q '^JWT_PRIVATE_KEY=' "$env_file" && grep -q '^JWT_PUBLIC_KEY=' "$env_file"; then
        ready 'Signing keys - already present in infrastructure/docker-compose/.env; skipping.'
        return
    fi
    command -v node >/dev/null 2>&1 || fail 'node was not found. It is needed once to generate the development signing keys.'
    local keys
    keys="$(node "$repo_root/apps/auth-service/scripts/generate-dev-keys.mjs")" || fail 'Could not generate the development signing keys.'
    # Keep a half-written pair from ever being appended: a partial entry would
    # stop the check above from regenerating and break the auth service.
    printf '%s\n' "$keys" | grep -q '^JWT_PRIVATE_KEY=' && printf '%s\n' "$keys" | grep -q '^JWT_PUBLIC_KEY=' || \
        fail 'The key generator did not print both keys. Nothing was written.'
    printf '%s\n' "$keys" >> "$env_file"
    done_stage 'Signing keys - generated and appended to infrastructure/docker-compose/.env.'
}

wait_for_url() {
    local label="$1" url="$2" deadline
    deadline=$((SECONDS + WAIT_SECONDS))
    while ((SECONDS < deadline)); do
        if curl -fsS -o /dev/null --max-time 3 "$url" 2>/dev/null; then
            ready "$label - $url"
            return 0
        fi
        sleep 3
    done
    printf '[FAIL] %s did not answer at %s within %s seconds.\n' "$label" "$url" "$WAIT_SECONDS" >&2
    return 1
}

start_stack() {
    check_docker
    command -v curl >/dev/null 2>&1 || fail 'curl was not found. It is used to wait for the services.'
    check_ports
    ensure_keys

    local up_args=(-d)
    [[ "$build" == true ]] && up_args+=(--build)
    compose up "${up_args[@]}" || fail 'Docker Compose could not start the stack. Review the output above.'

    local failed=false
    wait_for_url 'Auth Service' 'http://localhost:3001/.well-known/jwks.json' || failed=true
    wait_for_url 'Order and Sell Service' 'http://localhost:8081/v3/api-docs' || failed=true
    wait_for_url 'Holdings and Trade Service' 'http://localhost:8082/v3/api-docs' || failed=true
    wait_for_url 'Reporting Service' 'http://localhost:8083/health' || failed=true
    wait_for_url 'Client UI' 'http://localhost:4200' || failed=true
    wait_for_url 'Reporting UI' 'http://localhost:4300' || failed=true
    if [[ "$failed" == true ]]; then
        compose ps >&2 || true
        fail "Not every service came up. Read a service's log with: docker compose --project-name $PROJECT_NAME -f infrastructure/docker-compose/docker-compose.local.yml logs <service>"
    fi

    done_stage 'The stack is running.'
    cat <<'EOF'

  Client UI      http://localhost:4200
  Reporting UI   http://localhost:4300
  Swagger        http://localhost:3001/api/docs (auth), :8081 and :8082 /swagger-ui.html, :8083/docs

  Development sign-ins are listed in the README. Stop with: ./scripts/start-stack.sh --stop
EOF
}

stop_stack() {
    check_docker
    compose down || fail 'Docker Compose could not stop the stack.'
    done_stage 'The stack is stopped. Database and report volumes were kept.'
}

if [[ "$action" == stop ]]; then
    stop_stack
else
    start_stack
fi
