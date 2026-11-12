#!/usr/bin/env bash
# =============================================================================
# One-time (idempotent) server setup for the production stack.
# Run as the deploy user (member of the "docker" group) from the git clone:
#
#   bash visual-cms/deploy/scripts/install.sh [--adopt-existing-data] [--no-systemd]
#
#   --adopt-existing-data  the Docker volumes already hold data from the
#                          dev/test stack (default passwords, built-in
#                          encryption key) → rotate them to the new .env secrets
#   --no-systemd           do not install the auto-deploy / backup timers
#
# Steps: checks → .env + secrets → volumes → TLS placeholder → git settings →
# build → (adopt) → start → systemd timers. See DEPLOY.md.
# =============================================================================
LOG_TAG=install
# shellcheck source=lib.sh
source "$(dirname "$0")/lib.sh"

ADOPT=0
SYSTEMD=1
for arg in "$@"; do
  case $arg in
  --adopt-existing-data) ADOPT=1 ;;
  --no-systemd) SYSTEMD=0 ;;
  *) die "unknown option $arg" ;;
  esac
done

STATE_DIR="$CMS_DIR/.deploy"
mkdir -p "$STATE_DIR"

# ---- 1. prerequisites
for bin in docker git openssl curl flock awk; do
  command -v "$bin" >/dev/null || die "'$bin' is not installed"
done
docker info >/dev/null 2>&1 || die "cannot talk to Docker — is the daemon running and is $(id -un) in the 'docker' group?"
compose_version=$(docker compose version --short 2>/dev/null || echo 0)
# --wait-timeout and service health in `up --wait` need Compose ≥ 2.20.
if ! printf '%s\n%s\n' 2.20.0 "${compose_version#v}" | sort -V -C; then
  die "docker compose $compose_version is too old (need ≥ 2.20) — install the docker-compose-plugin package"
fi

# ---- 2. .env
bash "$DEPLOY_SCRIPTS_DIR/secrets.sh" init
require_env_file
[ "$(env_get COMPOSE_FILE)" = "$PROD_COMPOSE_FILE" ] ||
  die "COMPOSE_FILE in .env is '$(env_get COMPOSE_FILE)', expected '$PROD_COMPOSE_FILE'"
domain=$(env_get SITE_DOMAIN)
[ -n "$domain" ] || die "set SITE_DOMAIN in .env"
log "domain: $domain"
if [ "$(env_get DEPLOY_REQUIRE_CI 0)" = 1 ]; then
  command -v jq >/dev/null || die "DEPLOY_REQUIRE_CI=1 needs jq"
fi

# ---- 3. data volumes (external: never removed by `docker compose down -v`)
existing=0
for vol in "$POSTGRES_VOLUME" "$MINIO_VOLUME"; do
  if docker volume inspect "$vol" >/dev/null 2>&1; then
    existing=1
  else
    docker volume create "$vol" >/dev/null
    log "created volume $vol"
  fi
done
if [ "$existing" = 1 ] && [ "$ADOPT" != 1 ] && [ ! -f "$STATE_DIR/installed" ]; then
  die "volumes $POSTGRES_VOLUME / $MINIO_VOLUME already exist. If they hold data of the dev/test stack, re-run with --adopt-existing-data (DEPLOY.md §4). If they are leftovers, remove them with 'docker volume rm' first."
fi

# ---- 4. TLS: a placeholder lets nginx start; replace it with a real
#         certificate (DEPLOY.md §5). Browsers ignore HSTS on invalid certs.
if [ ! -f "$CMS_DIR/ssl/server.crt" ] || [ ! -f "$CMS_DIR/ssl/server.key" ]; then
  mkdir -p "$CMS_DIR/ssl"
  openssl req -x509 -nodes -newkey rsa:2048 -days 30 -subj "/CN=$domain" \
    -keyout "$CMS_DIR/ssl/server.key" -out "$CMS_DIR/ssl/server.crt" 2>/dev/null
  chmod 600 "$CMS_DIR/ssl/server.key"
  warn "no certificate in ssl/ — generated a 30-day SELF-SIGNED placeholder; install a real one (DEPLOY.md §5)"
fi

# ---- 5. git: generated site files that are tracked must not block pulls
#         (a site deploy rewrites them on the server).
git -C "$REPO_DIR" ls-files -z -- "$CMS_DIR/public-site" |
  xargs -0 -r git -C "$REPO_DIR" update-index --skip-worktree --
log "tracked public-site files marked skip-worktree"

# ---- 6. build, adopt, start
prepare_host_dirs
log "building images (first build takes a few minutes)"
compose build
if [ "$ADOPT" = 1 ]; then
  log "adopting existing data"
  bash "$DEPLOY_SCRIPTS_DIR/secrets.sh" adopt
fi
compose up -d --remove-orphans --wait --wait-timeout 300
git -C "$REPO_DIR" rev-parse HEAD >"$STATE_DIR/deployed-commit"
touch "$STATE_DIR/installed"
log "stack is up and healthy"

# ---- 7. systemd timers
if [ "$SYSTEMD" = 1 ]; then
  command -v systemctl >/dev/null || die "systemd not found — re-run with --no-systemd and schedule autodeploy.sh/backup.sh yourself"
  user=$(id -un)
  for unit in "$DEPLOY_SCRIPTS_DIR"/../systemd/*; do
    sed -e "s#@USER@#$user#g" -e "s#@CMS_DIR@#$CMS_DIR#g" "$unit" |
      sudo tee "/etc/systemd/system/$(basename "$unit")" >/dev/null
  done
  sudo systemctl daemon-reload
  sudo systemctl enable --now docker.service
  sudo systemctl enable --now visual-cms-autodeploy.timer visual-cms-backup.timer
  log "timers enabled: visual-cms-autodeploy.timer (every minute), visual-cms-backup.timer (daily 03:30)"
fi

log "done. Next: real TLS certificate (DEPLOY.md §5), off-site backups (§7)."
