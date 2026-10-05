-- Migration: collections.reportDeployTo
-- Date: 2026-10-05
-- Ключ интеграции, которой коллекция после деплоя сообщает, какие элементы
-- выкачены на каждом языке (services/deployReport.ts). news-service по этому
-- отчёту отдаёт в публичной ленте только выкаченные новости. NULL — никому.

ALTER TABLE collections
  ADD COLUMN IF NOT EXISTS "reportDeployTo" VARCHAR(40);
