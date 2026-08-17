-- Migration: Add server-side transforms to collections
-- Date: 2026-05-22
-- Серверные трансформации элементов коллекции (как у дата-биндингов):
-- include/exclude (по условию), sort, limit, unique, prepend, append.
-- transforms — массив DataTransformConfig, применяется DataTransformService
-- при чтении элементов (getItems) и при деплое.
-- Заменяет более узкое поле filters (если оно успело появиться в dev).

ALTER TABLE collections
  ADD COLUMN IF NOT EXISTS "transforms" JSONB;

ALTER TABLE collections
  DROP COLUMN IF EXISTS "filters";
