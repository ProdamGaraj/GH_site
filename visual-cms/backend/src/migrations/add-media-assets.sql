-- Migration: Media Library
-- Date: 2026-05-07
-- Adds media_assets table for storing image/video metadata.
-- Files themselves live in MinIO (bucket cms-media), referenced by storageKey.

CREATE TABLE IF NOT EXISTS media_assets (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "siteId"            UUID REFERENCES sites(id) ON DELETE CASCADE,
  kind                VARCHAR(16) NOT NULL,
  "fileName"          VARCHAR(512) NOT NULL,
  "mimeType"          VARCHAR(128) NOT NULL,
  "storageKey"        VARCHAR(512) NOT NULL UNIQUE,
  "posterStorageKey"  VARCHAR(512),
  "sizeBytes"         BIGINT NOT NULL DEFAULT 0,
  width               INTEGER,
  height              INTEGER,
  "durationSec"       INTEGER,
  title               VARCHAR(255),
  alt                 VARCHAR(512),
  tags                TEXT,
  "createdAt"         TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt"         TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_assets_site    ON media_assets("siteId");
CREATE INDEX IF NOT EXISTS idx_media_assets_kind    ON media_assets(kind);
CREATE INDEX IF NOT EXISTS idx_media_assets_created ON media_assets("createdAt" DESC);
