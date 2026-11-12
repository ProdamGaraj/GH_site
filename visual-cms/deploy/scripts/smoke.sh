#!/usr/bin/env bash
# =============================================================================
# End-to-end smoke test of a running production stack, through nginx exactly
# like a browser (requests are pinned to this host via curl --resolve, so DNS
# does not matter).
#
#   smoke.sh            routing, CMS, API auth, admin proxies, media, news feed
#   smoke.sh --login    also logs in as ADMIN_USERNAME/ADMIN_PASSWORD from .env and
#                       checks that nginx injects the estate/news write tokens
#
# Used by: CI (--login), autodeploy.sh after every deploy (without --login, so
# a changed admin password can never trigger a rollback), humans after install.
# SMOKE_HOST=1.2.3.4 tests another host; SMOKE_INSECURE=1 accepts self-signed TLS.
# =============================================================================
LOG_TAG=smoke
# shellcheck source=lib.sh
source "$(dirname "$0")/lib.sh"

LOGIN=0
[ "${1:-}" = "--login" ] && LOGIN=1

require_env_file
domain=$(env_get SITE_DOMAIN)
[ -n "$domain" ] || die "SITE_DOMAIN is not set"
host=${SMOKE_HOST:-127.0.0.1}
http_port=$(env_get HTTP_PORT 80)
https_port=$(env_get HTTPS_PORT 443)
base="https://$domain:$https_port"

jar=$(mktemp)
trap 'rm -f "$jar"' EXIT
curl_opts=(-sS -m 20 --resolve "$domain:$https_port:$host" --resolve "$domain:$http_port:$host"
  -b "$jar" -c "$jar")
[ "${SMOKE_INSECURE:-0}" = 1 ] && curl_opts+=(-k)

failures=0
# check NAME EXPECTED_CODE CURL_ARGS… — EXPECTED may be "200|404".
check() {
  local name=$1 expected=$2 code
  shift 2
  code=$(curl "${curl_opts[@]}" -o /dev/null -w '%{http_code}' "$@" 2>/dev/null) || code=000
  if [[ $code =~ ^($expected)$ ]]; then
    log "ok    $name ($code)"
  else
    log "FAIL  $name: got $code, expected $expected"
    failures=$((failures + 1))
  fi
}
# check_body NAME PATTERN CURL_ARGS… — 200 and the body/headers contain PATTERN.
check_body() {
  local name=$1 pattern=$2 out
  shift 2
  out=$(curl "${curl_opts[@]}" -i "$@" 2>/dev/null) || out=""
  if grep -qiE -- "$pattern" <<<"$out"; then
    log "ok    $name"
  else
    log "FAIL  $name: response lacks /$pattern/"
    failures=$((failures + 1))
  fi
}

check "http healthz" 200 "http://$host:$http_port/healthz"
check "http → https redirect" 301 "http://$domain:$http_port/"
check "published site root" "200|404" "$base/"
check_body "CMS index" 'id="root"' "$base/visual_cms/"
check "CMS client-side route falls back to index" 200 "$base/visual_cms/pages/smoke-test"
check_body "security headers" '^x-content-type-options: nosniff' "$base/visual_cms/"
check_body "CMS is noindex" '^x-robots-tag: noindex' "$base/visual_cms/"
check "API rejects anonymous" 401 "$base/api/auth/me"
check "estate admin needs a CMS session" 401 "$base/estate-api/api/admin/complexes"
check "news admin needs a CMS session" 401 "$base/news-api/api/admin/news"
check "public news feed" 200 "$base/news-api/public/news"
check "public news feed is read-only" 403 -X POST "$base/news-api/public/news"
# Any answer from MinIO proves the media chain works (404 missing key, 403 before
# the bucket exists on a fresh install); 502/504 would mean MinIO is down.
check "media proxy reaches MinIO" "403|404" "$base/media/smoke-test-does-not-exist.png"
check "dotfiles are hidden" "403|404" "$base/.env"

if [ "$LOGIN" = 1 ]; then
  user=$(env_get ADMIN_USERNAME admin)
  password=$(env_get ADMIN_PASSWORD)
  body=$(printf '{"username":"%s","password":"%s"}' "$user" "$password")
  check "admin login" 200 -X POST -H 'Content-Type: application/json' --data "$body" "$base/api/auth/login"
  check "session cookie works" 200 "$base/api/auth/me"
  check "estate admin (write token injected)" 200 "$base/estate-api/api/admin/complexes"
  check "news admin (write token injected)" 200 "$base/news-api/api/admin/news"
fi

if [ "$failures" -gt 0 ]; then
  die "$failures smoke check(s) failed"
fi
log "all smoke checks passed"
