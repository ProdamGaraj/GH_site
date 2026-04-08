-- Migration: Add Collections system
-- Date: 2026-04-06

-- ==============================================
-- 1. Add is_template to pages
-- ==============================================
ALTER TABLE pages ADD COLUMN IF NOT EXISTS is_template BOOLEAN DEFAULT false;

-- ==============================================
-- 2. Create collections table
-- ==============================================
CREATE TABLE IF NOT EXISTS collections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,

  -- Источник данных
  data_source_id  UUID NOT NULL REFERENCES data_sources(id) ON DELETE RESTRICT,
  array_path      VARCHAR(255) DEFAULT 'data',

  -- Шаблон
  template_page_id UUID NOT NULL REFERENCES pages(id) ON DELETE RESTRICT,

  -- URL-генерация
  base_path       VARCHAR(255) NOT NULL,
  slug_field      VARCHAR(255) NOT NULL,
  title_field     VARCHAR(255) DEFAULT 'title',

  -- Авто-ссылки
  link_mode       VARCHAR(50) DEFAULT 'auto',
  link_text_field VARCHAR(255),

  -- Настройки
  is_active       BOOLEAN DEFAULT true,
  items_order     VARCHAR(50) DEFAULT 'api',

  -- Кеш и polling
  use_cache       BOOLEAN DEFAULT true,
  cache_ttl       INTEGER DEFAULT 600,
  poll_interval   INTEGER DEFAULT 300,

  -- Индексная страница (зарезервировано)
  index_page_id   UUID REFERENCES pages(id) ON DELETE SET NULL,

  -- Кеш данных API
  cached_api_data JSONB,
  last_cached_at  TIMESTAMPTZ,

  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_collections_site_id ON collections(site_id);
CREATE INDEX IF NOT EXISTS idx_collections_data_source_id ON collections(data_source_id);

-- ==============================================
-- 3. Create collection_overrides table
-- ==============================================
CREATE TABLE IF NOT EXISTS collection_overrides (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id   UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,

  api_item_id     VARCHAR(255) NOT NULL,
  api_item_slug   VARCHAR(255),
  custom_page_id  UUID NOT NULL REFERENCES pages(id) ON DELETE CASCADE,

  created_at      TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(collection_id, api_item_id)
);

CREATE INDEX IF NOT EXISTS idx_collection_overrides_collection_id ON collection_overrides(collection_id);
