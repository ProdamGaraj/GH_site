#!/usr/bin/env bash
# =============================================================================
# Tests of the deploy scripts. No Docker needed: `docker` is a stub that logs
# its arguments and fails on demand. Run: bash deploy/scripts/test/run.sh
# =============================================================================
set -Euo pipefail

TEST_DIR="$(cd "$(dirname "$0")" && pwd)"
SCRIPTS_DIR="$(cd "$TEST_DIR/.." && pwd)"
CMS_SRC="$(cd "$SCRIPTS_DIR/../.." && pwd)"
TMP=$(mktemp -d)
[ -n "${KEEP_TMP:-}" ] && echo "temp: $TMP" || trap 'rm -rf "$TMP"' EXIT
# Hermetic git: a developer's global core.autocrlf=true (Windows) would turn the
# copied scripts into CRLF and break bash.
export GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.autocrlf GIT_CONFIG_VALUE_0=false
IS_WINDOWS=0
case "$(uname -s)" in MINGW* | MSYS* | CYGWIN*) IS_WINDOWS=1 ;; esac

PASS=0
FAIL=0
CURRENT=""

ok() { PASS=$((PASS + 1)); }
fail() {
  FAIL=$((FAIL + 1))
  echo "  FAIL [$CURRENT]: $*"
}
assert_eq() { [ "$1" = "$2" ] && ok || fail "${3:-} expected '$2', got '$1'"; }
assert_match() { [[ $1 =~ $2 ]] && ok || fail "${3:-} '$1' does not match /$2/"; }
assert_contains() { grep -qF -- "$2" "$1" && ok || fail "${3:-} '$1' lacks '$2'"; }
assert_not_contains() { grep -qF -- "$2" "$1" && fail "${3:-} '$1' has '$2'" || ok; }
t() {
  CURRENT=$1
  echo "- $1"
}

# ---------------------------------------------------------------- lib.sh
(
  export VISUAL_CMS_ENV_FILE="$TMP/lib.env"
  # shellcheck source=../lib.sh
  source "$SCRIPTS_DIR/lib.sh"
  set +e

  printf 'A=1\nEMPTY=\nURL=postgres://u:p@h/d?x=1\nTWICE=old\nTWICE=new\nSPACED=noindex, nofollow\r\n' >"$ENV_FILE"

  t "env_get reads values verbatim, last occurrence wins, strips CR"
  assert_eq "$(env_get A)" 1
  assert_eq "$(env_get URL)" "postgres://u:p@h/d?x=1"
  assert_eq "$(env_get TWICE)" new
  assert_eq "$(env_get SPACED)" "noindex, nofollow"

  t "env_get falls back to the default for empty and missing keys"
  assert_eq "$(env_get EMPTY dflt)" dflt
  assert_eq "$(env_get MISSING dflt)" dflt
  assert_eq "$(env_get MISSING)" ""
  assert_eq "$(env_get A1 x)" x "prefix of another key must not match"

  t "env_set replaces in place, keeps other lines, is safe for awk/sed metacharacters"
  env_set A '2&\1/|$x'
  assert_eq "$(env_get A)" '2&\1/|$x'
  assert_eq "$(env_get URL)" "postgres://u:p@h/d?x=1"
  assert_eq "$(grep -c '^A=' "$ENV_FILE")" 1

  t "env_set rewrites duplicates and appends new keys"
  env_set TWICE only
  assert_eq "$(grep -c '^TWICE=' "$ENV_FILE")" 2 "both duplicate lines rewritten"
  assert_eq "$(env_get TWICE)" only
  env_set NEWKEY v
  assert_eq "$(tail -n 1 "$ENV_FILE")" "NEWKEY=v"

  if [ "$IS_WINDOWS" = 0 ]; then # NTFS ignores chmod
    t "env_set leaves the file mode 600"
    assert_eq "$(stat -c %a "$ENV_FILE")" 600
  fi

  echo "$PASS $FAIL" >"$TMP/lib.result"
)
read -r p f <"$TMP/lib.result"
PASS=$((PASS + p))
FAIL=$((FAIL + f))

# ------------------------------------------------------------ secrets.sh init
t "secrets init creates .env from the example and fills every secret with hex"
export VISUAL_CMS_ENV_FILE="$TMP/secrets.env"
bash "$SCRIPTS_DIR/secrets.sh" init >/dev/null
for name in POSTGRES_PASSWORD REDIS_PASSWORD MINIO_ROOT_PASSWORD JWT_SECRET ENCRYPTION_KEY \
  ESTATE_WRITE_TOKEN NEWS_WRITE_TOKEN ADMIN_PASSWORD; do
  assert_match "$(grep "^$name=" "$VISUAL_CMS_ENV_FILE" | cut -d= -f2-)" '^[0-9a-f]{24,}$' "$name"
