-- Migration: Add Translation System (Languages + Translations tables)
-- This migration adds i18n support to the visual CMS.
-- Run this if synchronize: false or to apply manually.

-- ==========================================
-- 1. Languages table
-- ==========================================
CREATE TABLE IF NOT EXISTS languages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(10) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  "nativeName" VARCHAR(100) NOT NULL,
  flag VARCHAR(10),
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "order" INTEGER NOT NULL DEFAULT 0,
  direction VARCHAR(3) NOT NULL DEFAULT 'ltr',
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE languages IS 'Supported languages for the CMS translation system';
COMMENT ON COLUMN languages.code IS 'ISO 639-1 language code (e.g., en, ru, kz)';
COMMENT ON COLUMN languages."isDefault" IS 'The default (source) language. Only one can be default.';
COMMENT ON COLUMN languages.direction IS 'Text direction: ltr or rtl';

-- ==========================================
-- 2. Translations table
-- ==========================================
CREATE TABLE IF NOT EXISTS translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "pageId" UUID NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  locale VARCHAR(10) NOT NULL,
  "nodeId" VARCHAR(255) NOT NULL,
  field VARCHAR(50) NOT NULL,
  value TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_translations_page_locale 
  ON translations ("pageId", locale);
CREATE INDEX IF NOT EXISTS idx_translations_page_locale_node 
  ON translations ("pageId", locale, "nodeId");

COMMENT ON TABLE translations IS 'Translation overlays for page content. Each row translates one field of one BlockNode.';
COMMENT ON COLUMN translations."nodeId" IS 'BlockNode ID within page structure, or __page__ for page-level metadata';
COMMENT ON COLUMN translations.field IS 'Field being translated: content, src, alt, href, placeholder, title, meta:title, etc.';
COMMENT ON COLUMN translations.status IS 'Translation workflow status: draft, review, approved, published';

-- ==========================================
-- 3. Seed default languages
-- ==========================================
INSERT INTO languages (code, name, "nativeName", flag, "isDefault", "isActive", "order", direction)
VALUES 
  ('ru', 'Russian', 'Русский', '🇷🇺', true, true, 0, 'ltr'),
  ('en', 'English', 'English', '🇬🇧', false, true, 1, 'ltr')
ON CONFLICT (code) DO NOTHING;
