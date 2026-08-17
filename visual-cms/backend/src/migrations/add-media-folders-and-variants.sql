-- Migration: Media folders + image variants + optimized version
-- Date: 2026-06-15
-- 1) media_folders: вложенные папки (дерево) для организации медиатеки.
-- 2) media_assets: + оптимизированная версия, + адаптивные варианты (jsonb), + folderId.
-- Все операции идемпотентны (IF NOT EXISTS) — безопасны для повторного запуска.

CREATE TABLE IF NOT EXISTS media_folders (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- null = глобальная папка (как и у ассетов)
  "siteId"    UUID REFERENCES sites(id) ON DELETE CASCADE,
  -- null = папка в корне; удаление родителя каскадит на детей (на практике
  -- сервис запрещает удалять непустую папку, FK — лишь страховка)
  "parentId"  UUID REFERENCES media_folders(id) ON DELETE CASCADE,
  name        VARCHAR(255) NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_folders_site   ON media_folders("siteId");
CREATE INDEX IF NOT EXISTS idx_media_folders_parent ON media_folders("parentId");

ALTER TABLE media_assets
  ADD COLUMN IF NOT EXISTS "optimizedStorageKey" VARCHAR(512),
  ADD COLUMN IF NOT EXISTS "optimizedSizeBytes"  BIGINT,
  -- variants: [{ width, height, storageKey, sizeBytes }]
  ADD COLUMN IF NOT EXISTS variants              JSONB,
  -- удаление папки осиротляет ассеты в корень (folderId -> NULL)
  ADD COLUMN IF NOT EXISTS "folderId"            UUID REFERENCES media_folders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_media_assets_folder ON media_assets("folderId");