done
assert_contains "$VISUAL_CMS_ENV_FILE" "COMPOSE_FILE=docker-compose.production.yml"

t "secrets init never overwrites an existing secret and is idempotent"
sed -i 's/^JWT_SECRET=.*/JWT_SECRET=keepme/' "$VISUAL_CMS_ENV_FILE"
before=$(grep -v '^JWT_SECRET=' "$VISUAL_CMS_ENV_FILE" | md5sum)
bash "$SCRIPTS_DIR/secrets.sh" init >/dev/null
assert_contains "$VISUAL_CMS_ENV_FILE" "JWT_SECRET=keepme"
assert_eq "$(grep -v '^JWT_SECRET=' "$VISUAL_CMS_ENV_FILE" | md5sum)" "$before"

t "secrets rotate refuses unknown names without touching .env"
before=$(md5sum <"$VISUAL_CMS_ENV_FILE")
mkdir -p "$TMP/nodocker" && printf '#!/bin/sh\nexit 1\n' >"$TMP/nodocker/docker" && chmod +x "$TMP/nodocker/docker"
PATH="$TMP/nodocker:$PATH" bash "$SCRIPTS_DIR/secrets.sh" rotate NOPE >/dev/null 2>&1
assert_eq "$?" 1 "exit code"
assert_eq "$(md5sum <"$VISUAL_CMS_ENV_FILE")" "$before"
rm -f "$(dirname "$VISUAL_CMS_ENV_FILE")"/secrets.env.bak-*
unset VISUAL_CMS_ENV_FILE

# --------------------------------------------------------------- autodeploy.sh
# Layout: $TMP/origin.git (bare) ← $TMP/dev (pushes) ; $TMP/server (deploys).
# The scripts under test are copied into both clones like a real checkout.
STUB_BIN="$TMP/bin"
mkdir -p "$STUB_BIN"
cat >"$STUB_BIN/docker" <<'EOF'
#!/usr/bin/env bash
# Stub: log the call; fail when the matching FAIL_* marker file exists.
echo "docker $*" >>"$DOCKER_LOG"
case "$*" in
  "compose build"*) [ -f "$STUB_STATE/fail-build-$(git -C "$REPO" rev-parse --short HEAD)" ] && exit 1 ;;
  "compose up"*)    [ -f "$STUB_STATE/fail-up-$(git -C "$REPO" rev-parse --short HEAD)" ] && exit 1 ;;
  "compose ps"*)    echo "backend: unhealthy" ;;
  "compose exec"*"SELECT 1"*) echo 1 ;;
  "compose exec"*pg_dump*) [ -f "$STUB_STATE/fail-dump" ] && exit 1; echo "DUMP" ;;
esac
exit 0
EOF
chmod +x "$STUB_BIN/docker"
# Git Bash on Windows has no flock; locking itself is not under test here.
if ! command -v flock >/dev/null; then
  printf '#!/bin/sh\nexit 0\n' >"$STUB_BIN/flock" && chmod +x "$STUB_BIN/flock"
fi
export PATH="$STUB_BIN:$PATH" DOCKER_LOG="$TMP/docker.log" STUB_STATE="$TMP/stub" REPO="$TMP/server"
mkdir -p "$STUB_STATE"

git init -q --bare -b master "$TMP/origin.git"
git clone -q "$TMP/origin.git" "$TMP/dev" 2>/dev/null
(
  cd "$TMP/dev" || exit 1
  git config user.email t@t && git config user.name t
  mkdir -p visual-cms/deploy visual-cms/public-site
  cp -r "$SCRIPTS_DIR" visual-cms/deploy/scripts
  cp "$CMS_SRC/.env.example" visual-cms/.env.example
  echo "<html>v1</html>" >visual-cms/public-site/index.html
  echo 1 >app.txt
  git add -A && git commit -qm "v1" && git push -q origin master
)
git clone -q "$TMP/origin.git" "$TMP/server"
SERVER_CMS="$TMP/server/visual-cms"
printf 'COMPOSE_FILE=docker-compose.production.yml\nDEPLOY_BRANCH=master\nDEPLOY_PRE_BACKUP=0\nDEPLOY_SMOKE=0\nSITE_DOMAIN=example.test\n' >"$SERVER_CMS/.env"
git -C "$TMP/server" update-index --skip-worktree visual-cms/public-site/index.html

