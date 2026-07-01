#!/bin/sh
set -e

# Синхронизация зависимостей на старте контейнера.
#
# В dev-compose backend монтирует АНОНИМНЫЙ том /app/node_modules (чтобы нативные
# модули под Alpine не перетирались node_modules хоста). Этот том переживает
# пересборку образа и может ОТСТАВАТЬ от package.json — тогда бэкенд падает на
# старте («Cannot find module …»). Чтобы это не повторялось, при каждом запуске
# приводим node_modules в соответствие с package.json (idempotent, из кэша).
echo "[entrypoint] npm install (sync deps with package.json)…"
npm install --prefer-offline --no-audit --no-fund

# Запускаем команду контейнера (CMD / docker-compose command), напр. npm run dev.
exec "$@"
