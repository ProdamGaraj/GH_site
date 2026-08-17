-- Migration: Add project stats support to collections
-- Date: 2026-05-05
-- Adds optional secondary data source for stats (e.g. MacroCRM v2 estateSell/list),
-- plus per-collection cache for aggregated stats by item id.

ALTER TABLE collections
  ADD COLUMN IF NOT EXISTS "statsDataSourceId" UUID REFERENCES data_sources(id) ON DELETE SET NULL;

ALTER TABLE collections
  ADD COLUMN IF NOT EXISTS "cachedStatsData" JSONB;

ALTER TABLE collections
  ADD COLUMN IF NOT EXISTS "cachedStatsAt" TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_collections_stats_data_source_id
  ON collections("statsDataSourceId");
