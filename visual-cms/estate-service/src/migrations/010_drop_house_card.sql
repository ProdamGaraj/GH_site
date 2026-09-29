-- Дом не меняет полей проекта.
--
-- Решение 2026-09-29: страница и карточка на главной — только у проекта. Дом
-- связан с MacroCRM (houses."externalId") и даёт странице проекта квартиры,
-- планировки и срок сдачи ("crmServiceYear/Month", ручной "deadline"), но
-- своих текстов, картинок и статуса у него нет. Убираем то, что 009 добавила
-- для карточки дома, и режим «на главной домами» у проекта.
--
-- Переводы карточки дома (intro, cardTags) — вместе с колонками: читать их
-- больше некому.

ALTER TABLE houses
  DROP COLUMN IF EXISTS "showOnSite",
  DROP COLUMN IF EXISTS "status",
  DROP COLUMN IF EXISTS "intro",
  DROP COLUMN IF EXISTS "cardImage",
  DROP COLUMN IF EXISTS "cardTags",
  DROP COLUMN IF EXISTS "filterClass";

ALTER TABLE complexes
  DROP COLUMN IF EXISTS "catalogMode";

DELETE FROM estate_translations
WHERE "entityType" = 'house'
  AND field IN ('intro', 'cardTags');
