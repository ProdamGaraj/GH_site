#!/usr/bin/env bash
# =============================================================================
# Pull-based continuous deployment. Run every minute by the systemd timer
# visual-cms-autodeploy.timer (deploy/scripts/install.sh sets it up).
#
#   autodeploy.sh            deploy origin/$DEPLOY_BRANCH if it moved
#   autodeploy.sh --force    rebuild and redeploy the current commit, even if
#                            it was marked bad (manual "deploy now")
#
# One run:
#   1. git fetch; nothing new → exit.
#   2. Safety: right branch, no local edits to tracked files, fast-forward only,
#      optional "all GitHub checks green" (DEPLOY_REQUIRE_CI=1).
#   3. git merge --ff-only → docker compose build. Build fails → git back to
#      the previous commit; running containers were never touched.
#   4. DB dump (DEPLOY_PRE_BACKUP=1) → docker compose up --wait (healthchecks).
#      Unhealthy → rollback: previous commit, rebuild, up again.
#   5. A failed commit is remembered in .deploy/bad-commit and not retried
#      until a newer commit arrives (or --force).
#
# Pause:  touch visual-cms/.deploy/paused    Resume: rm visual-cms/.deploy/paused
# Logs:   journalctl -u visual-cms-autodeploy -f
# =============================================================================
LOG_TAG=autodeploy
# shellcheck source=lib.sh
source "$(dirname "$0")/lib.sh"

FORCE=0
[ "${1:-}" = "--force" ] && FORCE=1

STATE_DIR="$CMS_DIR/.deploy"
mkdir -p "$STATE_DIR"
# Without this check a missing flock would look like "lock held" → silent no-op.
command -v flock >/dev/null || die "flock is required (package util-linux)"
exec 9>"$STATE_DIR/lock"
flock -n 9 || {
  log "another deploy is running"
  exit 0
}

if [ -f "$STATE_DIR/paused" ] && [ "$FORCE" != 1 ]; then exit 0; fi

require_env_file
BRANCH=$(env_get DEPLOY_BRANCH master)
WAIT_TIMEOUT=$(env_get DEPLOY_WAIT_TIMEOUT 300)

# notify_once KEY TEXT — same problem every minute must not flood the chat.
notify_once() {
  local file="$STATE_DIR/notified-$1"
  shift
  [ "$(cat "$file" 2>/dev/null)" = "$*" ] && return 0
  printf '%s' "$*" >"$file"
  notify "$*"
}

# ci_status SHA → success | pending | failure (GitHub check runs of the commit).
ci_status() {
  local sha=$1 repo token json
  repo=$(env_get GITHUB_REPO)
  token=$(env_get GITHUB_TOKEN)
  [ -n "$repo" ] && [ -n "$token" ] || die "DEPLOY_REQUIRE_CI=1 needs GITHUB_REPO and GITHUB_TOKEN in .env"
  command -v jq >/dev/null || die "DEPLOY_REQUIRE_CI=1 needs jq"
  # Network/API trouble = "not known yet": try again next minute.
  json=$(curl -fsS -m 20 \
    -H "Authorization: Bearer $token" -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/$repo/commits/$sha/check-runs?per_page=100") || {
    echo pending
    return
  }
  jq -r '
    if .total_count == 0 then "pending"
    elif any(.check_runs[]; .status != "completed") then "pending"
    elif all(.check_runs[]; .conclusion == "success" or .conclusion == "skipped" or .conclusion == "neutral")
      then "success"
    else "failure" end' <<<"$json"
}

build_images() { compose build --quiet; }

start_stack() {
  prepare_host_dirs
  compose up -d --remove-orphans --wait --wait-timeout "$WAIT_TIMEOUT" || return 1
  # Healthchecks prove each container is alive; the smoke test proves nginx
  # routes to them. TLS validity is not its job (placeholder certs) → insecure.
  if [ "$(env_get DEPLOY_SMOKE 1)" = 1 ]; then
    SMOKE_INSECURE=1 bash "$DEPLOY_SCRIPTS_DIR/smoke.sh" || return 1
  fi
}