push_commit() {
  (cd "$TMP/dev" && echo "$1" >app.txt && git commit -qam "$1" && git push -q origin master)
  git -C "$TMP/dev" rev-parse --short HEAD
}
deploy() {
  : >"$DOCKER_LOG"
  bash "$SERVER_CMS/deploy/scripts/autodeploy.sh" "$@" >"$TMP/deploy.out" 2>&1
}
head_short() { git -C "$TMP/server" rev-parse --short HEAD; }

t "autodeploy: nothing new → no docker calls"
deploy
assert_eq "$?" 0 "exit"
assert_eq "$(wc -l <"$DOCKER_LOG" | tr -d ' ')" 0 "docker calls"

t "autodeploy: new commit → fast-forward, build, up --wait, deployed-commit recorded"
v2=$(push_commit v2)
deploy
assert_eq "$?" 0 "exit"
assert_eq "$(head_short)" "$v2"
assert_contains "$DOCKER_LOG" "compose build"
assert_contains "$DOCKER_LOG" "compose up -d --remove-orphans --wait"
assert_eq "$(cut -c1-7 "$SERVER_CMS/.deploy/deployed-commit")" "${v2:0:7}"

t "autodeploy: a site deploy rewriting a tracked public-site file does not block pulls"
echo "<html>generated on the server</html>" >"$SERVER_CMS/public-site/index.html"
v3=$(push_commit v3)
deploy
assert_eq "$?" 0 "exit"
assert_eq "$(head_short)" "$v3"

t "autodeploy: build failure → checkout reset, containers untouched, commit marked bad"
v4=$(push_commit v4)
touch "$STUB_STATE/fail-build-$v4"
deploy
assert_eq "$?" 1 "exit"
assert_eq "$(head_short)" "$v3"
assert_not_contains "$DOCKER_LOG" "compose up"
assert_eq "$(cut -c1-7 "$SERVER_CMS/.deploy/bad-commit")" "${v4:0:7}"

t "autodeploy: a bad commit is not retried every minute"
deploy
assert_eq "$?" 0 "exit"
assert_eq "$(wc -l <"$DOCKER_LOG" | tr -d ' ')" 0 "docker calls"

t "autodeploy: unhealthy after up → rollback to previous commit (rebuild + up)"
v5=$(push_commit v5)
touch "$STUB_STATE/fail-up-$v5"
deploy
assert_eq "$?" 1 "exit"
assert_eq "$(head_short)" "$v3"
assert_eq "$(grep -c 'compose build' "$DOCKER_LOG")" 2 "builds (new + rollback)"
assert_eq "$(grep -c 'compose up' "$DOCKER_LOG")" 2 "ups (new + rollback)"
assert_contains "$TMP/deploy.out" "rolled back to"
assert_eq "$(cut -c1-7 "$SERVER_CMS/.deploy/bad-commit")" "${v5:0:7}"

t "autodeploy: a newer good commit clears the bad mark"
v6=$(push_commit v6)
deploy
assert_eq "$?" 0 "exit"
assert_eq "$(head_short)" "$v6"
[ ! -f "$SERVER_CMS/.deploy/bad-commit" ] && ok || fail "bad-commit not cleared"

t "autodeploy --force redeploys the current commit"
deploy --force
assert_eq "$?" 0 "exit"
assert_contains "$DOCKER_LOG" "compose build"

t "autodeploy: local edits to tracked files block the deploy"
v7=$(push_commit v7)
echo "hotfix" >"$TMP/server/app.txt"
deploy
assert_eq "$?" 1 "exit"
assert_eq "$(head_short)" "$v6"
assert_contains "$TMP/deploy.out" "tracked files modified on the server"
git -C "$TMP/server" checkout -q -- app.txt

t "autodeploy: paused → does nothing"
touch "$SERVER_CMS/.deploy/paused"
deploy
assert_eq "$?" 0 "exit"
assert_eq "$(head_short)" "$v6"
rm "$SERVER_CMS/.deploy/paused"
deploy
assert_eq "$(head_short)" "$v7" "resumes after unpause"

t "autodeploy: refuses a non-fast-forward origin"
(cd "$TMP/dev" && git reset -q --hard HEAD~1 && echo rewritten >app.txt && git commit -qam rewritten && git push -q -f origin master)
deploy
assert_eq "$?" 1 "exit"
assert_eq "$(head_short)" "$v7"
assert_contains "$TMP/deploy.out" "not a fast-forward"

