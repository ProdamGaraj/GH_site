-- Дом — единственная связь с MacroCRM, проект — объединение домов.
--
-- В CRM настоящий ключ только у дома (ID «проекта» в CRM не используется),
-- а в проект дома собираем мы: одна страница и, по желанию, одна карточка на
-- главной. Общие тексты, медиа и карта остаются у проекта; дом уточняет то,
-- что у него своё, — пустое поле дома берётся из проекта (services/i18n.ts).
--
-- Дом:
--   "crmServiceYear/Month" — срок сдачи из CRM (inServiceYear/Month), числами:
--                            на сайте выводится на языке страницы. Ручной
--                            "deadline" главнее.
--   "showOnSite"           — карточка дома на главной (когда проект показывается домами).
--   "status"               — active | sold_out: «Распродано» на карточке дома.
--   "intro"                — описание карточки; перевод — estate_translations.
--   "cardImage"/"cardTags" — картинка и теги карточки; пусто — как у проекта.
--   "filterClass"          — класс для фильтра на главной; пусто — как у проекта.
--
-- Проект:
--   "catalogMode" — project | houses: на главной одна карточка проекта или
--                   карточки его домов. По умолчанию — проектом, как было.

ALTER TABLE houses
  ADD COLUMN IF NOT EXISTS "crmServiceYear" int NULL,
  ADD COLUMN IF NOT EXISTS "crmServiceMonth" int NULL,
  ADD COLUMN IF NOT EXISTS "showOnSite" boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "status" varchar(20) NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS "intro" text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "cardImage" varchar(500) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "cardTags" jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "filterClass" varchar(20) NOT NULL DEFAULT '';

ALTER TABLE complexes
  ADD COLUMN IF NOT EXISTS "catalogMode" varchar(20) NOT NULL DEFAULT 'project';

-- Связь с CRM переезжает с проекта на дом. Дом, заведённый синхронизацией,
-- ID уже несёт. Единственному дому проекта без ID проставляем ID проекта —
-- так было устроено сопоставление раньше (SyncController.ensureHouse).
UPDATE houses h
SET "externalId" = c."externalHouseId"
FROM complexes c
WHERE h."complexId" = c.id
  AND h."externalId" IS NULL
  AND c."externalHouseId" IS NOT NULL
  AND (SELECT count(*) FROM houses x WHERE x."complexId" = c.id) = 1
  AND NOT EXISTS (SELECT 1 FROM houses y WHERE y."externalId" = c."externalHouseId");

-- Проект с ID, но без домов: заводим дом, иначе синхронизации некуда писать.
INSERT INTO houses ("complexId", "externalId", "name", "order")
SELECT c.id, c."externalHouseId", c.name, 0
FROM complexes c
WHERE c."externalHouseId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM houses h WHERE h."complexId" = c.id)
  AND NOT EXISTS (SELECT 1 FROM houses h WHERE h."externalId" = c."externalHouseId");

-- complexes."externalHouseId" больше не читается; колонка остаётся до
-- следующей миграции, чтобы откат кода не терял данные.
