#!/bin/sh
# ВНИМАНИЕ: намеренно без `set -e`.
#
# Раньше здесь стоял `set -e` и безусловный `npm install`. Любой сбой при старте
# контейнера — недоступный реестр, DNS, таймаут нативной сборки — обрывал скрипт
# до `exec`, контейнер падал, nginx отдавал 502, а в браузере это выглядело как
# «Network error» на форме логина. То есть синхронизация зависимостей, которая
# задумывалась удобством, была жёстким условием запуска CMS.
#
# Теперь она best-effort: не смогли обновить — стартуем на том, что есть.
# Если модуля действительно не хватает, сервер упадёт с внятным
# «Cannot find module …», и это честный диагноз вместо молчаливого 502.

STAMP=/app/node_modules/.deps-stamp

# Отпечаток объявленных зависимостей. package-lock.json учитываем, если он есть:
# он точнее отражает фактически установленное дерево.
deps_hash() {
  cat /app/package.json /app/package-lock.json 2>/dev/null | md5sum | cut -d' ' -f1
}

HASH=$(deps_hash)

# В dev-compose backend монтирует АНОНИМНЫЙ том /app/node_modules (чтобы нативные
# модули под Alpine не перетирались node_modules хоста). Том переживает пересборку
# образа и может ОТСТАВАТЬ от package.json — тогда бэкенд падает на старте.
# Штамп внутри тома говорит, для какого package.json этот том уже собран.
if [ -f "$STAMP" ] && [ "$(cat "$STAMP" 2>/dev/null)" = "$HASH" ]; then
  echo "[entrypoint] зависимости актуальны — npm install пропущен"
else
  echo "[entrypoint] npm install (синхронизация с package.json)…"
  if npm install --prefer-offline --no-audit --no-fund; then
    printf '%s' "$HASH" > "$STAMP" 2>/dev/null
    echo "[entrypoint] зависимости синхронизированы"
  else
    echo "[entrypoint] ВНИМАНИЕ: npm install не отработал (реестр/сеть/нативная сборка)." >&2
    echo "[entrypoint] Стартую на текущих node_modules — CMS не должна лежать из-за этого." >&2
  fi
fi

# Запускаем команду контейнера (CMD / docker-compose command), напр. npm run dev.
exec "$@"