cd "$REPO_DIR" || exit 1

current_branch=$(git symbolic-ref --quiet --short HEAD || echo DETACHED)
if [ "$current_branch" != "$BRANCH" ]; then
  notify_once branch "auto-deploy stopped: checkout is on '$current_branch', expected '$BRANCH'"
  die "checkout is on '$current_branch', expected '$BRANCH'"
fi

git fetch --quiet --prune origin "$BRANCH"
local_sha=$(git rev-parse HEAD)
remote_sha=$(git rev-parse "origin/$BRANCH")
short=${remote_sha:0:8}

if [ "$FORCE" != 1 ]; then
  [ "$local_sha" = "$remote_sha" ] && exit 0
  [ "$(cat "$STATE_DIR/bad-commit" 2>/dev/null)" = "$remote_sha" ] && exit 0
fi

# Local edits to tracked files would be silently mixed into the deploy (or
# block the merge). Generated public-site files are skip-worktree (install.sh).
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  notify_once dirty "auto-deploy blocked: local changes on the server (git status). Commit them or 'git checkout -- <file>'."
  die "tracked files modified on the server: $(git status --porcelain --untracked-files=no | head -5 | tr '\n' ' ')"
fi

if ! git merge-base --is-ancestor HEAD "origin/$BRANCH"; then
  notify_once nonff "auto-deploy blocked: origin/$BRANCH is not a fast-forward of the server checkout (history rewritten?)"
  die "origin/$BRANCH ($short) is not a fast-forward of HEAD (${local_sha:0:8})"
fi

if [ "$(env_get DEPLOY_REQUIRE_CI 0)" = 1 ] && [ "$local_sha" != "$remote_sha" ]; then
  case $(ci_status "$remote_sha") in
  success) ;;
  pending)
    log "$short: CI not finished yet — waiting"
    exit 0
    ;;
  *)
    echo "$remote_sha" >"$STATE_DIR/bad-commit"
    notify "deploy of $short skipped: CI failed"
    die "$short: CI failed"
    ;;
  esac
fi

log "deploying ${local_sha:0:8} → $short"
git merge --ff-only --quiet "origin/$BRANCH"

# ---- build (old containers keep serving meanwhile)
if ! build_images; then
  git reset --hard --quiet "$local_sha"
  echo "$remote_sha" >"$STATE_DIR/bad-commit"
  notify "deploy $short FAILED at build — still running ${local_sha:0:8}"
  die "build failed; checkout reset to ${local_sha:0:8}"
fi

if [ "$(env_get DEPLOY_PRE_BACKUP 1)" = 1 ]; then
  bash "$DEPLOY_SCRIPTS_DIR/backup.sh" db || {
    git reset --hard --quiet "$local_sha"
    notify "deploy $short aborted: pre-deploy DB backup failed"
    die "pre-deploy backup failed; checkout reset to ${local_sha:0:8}"
  }
fi

# ---- switch
if start_stack; then
  rm -f "$STATE_DIR/bad-commit" "$STATE_DIR"/notified-*
  git rev-parse HEAD >"$STATE_DIR/deployed-commit"
  docker image prune -f >/dev/null || true
  log "deployed $short"
  notify "deployed $short: $(git log -1 --format=%s)"
  exit 0
fi

# ---- rollback
compose ps --format '{{.Service}}: {{.Status}}' >&2 || true
warn "$short is unhealthy — rolling back to ${local_sha:0:8}"
echo "$remote_sha" >"$STATE_DIR/bad-commit"
git reset --hard --quiet "$local_sha"
if build_images && start_stack; then
  notify "deploy $short FAILED healthchecks — rolled back to ${local_sha:0:8}"
  die "rolled back to ${local_sha:0:8}"
fi
notify "deploy $short FAILED and ROLLBACK FAILED — site needs manual attention"
die "rollback failed"
