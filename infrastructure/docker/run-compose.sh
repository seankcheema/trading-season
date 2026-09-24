#!/bin/sh

set -eu

if docker compose version >/dev/null 2>&1; then
    exec docker compose "$@"
fi

if command -v docker-compose >/dev/null 2>&1; then
    # The service Dockerfiles use BuildKit cache mounts. Compose v2 builds with
    # BuildKit by default; the legacy command needs it requested explicitly.
    export DOCKER_BUILDKIT=1 COMPOSE_DOCKER_CLI_BUILD=1
    exec docker-compose "$@"
fi

echo "Docker Compose is unavailable; install either the Docker Compose v2 plugin or the docker-compose command." >&2
exit 127
