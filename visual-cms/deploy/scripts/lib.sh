#!/usr/bin/env bash
# =============================================================================
# Shared helpers for deploy/scripts/*.sh — source it, do not run it.
# =============================================================================
# Constants below are used by the scripts that source this file.
# shellcheck disable=SC2034
set -Eeuo pipefail

DEPLOY_SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CMS_DIR="$(cd "$DEPLOY_SCRIPTS_DIR/../.." && pwd)" # visual-cms/
REPO_DIR="$(cd "$CMS_DIR/.." && pwd)"              # git root
# Override only for tests (deploy/scripts/test/).
ENV_FILE="${VISUAL_CMS_ENV_FILE:-$CMS_DIR/.env}"
PROD_COMPOSE_FILE="docker-compose.production.yml"
# uid of the `node` user in the service images (deploy/node/Dockerfile).
NODE_UID=1000
HELPER_IMAGE="alpine:3.20"
POSTGRES_VOLUME="visual-cms_postgres-data"
MINIO_VOLUME="visual-cms_minio-data"
DATABASES="visual_cms estate news"

log() { printf '%s [%s] %s\n' "$(date '+%F %T')" "${LOG_TAG:-deploy}" "$*"; }
warn() { log "WARN: $*" >&2; }
die() {
  log "ERROR: $*" >&2
  exit 1
}

# env_get KEY [DEFAULT] — value from .env WITHOUT sourcing it (no shell eval of
# secrets). Empty or missing → DEFAULT. Last occurrence wins, like compose.
env_get() {
  local key=$1 default=${2-} value=""
  if [ -f "$ENV_FILE" ]; then
    value=$(grep -E "^${key}=" "$ENV_FILE" | tail -n 1 | cut -d= -f2- | tr -d '\r' || true)
  fi
  if [ -n "$value" ]; then printf '%s' "$value"; else printf '%s' "$default"; fi
}

# env_set KEY VALUE — replace every KEY= line (or append), atomically, mode 600.
env_set() {
  local key=$1 value=$2 tmp
  tmp=$(mktemp "$ENV_FILE.XXXXXX")
  if grep -qE "^${key}=" "$ENV_FILE"; then
    K="$key" V="$value" awk 'index($0, ENVIRON["K"] "=") == 1 { print ENVIRON["K"] "=" ENVIRON["V"]; next } { print }' \
      "$ENV_FILE" >"$tmp"
  else
    cat "$ENV_FILE" >"$tmp"
    printf '%s=%s\n' "$key" "$value" >>"$tmp"
  fi
  chmod 600 "$tmp"
  mv "$tmp" "$ENV_FILE"
}

random_hex() { openssl rand -hex "${1:-32}"; }

require_env_file() {
  [ -f "$ENV_FILE" ] || die "$ENV_FILE not found (cp .env.example .env && deploy/scripts/secrets.sh init)"
  [ -n "$(env_get COMPOSE_FILE)" ] ||
    die "COMPOSE_FILE is not set in .env — plain 'docker compose' would start the DEV stack"
}

# docker compose in visual-cms/ — picks COMPOSE_FILE and variables from .env.
compose() { (cd "$CMS_DIR" && docker compose "$@"); }

# Host dirs the stack bind-mounts. The backend runs as uid 1000 and writes the
# published site into ./public-site; files left by the dev stack (root) or by
# hand-copying would make site deploys fail with EACCES.
prepare_host_dirs() {
  mkdir -p "$CMS_DIR/public-site" "$CMS_DIR/map-assets" "$CMS_DIR/ssl" "$CMS_DIR/certbot-www"
  docker run --rm -v "$CMS_DIR/public-site:/d" "$HELPER_IMAGE" \
    chown -R "$NODE_UID:$NODE_UID" /d
}

# notify "text" — Telegram message if NOTIFY_TELEGRAM_* are set; never fails.
notify() {
  local token chat
  token=$(env_get NOTIFY_TELEGRAM_BOT_TOKEN)
  chat=$(env_get NOTIFY_TELEGRAM_CHAT_ID)
  [ -n "$token" ] && [ -n "$chat" ] || return 0
  curl -fsS -m 10 -o /dev/null \
    --data-urlencode "chat_id=$chat" \
    --data-urlencode "text=[$(hostname)] $*" \
    "https://api.telegram.org/bot$token/sendMessage" || warn "telegram notification failed"
}
