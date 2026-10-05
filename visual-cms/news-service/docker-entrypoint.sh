#!/bin/sh
set -e

# Синхронизация зависимостей на старте (анонимный том /app/node_modules в
# dev-compose может отставать от package.json). Idempotent, из кэша.
echo "[entrypoint] npm install (sync deps with package.json)…"
npm install --prefer-offline --no-audit --no-fund

exec "$@"
