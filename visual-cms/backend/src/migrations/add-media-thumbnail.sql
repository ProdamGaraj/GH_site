-- Migration: Add thumbnail key to media_assets
-- Date: 2026-05-08
-- Adds thumbnailStorageKey column for image thumbnails (webp, ~400px).

ALTER TABLE media_assets
  ADD COLUMN IF NOT EXISTS "thumbnailStorageKey" VARCHAR(512);
