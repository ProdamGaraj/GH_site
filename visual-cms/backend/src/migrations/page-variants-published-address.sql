-- Варианты страницы: адрес (сайт + slug) уникален только среди опубликованных.
--
-- Было: глобальный UNIQUE(slug) от TypeORM — второй страницы с тем же адресом
-- не создать ни черновиком, ни даже в другом сайте.
-- Стало: черновиков у адреса сколько угодно, опубликован всегда один.
-- COALESCE: без него страницы без сайта (siteId NULL) между собой не сравнивались бы.

ALTER TABLE pages DROP CONSTRAINT IF EXISTS "UQ_fe66ca6a86dc94233e5d7789535";
DROP INDEX IF EXISTS "UQ_fe66ca6a86dc94233e5d7789535";

CREATE UNIQUE INDEX IF NOT EXISTS "UQ_pages_published_address"
  ON pages (COALESCE("siteId", '00000000-0000-0000-0000-000000000000'::uuid), slug)
  WHERE status = 'published';

-- Поиск вариантов адреса и опубликованного соседа идёт по slug.
CREATE INDEX IF NOT EXISTS "IDX_pages_slug" ON pages (slug);
