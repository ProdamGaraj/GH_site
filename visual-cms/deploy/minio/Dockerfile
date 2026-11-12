# syntax=docker/dockerfile:1
# =============================================================================
# MinIO server built from source.
#
# Why: MinIO deleted minio/minio from Docker Hub (Sep 2026) and its Quay
# repository requires authentication, so `image: minio/minio:...` cannot be
# pulled on a clean server any more. The source repository is archived but
# still public, so the exact release the test stand has been running is built
# here: same binary, same on-disk format for the existing minio-data volume.
#
# Change MINIO_RELEASE only deliberately (data format upgrades are one-way);
# take a backup first (deploy/scripts/backup.sh full).
# =============================================================================
ARG MINIO_RELEASE=RELEASE.2025-09-07T16-13-09Z

FROM golang:1.24-alpine AS build
ARG MINIO_RELEASE
RUN apk add --no-cache git
WORKDIR /src
RUN git clone --depth 1 --branch "${MINIO_RELEASE}" https://github.com/minio/minio.git .
# Same flags as the upstream Makefile: version/commit/date baked into the binary.
RUN CGO_ENABLED=0 go build -trimpath -tags kqueue \
      -ldflags "$(go run buildscripts/gen-ldflags.go)" -o /out/minio . \
 && /out/minio --version

FROM alpine:3.22
# curl: compose healthcheck. ca-certificates: outbound TLS (none used today).
RUN apk add --no-cache ca-certificates curl \
 && mkdir -p /data
COPY --from=build /out/minio /usr/bin/minio
EXPOSE 9000 9001
VOLUME ["/data"]
ENTRYPOINT ["/usr/bin/minio"]
