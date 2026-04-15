-- Migration: Add Collections system
-- Date: 2026-04-06
-- Column names match TypeORM camelCase convention

-- ==============================================
-- 1. Add isTemplate to pages
-- ==============================================
ALTER TABLE pages ADD COLUMN IF NOT EXISTS "isTemplate" BOOLEAN DEFAULT false;

-- ==============================================
-- 2. Create collections table
-- ==============================================
CREATE TABLE IF NOT EXISTS collections (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "siteId"        UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,

  "dataSourceId"  UUID NOT NULL REFERENCES data_sources(id) ON DELETE RESTRICT,
  "arrayPath"     VARCHAR(255) NOT NULL DEFAULT 'data',

  "templatePageId" UUID NOT NULL REFERENCES pages(id) ON DELETE RESTRICT,

  "basePath"      VARCHAR(255) NOT NULL,
  "slugField"     VARCHAR(255) NOT NULL,
  "titleField"    VARCHAR(255) NOT NULL DEFAULT 'title',

  "linkMode"      VARCHAR(50) NOT NULL DEFAULT 'auto',
  "linkTextField" VARCHAR(255),

  "isActive"      BOOLEAN NOT NULL DEFAULT true,
  "itemsOrder"    VARCHAR(50) NOT NULL DEFAULT 'api',

  "useCache"      BOOLEAN NOT NULL DEFAULT true,
  "cacheTtl"      INTEGER NOT NULL DEFAULT 600,
  "pollInterval"  INTEGER NOT NULL DEFAULT 300,

  "indexPageId"   UUID REFERENCES pages(id) ON DELETE SET NULL,

  "cachedApiData" JSONB,
  "lastCachedAt"  TIMESTAMPTZ,

  "createdAt"     TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt"     TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_collections_site_id ON collections("siteId");
CREATE INDEX IF NOT EXISTS idx_collections_data_source_id ON collections("dataSourceId");

-- ==============================================
-- 3. Create collection_overrides table
-- ==============================================
CREATE TABLE IF NOT EXISTS collection_overrides (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "collectionId"  UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,

  "apiItemId"     VARCHAR(255) NOT NULL,
  "apiItemSlug"   VARCHAR(255),
  "customPageId"  UUID NOT NULL REFERENCES pages(id) ON DELETE CASCADE,

  "createdAt"     TIMESTAMP NOT NULL DEFAULT NOW(),

  UNIQUE("collectionId", "apiItemId")
);

CREATE INDEX IF NOT EXISTS idx_collection_overrides_collection_id ON collection_overrides("collectionId");
