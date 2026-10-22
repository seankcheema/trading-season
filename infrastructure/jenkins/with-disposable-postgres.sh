#!/bin/sh
# Runs a check against a fresh database owned only by that invocation.
set -eu
name="trading-season-check-$(printf '%s' "${BUILD_TAG:-local}-$$" | sha256sum | cut -c1-16)"
cleanup() {
    docker rm -fv "$name" >/dev/null 2>&1 || true
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
docker run -d --rm --name "$name" \
    -e POSTGRES_USER=ci_test -e POSTGRES_PASSWORD=ci_test -e POSTGRES_DB=ci_test \
    -p 127.0.0.1::5432 postgres:16-alpine >/dev/null
attempt=1
until docker exec "$name" pg_isready -U ci_test -d ci_test >/dev/null 2>&1; do
    if [ "$attempt" -ge 60 ]; then
        docker logs "$name" >&2
        echo 'Disposable PostgreSQL did not become ready.' >&2
        exit 1
    fi
    attempt=$((attempt + 1))
    sleep 1
done
port=$(docker port "$name" 5432/tcp | awk -F: '{print $NF}')
# The port is published on the Docker host's loopback. A process inside the Jenkins container
# (which reaches Docker through the mounted socket) has its own loopback, so it must go through
# the host alias instead. Containers started with --network host share the host's loopback and
# keep using 127.0.0.1 (the migration URL below).
host=127.0.0.1
if [ -f /.dockerenv ] && getent hosts host.docker.internal >/dev/null 2>&1; then
    host=host.docker.internal
fi
export ORDER_TEST_DISPOSABLE_POSTGRES_URL="jdbc:postgresql://$host:$port/ci_test"
export ORDER_TEST_POSTGRES_USER=ci_test ORDER_TEST_POSTGRES_PASSWORD=ci_test
export EXECUTION_MIGRATION_DISPOSABLE_DATABASE_URL="postgresql://ci_test:ci_test@127.0.0.1:$port/ci_test"
"$@"
