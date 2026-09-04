-- Тексты и медиа секций страницы проекта, которые раньше были захардкожены
-- в блоках CMS (#about, #hall, #choice, #location). Все — переводимые
-- (кроме panoramaUrl), поэтому попадают в COMPLEX_TR_FIELDS.
--
-- locationLabels: [{label, accent, top, left}] — подписи на карте проекта.
-- Координаты хранятся здесь, а не в вёрстке, потому что метка привязана
-- к месту на карте КОНКРЕТНОГО проекта: своя карта — свои координаты.

ALTER TABLE complexes ADD COLUMN IF NOT EXISTS "aboutTitle"     varchar(200) NOT NULL DEFAULT '';
ALTER TABLE complexes ADD COLUMN IF NOT EXISTS "hallTitle"      varchar(200) NOT NULL DEFAULT '';
ALTER TABLE complexes ADD COLUMN IF NOT EXISTS "hallText"       text         NOT NULL DEFAULT '';
ALTER TABLE complexes ADD COLUMN IF NOT EXISTS "address"        varchar(300) NOT NULL DEFAULT '';
ALTER TABLE complexes ADD COLUMN IF NOT EXISTS "locationTitle"  varchar(200) NOT NULL DEFAULT '';
ALTER TABLE complexes ADD COLUMN IF NOT EXISTS "locationLabels" jsonb        NOT NULL DEFAULT '[]';
ALTER TABLE complexes ADD COLUMN IF NOT EXISTS "panoramaUrl"    varchar(500) NOT NULL DEFAULT '';
