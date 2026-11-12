# Visual CMS — Production Deployment Guide

How to run gh.uz (public site + Visual CMS + estate/news services) on a server:
first install, migrating an existing server, TLS, auto-deploy, backups,
secrets, day-to-day operations and troubleshooting.

> **Short version**
> ```bash
> git clone git@github.com:ProdamGaraj/GH_site.git ~/GH_site && cd ~/GH_site/visual-cms
> cp .env.example .env && nano .env              # SITE_DOMAIN, MACRO_TOKEN, …
> bash deploy/scripts/install.sh                 # secrets, build, start, timers
> bash deploy/scripts/smoke.sh --login           # end-to-end check
> ```
> Then install a real TLS certificate ([§5](#5-tls-certificate)) and an
> off-site backup target ([§7](#7-backups-and-restore)).

---

## Contents

1. [What runs where](#1-what-runs-where)
2. [Server requirements](#2-server-requirements)
3. [Fresh install](#3-fresh-install)
4. [Migrating an existing server (dev/test stack)](#4-migrating-an-existing-server)
5. [TLS certificate](#5-tls-certificate)
6. [Auto-deploy (CD)](#6-auto-deploy-cd)
7. [Backups and restore](#7-backups-and-restore)
8. [Secrets](#8-secrets)
9. [Day-to-day operations](#9-day-to-day-operations)
10. [Monitoring](#10-monitoring)
11. [CDN and scaling](#11-cdn-and-scaling)
12. [Troubleshooting](#12-troubleshooting)
13. [File reference](#13-file-reference)

---

## 1. What runs where

```
                 Internet  :80 / :443   (nothing else is published)
                     │
              ┌──────▼───────────────────────────────────────────────┐
              │ web  (nginx, deploy/web)                             │
              │  /                → ./public-site  (published HTML)  │
              │  /visual_cms/     → CMS admin, static, in the image  │
              │  /api/            → backend:5000                     │
              │  /estate-api/     → estate-service:5100 (+ token,    │
              │  /news-api/       → news-service:5200    CMS session)│
              │  /news-api/public → news-service (read-only feed)    │
              │  /media/          → minio:9000 (disk cache 10 GB)    │
              │  /map/            → ./map-assets                     │
              └──────┬───────────────────────────────────────────────┘
                     │ internal docker network only
   ┌─────────────────┼─────────────────┬──────────────────┐
   ▼                 ▼                 ▼                  ▼
 backend ──► postgres (visual_cms, estate, news)   redis (cache)
   │  └────► minio (media)            ▲
   ├──► estate-service ───────────────┤
   └──► news-service ─────────────────┘
```

| Service | Image | Data | Exposed |
|---|---|---|---|
| `web` | built from `deploy/web/Dockerfile` (nginx 1.28 + CMS build) | `nginx-cache` volume (disposable) | 80, 443 |
| `backend` | `deploy/node/Dockerfile` | writes `./public-site` | — |
| `estate-service`, `news-service` | `deploy/node/Dockerfile` | — | — |
| `postgres` | `postgres:15-alpine` | **`visual-cms_postgres-data`** (external) | — |
| `minio` | built from source, `RELEASE.2025-09-07T16-13-09Z` (`deploy/minio/`; `minio/minio` was deleted from Docker Hub) | **`visual-cms_minio-data`** (external) | console on `127.0.0.1:9001` only |
| `redis` | `redis:7-alpine` | none (pure cache) | — |

**Data that is not in git**, and therefore what the backups cover: the Postgres
volume, the MinIO volume, `./public-site` (HTML written by site deploys), and
`.env`. `./map-assets` can be rebuilt with `scripts/map/build-map-assets.sh`.

**Two different "deploys":**
- *Container deploy* (this guide) ships new **code**: `git pull`, rebuild images,
  restart containers. Auto-deploy does it.
- *Site publish* (the CMS "Deploy" button) regenerates the **HTML** in
  `./public-site` from CMS content. It is not automatic. When a code change
  affects generated pages (generator, runtimes, templates), republish the
  affected sites/collections in the CMS after the container deploy.

---

## 2. Server requirements

### Sizing

The target is page opens (one person opening one page), which is what drives load.

| Target | Server | Notes |
|---|---|---|
| **1 000 page opens / minute** (~17/s) | **4 vCPU · 16 GB RAM · 200 GB NVMe · 1 Gbps** | Comfortable on one server. The bottleneck is bandwidth for images and video on first visits (≈250–500 Mbit/s at peak). A CDN in front removes that (§11). |
| **1 000 page opens / second** | CDN **mandatory** + 8 vCPU · 32 GB | Not just a bigger server: without a CDN that is 16–30 Gbit/s of media. The analytics tracker sends a heartbeat every 15 s per open tab, which comes to ≈8 000 DB writes/s at this traffic. The backend needs batched analytics writes (or the heartbeat turned off) **before** this target is realistic. |

Memory budget at the minimum size (container limits in the compose file):
Postgres 2 GB, backend 1.5 GB (image processing with sharp), MinIO 1 GB, the
others ≈1.5 GB together, and the rest goes to the OS page cache and Docker
builds. 8 GB technically boots, but the first `docker compose build` and
media uploads leave no headroom.

Disk: media grows with uploads (videos up to 250 MB each). Local backups
keep 7 days of media archives and 14 days of database dumps. 200 GB is a
sane start; watch it (§10).

> **Data location.** Leads from site forms are personal data of Uzbekistan
> residents. Uzbek law requires such data to be stored on servers in
> Uzbekistan, so keep the server (Postgres) with a local provider. A CDN may
> cache static files. Confirm the details with a lawyer.

### Software

- Ubuntu 26.04 LTS (recommended; the deploy scripts are tested on it, including
  its Rust coreutils) or 24.04 LTS. Any systemd Linux works.
- **Docker Engine** (`docker-ce` + `docker-compose-plugin`, Compose ≥ 2.20),
  **not Docker Desktop**. Docker Desktop runs inside a VM that the kernel's
  OOM killer can take down whole, and it does not start on boot by itself
  (this happened on the test server on 2026-09-24).
- `git`, `openssl`, `curl`, `util-linux` (for `flock`); `jq` only if you
  enable the CI gate; `rclone` for off-site backups.

```bash
# Docker Engine — official repository (https://docs.docker.com/engine/install/ubuntu/)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"        # log out and back in afterwards
sudo apt-get install -y git openssl curl util-linux jq
```

### Network

- Open inbound **22, 80, 443** only. Port 80 is needed for HTTP→HTTPS
  redirects and Let's Encrypt.
- Docker publishes ports by writing iptables rules directly and bypasses `ufw`.
  That is why the compose file publishes only nginx; MinIO's console is bound
  to `127.0.0.1`.
- Outbound: GitHub (git fetch, MinIO source), Docker Hub + npm registry +
  `proxy.golang.org` (image builds),
  `api.macrocrm.gh.uz` (CRM sync), `api.telegram.org` (optional notifications).

---

## 3. Fresh install

Run everything as a regular user in the `docker` group with `sudo` rights.
`sudo` is only used to install the systemd units. Examples use `user` and
`~/GH_site`.

**1. Read access to the repository.** The repository is private: give the server a
read-only **deploy key**.
```bash
ssh-keygen -t ed25519 -f ~/.ssh/gh_site_deploy -N ""
cat ~/.ssh/gh_site_deploy.pub
# GitHub → repo → Settings → Deploy keys → Add (read-only)
cat >> ~/.ssh/config <<'EOF'
Host github.com
  IdentityFile ~/.ssh/gh_site_deploy
  IdentitiesOnly yes
EOF
git clone git@github.com:ProdamGaraj/GH_site.git ~/GH_site
```

**2. Configure.**
```bash
cd ~/GH_site/visual-cms
cp .env.example .env
nano .env
```
Set at least `SITE_DOMAIN`, plus `MACRO_*` if CRM sync is used. Leave the secret
lines empty: the installer fills them in. Test stand: `SITE_DOMAIN=test_analytics.gh.uz`,
`ROBOTS_TAG=noindex, nofollow`, `PUBLIC_SITE_NOINDEX=true`.

**3. TLS certificate.** If you already have one, put it in place now:
`ssl/server.crt` (full chain) and `ssl/server.key`. Otherwise the installer
creates a 30-day self-signed placeholder and you get a real one in §5.

**4. Install.**
```bash
bash deploy/scripts/install.sh
```
The installer:
1. checks the prerequisites;
2. generates every secret in `.env`;
3. creates the data volumes;
4. creates the TLS placeholder if needed;
5. marks generated `public-site` files so that site deploys don't block `git pull`;
6. builds the images (≈5–10 min the first time);
7. starts the stack and waits for every healthcheck;
8. installs the systemd timers for auto-deploy (every minute) and backups (03:30).

Re-running it is safe.

On an empty database the backend creates the schema itself on first start
(log: `Empty database … creating the schema from entities`). Existing
databases are never touched that way; they only get the `.sql` migrations.

**5. Verify.**
```bash
SMOKE_INSECURE=1 bash deploy/scripts/smoke.sh --login   # drop SMOKE_INSECURE once the cert is real
docker compose ps                                       # all "healthy"
```
Open `https://<domain>/visual_cms/`, log in as `admin` with `ADMIN_PASSWORD`
from `.env`, and **change the password in the CMS**, or keep `.env` as its
source (§8).

**6. Save `.env`** to the team password manager. Without `ENCRYPTION_KEY`
the stored data-source credentials (MacroCRM token etc.) cannot be decrypted
after a disaster.

**7. Content.** On an empty install, either restore a backup (§7) or build
the map assets (`scripts/map/build-map-assets.sh`) and publish the sites from
the CMS.

---

## 4. Migrating an existing server

The test server (and any server set up earlier) runs the **dev stack**:
`docker-compose.yml` + `docker-compose.test.yml`, with Vite and nodemon, all ports
open, and default passwords. Its data lives in the same volume names the
production stack uses, so it can be taken over in place.

> If that server runs **Docker Desktop**, do not take over in place:
> volumes inside Desktop's VM are invisible to Docker Engine. Use
> "Move to a new server" below, even if the "new" server is the same machine
> after installing Docker Engine.

### In place (same Docker Engine)

```bash
cd ~/GH_site
git pull                                   # gets the production files; old stack keeps running

cd visual-cms
bash deploy/scripts/backup.sh full         # works with the OLD stack too *
ls backups/                                # note the new *-full directory
# * needs COMPOSE_FILE in the old .env (the test server has
#   COMPOSE_FILE=docker-compose.yml:docker-compose.test.yml); add it if missing

docker compose down                        # stops the old stack; volumes are external → kept

cp .env .env.old                           # old .env: COMPOSE_FILE + MACRO_* values
cp .env.example .env
nano .env                                  # SITE_DOMAIN, copy MACRO_* from .env.old, keep secrets empty

bash deploy/scripts/install.sh --adopt-existing-data
SMOKE_INSECURE=1 bash deploy/scripts/smoke.sh --login
```

`--adopt-existing-data` makes the existing data match the new secrets:

| What | Before | After |
|---|---|---|
| Postgres role password | `cms_password` | `POSTGRES_PASSWORD` (via `ALTER ROLE`) |
| Data-source credentials (e.g. MacroCRM token in data sources) | encrypted with the built-in dev key | re-encrypted with `ENCRYPTION_KEY` (one transaction; aborts on any problem) |
| CMS user `ADMIN_USERNAME` | `admin12345` | `ADMIN_PASSWORD` |
| MinIO root | `minioadmin` / `minioadmin` | `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` (MinIO takes the new values on start) |
| Estate/news write tokens, JWT | values committed to git | random |

All CMS users have to log in again (new JWT secret). Other CMS users keep
their passwords.

`./public-site` is kept as is, so no site republish is needed.

**Roll back**, if something is wrong:
```bash
docker compose down
mv .env.old .env                          # COMPOSE_FILE back to the dev files
bash deploy/scripts/restore.sh backups/<dir>-full --yes   # only if data was changed
docker compose up -d
```

### Move to a new server

1. On the old server: `bash deploy/scripts/backup.sh full` (after `git pull`).
2. Copy the backup directory over. This is data, not code, so use rsync/scp:
   `rsync -a backups/<dir>-full newhost:~/restore/`
3. On the new server: do the fresh install (§3) up to and including step 4.
4. Restore and adopt:
   ```bash
   bash deploy/scripts/restore.sh ~/restore/<dir>-full --yes
   bash deploy/scripts/secrets.sh adopt      # old encryption key + old admin password → new ones
   SMOKE_INSECURE=1 bash deploy/scripts/smoke.sh --login
   ```
5. Copy `map-assets/` from the old server, or rebuild it.
6. Switch DNS.

---

## 5. TLS certificate

nginx reads `ssl/server.crt` (certificate **plus intermediate chain**) and
`ssl/server.key`.

### Let's Encrypt (free, auto-renewing)

Requires DNS pointing at this server and port 80 reachable from the internet.
nginx already serves `/.well-known/acme-challenge/` from `./certbot-www`.

```bash
sudo apt-get install -y certbot
CMS=~/GH_site/visual-cms
sudo certbot certonly --webroot -w "$CMS/certbot-www" -d gh.uz -d www.gh.uz \
  --deploy-hook "install -m 644 /etc/letsencrypt/live/gh.uz/fullchain.pem $CMS/ssl/server.crt \
              && install -m 600 /etc/letsencrypt/live/gh.uz/privkey.pem  $CMS/ssl/server.key \
              && docker exec visual-cms-web-1 nginx -s reload"
```
certbot's own systemd timer renews the certificate and re-runs the hook. Test it with
`sudo certbot renew --dry-run`.

If a corporate edge proxy or firewall terminates TLS in front of this
server, the certificate lives there instead. Keep any valid certificate here
so nginx starts.

### Purchased certificate

```bash
cat your_domain.crt intermediate.crt > ssl/server.crt   # leaf first, then chain
cp your_domain.key ssl/server.key && chmod 600 ssl/server.key
docker exec visual-cms-web-1 nginx -s reload
```

### HSTS

`Strict-Transport-Security: max-age=31536000` is sent by default. Browsers
ignore it on connections with an untrusted certificate, so a self-signed
placeholder is harmless. To turn it off, set `HSTS=` (empty) in `.env` and
run `docker compose up -d web`.

---

## 6. Auto-deploy (CD)

A systemd timer runs `deploy/scripts/autodeploy.sh` one minute after the
previous run finishes. Runs never overlap. Each run:

```
git fetch ──► nothing new? ──► exit
   │
   ├─ safety: on DEPLOY_BRANCH · no local edits to tracked files · fast-forward only
   │          · (optional) all GitHub checks green
   ▼
git merge --ff-only ──► docker compose build ──✗──► git back to previous commit; containers untouched
   │                                                 (commit marked bad, notification)
   ▼
pg_dump of the 3 databases (DEPLOY_PRE_BACKUP=1) ──✗──► abort, nothing changed
   ▼
docker compose up --wait  (all healthchecks)  +  smoke.sh
   │                                    └──✗──► ROLLBACK: previous commit, rebuild, up
   ▼                                              (commit marked bad, notification)
deployed ✔ (notification)
```

- **Deploying = pushing to `master`.** Production updates within a couple of
  minutes plus build time.
- A **bad commit** is not retried every minute. The next pushed commit
  clears the mark. You can also force a retry: `bash deploy/scripts/autodeploy.sh --force`.
- **Rollback scope:** code only. Database migrations in this project are
  additive (`IF NOT EXISTS`), so old code runs fine on a migrated schema.
  For anything destructive, the pre-deploy dump is in `backups/*-db`.
- **Downtime:** containers are recreated one by one when their image changes.
  The public site is static and stays up. The CMS and API are unavailable for
  roughly 10–60 s while the backend restarts.

### Controls

| Action | Command |
|---|---|
| Watch logs | `journalctl -u visual-cms-autodeploy -f` |
| Last deployed commit | `cat .deploy/deployed-commit` |
| Pause / resume | `touch .deploy/paused` / `rm .deploy/paused` |
| Deploy now (also retries a bad commit) | `bash deploy/scripts/autodeploy.sh --force` |
| Disable completely | `sudo systemctl disable --now visual-cms-autodeploy.timer` |
| Timer status | `systemctl list-timers 'visual-cms-*'` |

### Rules for the server checkout

- **Never edit tracked files on the server.** Auto-deploy refuses to run and
  notifies you. Fix: commit the change from a dev machine, or
  `git checkout -- <file>` on the server.
- Never rewrite `master` history (force-push). Auto-deploy only fast-forwards.
  Recovery: `git reset --hard origin/master` on the server, then `--force`.
- Generated files under `public-site/` that happen to be tracked are marked
  `skip-worktree` by the installer, so site deploys don't count as local edits.

### Deploy only green commits (recommended once CI is green)

GitHub Actions (`.github/workflows/ci.yml`) runs on every push:
- type check and tests of all four packages;
- shellcheck and tests of these scripts;
- a full production-stack boot with the smoke test and a backup/restore round trip.

To make the server wait for it:
1. GitHub → Settings → Developer settings → Fine-grained token, repository
   `ProdamGaraj/GH_site`, permission **Checks: Read-only**.
2. In `.env`: `DEPLOY_REQUIRE_CI=1`, `GITHUB_TOKEN=<token>`. Requires `jq`.

While checks run, the server logs "CI not finished yet — waiting". If a check
fails, the commit is marked bad and not deployed.

### Notifications (Telegram)

Create a bot with @BotFather, add it to a chat, and set
`NOTIFY_TELEGRAM_BOT_TOKEN` and `NOTIFY_TELEGRAM_CHAT_ID` in `.env`. You get
messages for successful deploys, failures, rollbacks, blocked deploys
(once per problem), and backup failures.

---

## 7. Backups and restore

`deploy/scripts/backup.sh` (systemd timer daily at 03:30, plus a DB-only
dump before every deploy):

```
backups/20261109-033000-full/
  visual_cms.dump  estate.dump  news.dump   # pg_dump -Fc, one per database
  minio.tar.gz                              # all media
  public-site.tar.gz                        # published HTML
  MANIFEST                                  # time, git commit, sizes
backups/20261109-141205-db/                 # pre-deploy: dumps only
```

- A run writes to `<name>.partial` and renames it at the end, so a
  directory without `.partial` is always complete.
- Retention: `BACKUP_KEEP_DAYS` (14) for directories, `BACKUP_MEDIA_KEEP_DAYS`
  (7) for `minio.tar.gz` inside them.
- `.env` is **not** in the backups on purpose: it holds the keys. Keep it in
  the password manager.

### Off-site copy (do this)

Backups on the same disk do not survive losing the server. Set up any
rclone remote, for example an S3-compatible bucket at a different provider:
```bash
sudo apt-get install -y rclone
rclone config                       # create remote "offsite"
echo 'BACKUP_RCLONE_REMOTE=offsite:gh-backups' >> .env
bash deploy/scripts/backup.sh       # test
```
Off-site retention is configured at the bucket (lifecycle rule), not here.

### Restore

```bash
bash deploy/scripts/restore.sh backups/<dir>                 # all parts in the dir
bash deploy/scripts/restore.sh backups/<dir> --only db       # db | media | site
```
It asks for `yes`, stops the app containers, replaces the data, and starts
everything with healthchecks. If the backup comes from a stack with different
keys (another server, the old dev stack), run `bash deploy/scripts/secrets.sh adopt`
afterwards.

**Test a restore** at least once, ideally on the test server: a backup that
was never restored is a hope, not a backup. CI does a backup/restore round trip
on every push, but only on an empty stack.

---

## 8. Secrets

All secrets live in `visual-cms/.env` (mode 600, gitignored), generated by
`secrets.sh init` as random hex.

| Secret | Used by | Effect of rotating |
|---|---|---|
| `POSTGRES_PASSWORD` | backend, estate, news | `ALTER ROLE` + restart of the three services |
| `REDIS_PASSWORD` | backend | restart of redis + backend (cache is lost, harmless) |
| `MINIO_ROOT_PASSWORD` | backend (S3 client) | restart of minio + backend |
| `JWT_SECRET` | backend | **everyone is logged out** |
| `ENCRYPTION_KEY` | backend (data-source credentials) | credentials re-encrypted in one transaction; on error the old key is restored |
| `ESTATE_WRITE_TOKEN`, `NEWS_WRITE_TOKEN` | nginx ↔ services | restart of web + service + backend |
| `ADMIN_PASSWORD` | CMS user `ADMIN_USERNAME` | password reset in the DB |
| `GITHUB_TOKEN`, `NOTIFY_*`, `MACRO_TOKEN` | scripts / CRM | edit `.env`, `docker compose up -d` |

```bash
bash deploy/scripts/secrets.sh rotate JWT_SECRET            # one
bash deploy/scripts/secrets.sh rotate POSTGRES_PASSWORD REDIS_PASSWORD
bash deploy/scripts/secrets.sh rotate all                   # e.g. after a leak or staff change
```
Each run first saves `.env.bak-<timestamp>`. Update the password-manager
copy afterwards.

Rules:
- Never put real secrets in compose files, nginx configs or code. Compose
  refuses to start when a required secret is missing; there are no fallbacks.
- The dev values in `docker-compose.yml` (`dev-estate-write-token-change-me`,
  `cms_password`, `minioadmin`, `admin12345`) are public: they are in git
  history. They must only ever exist on developer machines.

---

## 9. Day-to-day operations

All commands run in `~/GH_site/visual-cms`. `.env` sets `COMPOSE_FILE`, so
plain `docker compose` always means the production stack.

| Task | Command |
|---|---|
| Status / health | `docker compose ps` |
| Logs (all / one) | `docker compose logs -f --tail 100` / `docker compose logs -f backend` |
| Restart a service | `docker compose restart backend` |
| Apply `.env` changes | `docker compose up -d` (recreates only what changed) |
| Rebuild and redeploy by hand | `bash deploy/scripts/autodeploy.sh --force` |
| SQL shell | `docker compose exec postgres psql -U cms_user visual_cms` |
| Backend admin script | `docker compose exec backend node dist/scripts/<name>.js` |
| MinIO console | on your PC: `ssh -L 9001:127.0.0.1:9001 user@server`, open http://localhost:9001 |
| Reset an admin password | set `ADMIN_PASSWORD` in `.env`, then `bash deploy/scripts/secrets.sh admin` |
| Rebuild map assets | `bash scripts/map/build-map-assets.sh` (served live, no restart) |
| Clear the media cache | `docker compose exec web sh -c 'rm -rf /var/cache/nginx/media/*'` |
| Disk usage | `docker system df`, `du -sh backups public-site` |
| Reclaim Docker space | `docker builder prune -f --filter until=168h` (keeps last week's build cache) |

**Never** run `docker compose down -v` out of habit. The data volumes are
external and survive it, but `nginx-cache` and `backend-backups` are deleted.

---

## 10. Monitoring

Built in:
- Container healthchecks (`docker compose ps`). Docker restarts crashed
  containers (`restart: unless-stopped`) and the whole stack after a reboot.
- Telegram notifications for deploys and backups (§6).
- Backend `/health/detailed` and Prometheus `/metrics`, internal only:
  `docker compose exec backend wget -qO- localhost:5000/health/detailed`.

Add from outside (cheap and important):
- **Uptime check** of `https://gh.uz/` and `https://gh.uz/visual_cms/` every
  minute (UptimeRobot, Better Stack, or a Telegram bot on another host).
  It catches what the server cannot report itself: a dead server, network,
  DNS, or an expired certificate.
- **Disk alert** at 80% on `/` (or `/var/lib/docker`).
- **Certificate expiry** check if renewal is not Let's Encrypt.

---

## 11. CDN and scaling

**When:** above ~1 000 page opens/minute at peak, for visitors far from the
server, or to cut bandwidth costs.

1. Put a CDN in front (Cloudflare or any pull CDN). Cache `/media/*`, `/map/*`,
   `/visual_cms/assets/*`, and `*.css|js|woff2|jpg|png` (they are already sent
   with long `Cache-Control`). Bypass the cache for `/api/*`, `/estate-api/*`,
   `/news-api/*`, `/visual_cms/` and HTML (sent with `no-cache`).
2. **Required:** tell nginx the CDN's IP ranges in
   `deploy/web/snippets/real-ip.conf` and push it. Without that, every visitor
   appears to come from a few CDN IPs and hits the per-IP rate limits
   (backend 429s, news feed `limit_req`).
3. Keep the personal-data rule from §2 in mind: the CDN must not cache
   `/api/*` (form submissions).

Single points of failure that remain: one server, one Postgres, one MinIO.
The mitigation is backups with a tested restore (§7). High availability
(replicas, managed DB/S3) is only worth it if hours of downtime are not
acceptable.

---

## 12. Troubleshooting

| Symptom | Likely cause → fix |
|---|---|
| `docker compose …` complains `required variable … is missing` | `.env` incomplete → `bash deploy/scripts/secrets.sh init` |
| `docker compose` starts Vite/nodemon containers | `COMPOSE_FILE` missing in `.env` → set `COMPOSE_FILE=docker-compose.production.yml`, then `docker compose down && docker compose up -d` |
| `web` restarts, logs say `cannot load certificate` | `ssl/server.crt` / `server.key` missing or mismatched (§5) |
| 502 on `/api/…` | backend down/unhealthy → `docker compose logs backend`; DB password mismatch after a manual `.env` edit → `secrets.sh apply-db-password` |
| Backend log: `ENCRYPTION_KEY environment variable is required` / data source "decrypt" errors | wrong `ENCRYPTION_KEY` for this data → restore the right `.env`; for data from the dev stack: `secrets.sh reencrypt dev-fallback` |
| Site deploy in CMS fails with `EACCES` | files in `public-site` not owned by uid 1000 (copied by hand?) → `bash deploy/scripts/autodeploy.sh --force` (fixes ownership) |
| Auto-deploy does nothing | `journalctl -u visual-cms-autodeploy -n 50`: paused? commit marked bad? CI pending? |
| "auto-deploy blocked: local changes" | someone edited a tracked file on the server → see §6 rules |
| "CI not finished yet" forever | the commit has no check runs (Actions disabled, or the workflow file is missing on that commit) → push again or set `DEPLOY_REQUIRE_CI=0` |
| Everyone gets 429 | behind a CDN without `real-ip.conf` (§11) |
| Media 404 right after migration | bucket policy not yet applied → upload any file in the CMS media library (the backend creates the bucket and policy on first use) |
| Image build: `npm ci` … `package.json and package-lock.json … are not in sync` | a dependency was changed without refreshing that package's lockfile → `bash deploy/scripts/refresh-lockfile.sh <package>` on your PC, commit |
| Image build fails in the `minio` step | GitHub or `proxy.golang.org` unreachable from the server (it builds MinIO from source, see `deploy/minio/Dockerfile`) |
| `git fetch` fails in auto-deploy | deploy key missing or not in `~/.ssh/config` of the user in the systemd unit (§3 step 1) |

---

## 13. File reference

| Path | What |
|---|---|
| `docker-compose.production.yml` | the production stack (standalone) |
| `.env.example` | every setting with comments, copy to `.env` |
| `deploy/node/Dockerfile` | one image recipe for backend, estate-service, news-service |
| `deploy/web/Dockerfile` | nginx + CMS build |
| `deploy/minio/Dockerfile` | MinIO built from source at the pinned release (`minio/minio` no longer exists on Docker Hub) |
| `deploy/web/templates/default.conf.template` | servers, per-env values (domain, tokens, robots, HSTS) |
| `deploy/web/snippets/site.conf` | all public routes (production twin of `nginx-public.shared.conf`) |
| `deploy/web/snippets/real-ip.conf` | CDN / proxy IP ranges (§11) |
| `deploy/scripts/install.sh` | server setup (§3, §4) |
| `deploy/scripts/autodeploy.sh` | CD loop (§6) |
| `deploy/scripts/backup.sh`, `restore.sh` | §7 |
| `deploy/scripts/secrets.sh` | §8 |
| `deploy/scripts/smoke.sh` | end-to-end check, used by CI and auto-deploy |
| `deploy/scripts/refresh-lockfile.sh` | refresh a package's `package-lock.json` after changing its dependencies |
| `deploy/scripts/test/run.sh` | tests of the scripts (`bash deploy/scripts/test/run.sh`) |
| `deploy/systemd/*` | timer/service units, installed by `install.sh` |
| `.github/workflows/ci.yml` (repo root) | CI |
| `docker-compose.yml`, `docker-compose.test.yml`, `nginx-public.*.conf` | **development** stack only |

When you add a public route, change both `deploy/web/snippets/site.conf`
(production) and `nginx-public.shared.conf` (dev).

When you change dependencies of `frontend`, `backend`, `estate-service` or
`news-service`, refresh that package's own lockfile and commit it:
`bash deploy/scripts/refresh-lockfile.sh frontend` (needs Docker). Inside the
npm workspace, `npm install` updates only the root lockfile, while the images
and CI build each package from its own lockfile (`npm ci`); CI fails if one is
stale.
