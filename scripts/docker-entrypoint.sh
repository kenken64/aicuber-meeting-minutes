#!/bin/sh
set -eu

db_path=${MINUTES_DB_PATH:-/data/minutes.sqlite}
db_directory=$(dirname "$db_path")
mkdir -p "$db_directory"

if [ "$(id -u)" = "0" ]; then
  chown node:node "$db_directory"
  for file in "$db_path" "$db_path-wal" "$db_path-shm"; do
    if [ -f "$file" ]; then chown node:node "$file"; fi
  done
  exec gosu node "$@"
fi

exec "$@"
