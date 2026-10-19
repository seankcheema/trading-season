#!/bin/sh
# Runs mvn with the given arguments and runs it again when it fails only
# because an artifact could not be downloaded (Maven Central answers 502/503
# now and then). Any other failure, such as a failing test, stops at once.
set -u

attempts=3
log="$(mktemp)"
status_file="$(mktemp)"
trap 'rm -f "$log" "$status_file"' EXIT

attempt=1
while :; do
    { mvn "$@" 2>&1; echo "$?" > "$status_file"; } | tee "$log"
    status="$(cat "$status_file")"
    [ "$status" -eq 0 ] && exit 0

    if [ "$attempt" -lt "$attempts" ] && grep -Eq 'Could not transfer artifact|Could not resolve dependencies|Plugin .* or one of its dependencies could not be resolved' "$log" \
        && grep -Eq 'status code: (429|5[0-9][0-9])|Connection reset|Connect timed out|Read timed out|Premature end of Content-Length' "$log"; then
        echo "Maven could not download an artifact (attempt $attempt of $attempts); retrying in $((attempt * 15))s." >&2
        sleep "$((attempt * 15))"
        attempt=$((attempt + 1))
        continue
    fi
    exit "$status"
done
