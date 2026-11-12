#!/usr/bin/env bash
# =============================================================================
# Restore from a backup directory made by backup.sh.
#
#   restore.sh <backup-dir> [--only db|media|site] [--yes]
#
# Replaces the CURRENT data of the chosen parts (all parts present in the
# directory by default). Application containers are stopped meanwhile.
# Take a fresh `backup.sh` first if the current data might still be needed.
# =============================================================================
LOG_TAG=restore
# shellcheck source=lib.sh
source "$(dirname "$0")/lib.sh"

usage() { die "usage: restore.sh <backup-dir> [--only db|media|site] [--yes]"; }

dir=""
only=""
assume_yes=0
while [ $# -gt 0 ]; do
  case $1 in
  --only)
    only=${2:-}
    shift 2 || usage
    ;;
  --yes) assume_yes=1 && shift ;;
  -*) usage ;;
  *) dir=$1 && shift ;;
  esac
done
[ -n "$dir" ] || usage
[ -d "$dir" ] || die "not a directory: $dir"
[[ $dir != *.partial ]] || die "$dir is an incomplete backup"
dir=$(cd "$dir" && pwd)
case $only in "" | db | media | site) ;; *) usage ;; esac

want() { [ -z "$only" ] || [ "$only" = "$1" ]; }

parts=""
want db && ls "$dir"/*.dump >/dev/null 2>&1 && parts="$parts db"
want media && [ -f "$dir/minio.tar.gz" ] && parts="$parts media"
want site && [ -f "$dir/public-site.tar.gz" ] && parts="$parts site"
[ -n "$parts" ] || die "nothing to restore from $dir${only:+ (--only $only)}"

require_env_file
pg_user=$(env_get POSTGRES_USER cms_user)

log "backup:  $dir"
[ -f "$dir/MANIFEST" ] && sed 's/^/         /' "$dir/MANIFEST"
log "restore:$parts"
if [ "$assume_yes" != 1 ]; then
  read -r -p "Current data of [$parts ] will be REPLACED. Type 'yes' to continue: " answer
  [ "$answer" = yes ] || die "cancelled"
fi

log "stopping application containers"
compose stop web backend estate-service news-service || true

if [[ $parts == *db* ]]; then
  compose up -d --wait postgres
  for dump in "$dir"/*.dump; do
    db=$(basename "$dump" .dump)
    if [ "$(compose exec -T postgres psql -U "$pg_user" -d postgres -tAc \
      "SELECT 1 FROM pg_database WHERE datname = '$db'")" != "1" ]; then
      compose exec -T postgres createdb -U "$pg_user" "$db"
    fi
    compose exec -T postgres pg_restore -U "$pg_user" -d "$db" \
      --clean --if-exists --no-owner --single-transaction <"$dump"
    log "restored database $db"
  done
fi

if [[ $parts == *media* ]]; then
  compose stop minio
  docker run --rm -i -v "$MINIO_VOLUME:/data" "$HELPER_IMAGE" \
    sh -c 'find /data -mindepth 1 -delete && tar -xzf - -C /data' <"$dir/minio.tar.gz"
  log "restored media"
fi

if [[ $parts == *site* ]]; then
  docker run --rm -i -v "$CMS_DIR:/w" "$HELPER_IMAGE" \
    sh -c 'mkdir -p /w/public-site && find /w/public-site -mindepth 1 -delete && tar -xzf - -C /w' \
    <"$dir/public-site.tar.gz"
  log "restored public-site"
fi

prepare_host_dirs
log "starting the stack"
compose up -d --wait
log "restore complete"
