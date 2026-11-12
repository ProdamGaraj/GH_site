# syntax=docker/dockerfile:1
# =============================================================================
# Production image for the Node services: backend, estate-service, news-service.
# One Dockerfile for all three (they share layout: src/ → tsc → dist/).
# Used by docker-compose.production.yml with the service directory as context:
#   build: { context: ./backend, dockerfile: ../deploy/node/Dockerfile, args: … }
#
# Build args:
#   BUILD_APK   — extra Alpine packages for the build stage (native modules).
#   RUNTIME_APK — extra Alpine packages for the runtime stage (shared libs).
# =============================================================================

ARG NODE_IMAGE=node:20-alpine

# ---------- build ----------
FROM ${NODE_IMAGE} AS build
ARG BUILD_APK=""
RUN if [ -n "$BUILD_APK" ]; then apk add --no-cache $BUILD_APK; fi
# node-gyp takes Node headers from the image instead of downloading them
# (servers without egress to nodejs.org otherwise fail on native modules).
ENV npm_config_nodedir=/usr/local
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY tsconfig.json tsconfig.build.json ./
COPY src ./src

# tsc emits only .ts → copy every other runtime file (migrations *.sql, browser
# runtimes *.js, tracker, …) into dist with the same relative path. Generic on
# purpose: a new non-TS asset must not need a Dockerfile change.
RUN npm run build \
 && cd src \
 && find . -type f ! -name '*.ts' ! -name '*.bak' ! -path '*/__tests__/*' \
      -exec sh -c 'mkdir -p "../dist/$(dirname "$1")" && cp "$1" "../dist/$1"' _ {} \; \
 && cd .. \
 && npm prune --omit=dev --no-audit --no-fund

# ---------- runtime ----------
FROM ${NODE_IMAGE}
ARG RUNTIME_APK=""
RUN if [ -n "$RUNTIME_APK" ]; then apk add --no-cache $RUNTIME_APK; fi
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist

# Writable dirs the backend uses (BACKUP_DIR); harmless for the other services.
RUN mkdir -p /app/backups && chown node:node /app/backups

# Built-in unprivileged user of the node image (uid 1000).
USER node
CMD ["node", "dist/server.js"]
