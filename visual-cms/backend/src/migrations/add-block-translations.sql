-- Migration: block_translations
-- Date: 2026-10-07
-- Переводы узлов библиотечных блоков живут у блока, а не у страницы: блок
-- подключается ко многим страницам (и выбирается слайдом из данных коллекции),
-- и его перевод должен быть один. Перевод страницы = переводы её собственных
-- узлов (translations) + переводы её блоков (block_translations). Владельца
-- узла решает services/translationOwnership.ts.
--
-- locale '*' — отметка «один текст для всех языков» (value: 'same' | 'translate').
--
-- Ключ — блок + узел: у копий блоков id узлов совпадают, по одному nodeId
-- перевод был бы неоднозначен. Строки страниц переносит сюда скрипт
-- scripts/migrate-block-translations.ts (с проверкой «до = после»).

CREATE TABLE IF NOT EXISTS block_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "blockId" UUID NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
  locale VARCHAR(10) NOT NULL,
  "nodeId" VARCHAR(255) NOT NULL,
  field VARCHAR(50) NOT NULL,
  value TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_block_translations_key
  ON block_translations ("blockId", locale, "nodeId", field);

CREATE INDEX IF NOT EXISTS idx_block_translations_block_locale
  ON block_translations ("blockId", locale);

COMMENT ON TABLE block_translations IS 'Translation overlays for nodes of library blocks; shared by every page that links the block.';
COMMENT ON COLUMN block_translations.locale IS 'Language code, or * for the "same text in all languages" mark (value: same | translate)';
