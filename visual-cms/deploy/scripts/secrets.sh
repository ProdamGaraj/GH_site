#!/usr/bin/env bash
# =============================================================================
# Secrets of the production stack (visual-cms/.env).
#
#   secrets.sh init                 fill every EMPTY secret in .env with a random value
#   secrets.sh adopt                existing data from the dev/test stack → new secrets
#                                   (DB role password, data-source credentials, admin)
#   secrets.sh rotate NAME… | all   generate new value(s) and apply them to the stack
#   secrets.sh apply-db-password    set the Postgres role password to POSTGRES_PASSWORD
#   secrets.sh reencrypt OLD_KEY    re-encrypt data-source credentials from OLD_KEY
#                                   ("dev-fallback" = built-in dev key) to ENCRYPTION_KEY
#   secrets.sh admin                set ADMIN_PASSWORD for ADMIN_USERNAME in the CMS
#
# Every change of .env is preceded by a copy .env.bak-<timestamp> (mode 600).
# =============================================================================
LOG_TAG=secrets
# shellcheck source=lib.sh
source "$(dirname "$0")/lib.sh"

# name → random length in bytes (hex output is twice as long).
declare -A SECRET_BYTES=(
  [POSTGRES_PASSWORD]=32
  [REDIS_PASSWORD]=32
  [MINIO_ROOT_PASSWORD]=32
  [JWT_SECRET]=48
  [ENCRYPTION_KEY]=32
  [ESTATE_WRITE_TOKEN]=32
  [NEWS_WRITE_TOKEN]=32
  [ADMIN_PASSWORD]=12
)
SECRET_ORDER="POSTGRES_PASSWORD REDIS_PASSWORD MINIO_ROOT_PASSWORD JWT_SECRET ENCRYPTION_KEY ESTATE_WRITE_TOKEN NEWS_WRITE_TOKEN ADMIN_PASSWORD"

backup_env() {
  local copy
  copy="$ENV_FILE.bak-$(date +%Y%m%d-%H%M%S)"
  cp -p "$ENV_FILE" "$copy"
  chmod 600 "$copy"
  log "saved previous .env to $(basename "$copy")"
}

cmd_init() {
  if [ ! -f "$ENV_FILE" ]; then
    cp "$CMS_DIR/.env.example" "$ENV_FILE"
    log "created .env from .env.example — review SITE_DOMAIN and the integrations"
  fi
  chmod 600 "$ENV_FILE"
  local name generated=""
  for name in $SECRET_ORDER; do
    if [ -z "$(env_get "$name")" ]; then
      env_set "$name" "$(random_hex "${SECRET_BYTES[$name]}")"
      generated="$generated $name"
    fi
  done
  if [ -n "$generated" ]; then
    log "generated:$generated"
    log "store a copy of .env in a password manager (ENCRYPTION_KEY loss = credentials loss)"
  else
    log "all secrets already set — nothing generated"
  fi
}

cmd_apply_db_password() {
  require_env_file
  local user password
  user=$(env_get POSTGRES_USER cms_user)
  password=$(env_get POSTGRES_PASSWORD)
  [ -n "$password" ] || die "POSTGRES_PASSWORD is empty"
  compose up -d --wait postgres
  # Local socket inside the container is trusted → works whatever the old
  # password was. psql variables quote the values safely.
  compose exec -T postgres psql -v ON_ERROR_STOP=1 -q -U "$user" -d postgres \
    -v role="$user" -v pw="$password" <<'SQL'
ALTER ROLE :"role" WITH PASSWORD :'pw';
SQL
  log "Postgres role '$user' password updated"
}

cmd_reencrypt() {
  require_env_file
  local old=${1:-}
  [ -n "$old" ] || die "usage: secrets.sh reencrypt <old-key|dev-fallback>"
  compose up -d --wait postgres
  # Passed via the environment, not argv (not visible in `ps`).
  OLD_ENCRYPTION_KEY="$old" compose run --rm --no-deps -e OLD_ENCRYPTION_KEY \
    backend node dist/scripts/rotate-encryption-key.js
}

cmd_admin() {
  require_env_file
  compose up -d --wait postgres
  compose run --rm --no-deps backend node dist/scripts/seed-admin.js --reset-password
  log "CMS user '$(env_get ADMIN_USERNAME admin)' now has the password from .env (ADMIN_PASSWORD)"
}

# Existing volumes from the dev/test stack were created with public defaults
# (cms_password, minioadmin, built-in encryption key). After `init` put new
# values into .env, make the data match them.
cmd_adopt() {
  require_env_file
  cmd_apply_db_password
  cmd_reencrypt dev-fallback
  cmd_admin
  log "existing data adopted; MinIO and Redis take the new credentials on start"
}

# services_for NAME — containers that must be recreated after NAME changes.
services_for() {
  case $1 in
  POSTGRES_PASSWORD) echo "backend estate-service news-service" ;;
  REDIS_PASSWORD) echo "redis backend" ;;
  MINIO_ROOT_PASSWORD) echo "minio backend" ;;
  JWT_SECRET | ENCRYPTION_KEY | ADMIN_PASSWORD) echo "backend" ;;
  ESTATE_WRITE_TOKEN) echo "estate-service backend web" ;;
  NEWS_WRITE_TOKEN) echo "news-service backend web" ;;
  *) return 1 ;;
  esac
}

rotate_one() {
  local name=$1 old new
  services_for "$name" >/dev/null || die "unknown secret '$name' (known: $SECRET_ORDER)"
  old=$(env_get "$name")
  new=$(random_hex "${SECRET_BYTES[$name]}")
  env_set "$name" "$new"
  case $name in
  POSTGRES_PASSWORD)
    cmd_apply_db_password
    ;;
  ENCRYPTION_KEY)
    # Re-encrypt BEFORE the backend restarts with the new key; on failure put
    # the old key back so the running data stays readable.
    if ! cmd_reencrypt "${old:-dev-fallback}"; then
      env_set "$name" "$old"
      die "re-encryption failed — ENCRYPTION_KEY restored, nothing changed"
    fi
    ;;
  ADMIN_PASSWORD)
    cmd_admin
    ;;
  esac
  # shellcheck disable=SC2046 # word splitting of the service list is intended
  compose up -d --wait $(services_for "$name")
  log "rotated $name"
}

cmd_rotate() {
  require_env_file
  [ $# -gt 0 ] || die "usage: secrets.sh rotate NAME… | all"
  local names="$*"
  [ "$names" = "all" ] && names=$SECRET_ORDER
  backup_env
  local name
  for name in $names; do rotate_one "$name"; done
  [[ " $names " == *" JWT_SECRET "* ]] && log "JWT_SECRET changed: every CMS user has to log in again"
  return 0
}

main() {
  local cmd=${1:-}
  shift || true
  case $cmd in
  init) cmd_init ;;
  adopt) cmd_adopt ;;
  rotate) cmd_rotate "$@" ;;
  apply-db-password) cmd_apply_db_password ;;
  reencrypt) cmd_reencrypt "$@" ;;
  admin) cmd_admin ;;
  *) sed -n '2,16p' "$0" | sed 's/^# \{0,1\}//' && exit 1 ;;
  esac
}

main "$@"
