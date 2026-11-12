#!/usr/bin/env bash
# =============================================================================
# Backup of the stack's data (everything that is NOT in git).
#
#   backup.sh          full: 3 databases + MinIO media + published site
#   backup.sh db       databases only (auto-deploy runs this before each deploy)
#
# Result: $BACKUP_DIR/<YYYYmmdd-HHMMSS>-<full|db>/ with
#   visual_cms.dump estate.dump news.dump   pg_dump custom format
#   minio.tar.gz                            MinIO volume (full only)
#   public-site.tar.gz                      published HTML (full only)
#   MANIFEST                                git commit, sizes
# A run writes into "<name>.partial" and renames it only when complete, so a
# directory without the suffix is always a complete backup.
#
# Retention: BACKUP_KEEP_DAYS (default 14) for whole directories,
# BACKUP_MEDIA_KEEP_DAYS (default 7) for minio.tar.gz inside them.
# Off-site: BACKUP_RCLONE_REMOTE (rclone remote:path) — strongly recommended.
# Works with any stack whose services are named postgres/minio (dev, test, prod).
# =============================================================================
LOG_TAG=backup
# shellcheck source=lib.sh
source "$(dirname "$0")/lib.sh"

KIND=${1:-full}
case $KIND in full | db) ;; *) die "usage: backup.sh [full|db]" ;; esac

require_env_file
backup_root=$(env_get BACKUP_DIR backups)
[[ $backup_root == /* ]] || backup_root="$CMS_DIR/$backup_root"
keep_days=$(env_get BACKUP_KEEP_DAYS 14)
media_keep_days=$(env_get BACKUP_MEDIA_KEEP_DAYS 7)
pg_user=$(env_get POSTGRES_USER cms_user)
mkdir -p "$backup_root"

command -v flock >/dev/null || die "flock is required (package util-linux)"
exec 8>"$backup_root/.lock"
flock -w 600 8 || die "another backup is still running"

# Unique even for two runs in the same second (a manual backup next to a
# pre-deploy dump): otherwise the final rename would hit an existing directory.
stamp=$(date +%Y%m%d-%H%M%S)
name="$stamp-$KIND"
n=1
while [ -e "$backup_root/$name" ] || [ -e "$backup_root/$name.partial" ]; do
  n=$((n + 1))
  name="$stamp-$n-$KIND"
done
work="$backup_root/$name.partial"
mkdir -p "$work"
trap 'rm -rf "$work"; notify "backup $KIND FAILED (see journalctl -u visual-cms-backup)"' ERR

db_exists() {
  [ "$(compose exec -T postgres psql -U "$pg_user" -d postgres -tAc \
    "SELECT 1 FROM pg_database WHERE datname = '$1'")" = "1" ]
}

for db in $DATABASES; do
  if db_exists "$db"; then
    compose exec -T postgres pg_dump -U "$pg_user" -Fc "$db" >"$work/$db.dump"
    log "dumped $db ($(du -h "$work/$db.dump" | cut -f1))"
  else
    warn "database $db does not exist — skipped"
  fi
done

if [ "$KIND" = full ]; then
  # Objects are written once and never modified, so a live copy is consistent
  # enough; stopping MinIO would take the site's images down.
  docker run --rm -v "$MINIO_VOLUME:/data:ro" "$HELPER_IMAGE" tar -czf - -C /data . >"$work/minio.tar.gz"
  log "archived media ($(du -h "$work/minio.tar.gz" | cut -f1))"
  tar -czf "$work/public-site.tar.gz" -C "$CMS_DIR" public-site
  log "archived public-site ($(du -h "$work/public-site.tar.gz" | cut -f1))"
fi

{
  echo "created: $(date -Iseconds)"
  echo "kind: $KIND"
  echo "host: $(hostname)"
  echo "commit: $(git -C "$REPO_DIR" rev-parse HEAD 2>/dev/null || echo unknown)"
  (cd "$work" && du -h -- *)
} >"$work/MANIFEST"

# -T: rename exactly, never move into an existing directory of that name.
mv -T "$work" "$backup_root/$name"
trap - ERR
log "backup complete: $backup_root/$name"

# ---- retention (only complete backups match these patterns)
find "$backup_root" -mindepth 2 -maxdepth 2 -name minio.tar.gz -mtime +"$media_keep_days" -delete
find "$backup_root" -mindepth 1 -maxdepth 1 -type d -name '*-full' -mtime +"$keep_days" -exec rm -rf {} +
find "$backup_root" -mindepth 1 -maxdepth 1 -type d -name '*-db' -mtime +"$keep_days" -exec rm -rf {} +
# Leftovers of killed runs.
find "$backup_root" -mindepth 1 -maxdepth 1 -type d -name '*.partial' -mmin +720 -exec rm -rf {} +

# ---- off-site copy
remote=$(env_get BACKUP_RCLONE_REMOTE)
if [ -n "$remote" ]; then
  command -v rclone >/dev/null || die "BACKUP_RCLONE_REMOTE is set but rclone is not installed"
  if rclone copy "$backup_root/$name" "$remote/$name"; then
    log "copied to $remote/$name"
  else
    notify "backup $name: OFF-SITE COPY FAILED (local copy is fine)"
    die "rclone copy failed"
  fi
fi
