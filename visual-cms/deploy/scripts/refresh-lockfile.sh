#!/usr/bin/env bash
# =============================================================================
# Refresh the package-lock.json of one or more packages after changing their
# package.json:
#
#   bash deploy/scripts/refresh-lockfile.sh frontend backend
#
# Why a script: frontend/ and backend/ are npm workspaces of visual-cms/, so
# `npm install` inside them updates only the ROOT lockfile. The production
# images and CI build each package on its own with `npm ci` from ITS lockfile,
# which then fails as "not in sync". This resolves the package alone (outside
# the workspace) with the same Node image as the Dockerfiles, keeping every
# version already pinned that still satisfies package.json.
# Needs Docker; works from Git Bash on Windows too.
# =============================================================================
LOG_TAG=lockfile
# shellcheck source=lib.sh
source "$(dirname "$0")/lib.sh"

# Must match deploy/node/Dockerfile and deploy/web/Dockerfile (npm version
# decides the lockfile format).
NODE_IMAGE="node:20-alpine"

[ "$#" -gt 0 ] || die "usage: refresh-lockfile.sh PACKAGE_DIR… (e.g. frontend backend estate-service news-service)"

# Docker Desktop on Windows needs a Windows path for -v.
host_path() {
  if command -v cygpath >/dev/null; then cygpath -w "$1"; else printf '%s' "$1"; fi
}

for pkg in "$@"; do
  dir="$CMS_DIR/$pkg"
  [ -f "$dir/package.json" ] || die "$dir/package.json not found"
  work=$(mktemp -d)
  cp "$dir/package.json" "$work/"
  [ -f "$dir/package-lock.json" ] && cp "$dir/package-lock.json" "$work/"
  MSYS_NO_PATHCONV=1 docker run --rm -e NPM_CONFIG_UPDATE_NOTIFIER=false \
    -v "$(host_path "$work"):/pkg" -w /pkg "$NODE_IMAGE" \
    npm install --package-lock-only --ignore-scripts --no-audit --no-fund >/dev/null ||
    die "$pkg: npm could not resolve package.json"
  if [ -f "$dir/package-lock.json" ] && cmp -s "$work/package-lock.json" "$dir/package-lock.json"; then
    log "$pkg: already up to date"
  else
    cp "$work/package-lock.json" "$dir/package-lock.json"
    log "$pkg: package-lock.json updated — commit it"
  fi
  rm -rf "$work"
done
