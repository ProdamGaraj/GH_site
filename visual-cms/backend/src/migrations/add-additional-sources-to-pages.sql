-- Migration: add additionalSources to pages
-- Per-page additional API requests, baked into target bindings as page-variable at deploy time.
-- NOTE: this project uses camelCase column names (TypeORM default).

ALTER TABLE pages
  ADD COLUMN IF NOT EXISTS "additionalSources" jsonb DEFAULT NULL;
