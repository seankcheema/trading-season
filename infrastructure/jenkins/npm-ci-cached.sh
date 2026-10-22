#!/bin/sh
# Installs one npm project's dependencies, reusing a node_modules archive from an
# earlier build when package-lock.json and the Node runtime are unchanged.
# Usage: npm-ci-cached.sh <project-dir>
#
# The Jenkins workspace is deleted after every build, so npm ci would otherwise
# rebuild node_modules from scratch each time. Only the newest archive per project
# is kept, so the cache stays at one copy of node_modules per project. A cache that
# cannot be read or written never fails the build: the script falls back to npm ci.
set -eu

[ $# -eq 1 ] || { echo "Usage: $0 <project-dir>" >&2; exit 2; }
project="$1"
[ -f "$project/package-lock.json" ] || { echo "$project has no package-lock.json." >&2; exit 1; }

name="$(basename "$project")"
cache_root="${NODE_MODULES_CACHE:-${HOME:-/tmp}/.cache/trading-season/node_modules}"
runtime="$(node -p "process.version + '-' + process.platform + '-' + process.arch")"
lock_hash="$(sha256sum "$project/package-lock.json" | cut -c1-16)"
archive="$cache_root/$name-$lock_hash-$runtime.tar"

if [ -f "$archive" ]; then
    rm -rf "$project/node_modules"
    if tar -xf "$archive" -C "$project"; then
        echo "Restored $name node_modules from $archive."
        exit 0
    fi
    echo "Could not read $archive; installing from the lockfile." >&2
    rm -f "$archive"
fi

npm --prefix "$project" ci

partial="$archive.$$.partial"
if mkdir -p "$cache_root" && tar -cf "$partial" -C "$project" node_modules && mv "$partial" "$archive"; then
    for old in "$cache_root/$name-"*.tar; do
        [ "$old" = "$archive" ] || rm -f "$old"
    done
    echo "Cached $name node_modules at $archive."
else
    rm -f "$partial"
    echo "Could not cache $name node_modules; continuing without a cache." >&2
fi
