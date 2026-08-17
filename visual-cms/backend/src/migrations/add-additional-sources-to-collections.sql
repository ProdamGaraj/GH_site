-- Migration: add additionalSources to collections
-- Per-item additional API requests for collection template pages.
-- Placeholders {{item.field}} are resolved at deploy time; data is baked in as page-variable.
-- NOTE: this project uses camelCase column names (TypeORM default).

ALTER TABLE collections
  ADD COLUMN IF NOT EXISTS "additionalSources" jsonb DEFAULT NULL;