(cd "$TMP/dev" && git fetch -q && git reset -q --hard origin/master)
git -C "$TMP/server" fetch -q && git -C "$TMP/server" reset -q --hard origin/master
printf 'DEPLOY_PRE_BACKUP=1\nBACKUP_DIR=%s\n' "$TMP/backups" >>"$SERVER_CMS/.env"

t "autodeploy: pre-deploy DB dump is complete before the switch"
v8=$(push_commit v8)
deploy
assert_eq "$?" 0 "exit"
assert_eq "$(head_short)" "$v8"
dumpdir=$(find "$TMP/backups" -mindepth 1 -maxdepth 1 -type d -name '*-db' | head -1)
[ -n "$dumpdir" ] && ok || fail "no *-db backup directory"
for db in visual_cms estate news; do assert_contains "$dumpdir/$db.dump" "DUMP" "$db.dump"; done
assert_contains "$dumpdir/MANIFEST" "kind: db"
[ -z "$(find "$TMP/backups" -name '*.partial')" ] && ok || fail "partial backup left behind"
dump_line=$(grep -n pg_dump "$DOCKER_LOG" | tail -1 | cut -d: -f1)
up_line=$(grep -n "compose up" "$DOCKER_LOG" | head -1 | cut -d: -f1)
[ "$dump_line" -lt "$up_line" ] && ok || fail "dump ($dump_line) must precede up ($up_line)"

t "autodeploy: failed pre-deploy dump aborts the deploy before any container changes"
touch "$STUB_STATE/fail-dump"
v9=$(push_commit v9)
deploy
assert_eq "$?" 1 "exit"
assert_eq "$(head_short)" "$v8"
assert_not_contains "$DOCKER_LOG" "compose up"
[ -z "$(find "$TMP/backups" -name '*.partial')" ] && ok || fail "partial backup left behind"
rm "$STUB_STATE/fail-dump"
deploy
assert_eq "$(head_short)" "$v9" "retried next run (not marked bad)"

t "backup: two runs in the same second keep separate, complete directories"
mkdir -p "$TMP/frozen-clock" "$TMP/samesec"
printf '#!/bin/sh\necho 20260101-000000\n' >"$TMP/frozen-clock/date" && chmod +x "$TMP/frozen-clock/date"
for _ in 1 2; do
  PATH="$TMP/frozen-clock:$PATH" VISUAL_CMS_ENV_FILE="$SERVER_CMS/.env" \
    bash "$SERVER_CMS/deploy/scripts/backup.sh" db >>"$TMP/samesec/out" 2>&1
  assert_eq "$?" 0 "backup exit"
done
assert_eq "$(find "$TMP/backups" -mindepth 1 -maxdepth 1 -type d -name '20260101-000000*-db' | wc -l | tr -d ' ')" 2 "directories"
assert_eq "$(find "$TMP/backups" -mindepth 2 -type d | wc -l | tr -d ' ')" 0 "no backup nested in another"
for d in "$TMP/backups"/20260101-000000*-db; do assert_contains "$d/MANIFEST" "kind: db"; done

t "autodeploy: a failing smoke test after a healthy up triggers rollback"
printf '#!/bin/sh\nprintf 000\nexit 7\n' >"$STUB_BIN/curl" && chmod +x "$STUB_BIN/curl"
sed -i 's/^DEPLOY_SMOKE=0/DEPLOY_SMOKE=1/' "$SERVER_CMS/.env"
v10=$(push_commit v10)
deploy
assert_eq "$?" 1 "exit"
assert_eq "$(head_short)" "$v9"
assert_contains "$TMP/deploy.out" "smoke check(s) failed"
assert_eq "$(cut -c1-7 "$SERVER_CMS/.deploy/bad-commit")" "${v10:0:7}"
sed -i 's/^DEPLOY_SMOKE=1/DEPLOY_SMOKE=0/' "$SERVER_CMS/.env"
rm "$STUB_BIN/curl"

t "autodeploy: refuses to run without COMPOSE_FILE in .env (would start the dev stack)"
sed -i '/^COMPOSE_FILE=/d' "$SERVER_CMS/.env"
deploy
assert_eq "$?" 1 "exit"
assert_contains "$TMP/deploy.out" "COMPOSE_FILE is not set"

echo
echo "passed: $PASS  failed: $FAIL"
[ "$FAIL" -eq 0 ]
