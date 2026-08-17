-- Migration: add endpointConfig to collections
-- Allows per-collection override of the request (path, method, headers, queryParams, body)
-- on top of the base DataSource configuration.
-- NOTE: this project uses camelCase column names (TypeORM default, no snake_case strategy).

ALTER TABLE collections
  ADD COLUMN IF NOT EXISTS "endpointConfig" jsonb DEFAULT NULL;
