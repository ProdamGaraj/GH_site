-- Проекты на сайте: публикация, карточка на главной, распроданные.
--
-- "showOnSite"  — проект есть на сайте: карточка на главной и страница
--                 проекта. Публичное API отдаёт только такие ЖК. Новый ЖК по
--                 умолчанию скрыт — его выставляют, когда он готов; те, что
--                 уже есть, остаются на сайте (решение владельца 2026-09-28).
-- "filterClass" — класс карточки для фильтра на главной: comfort | business | premium.
-- "cardImage"   — картинка карточки на главной; пусто — About-медиа или первый hero.
-- "cardTags"    — теги карточки («Ремонт в подарок», «Рассрочка»). Переводы —
--                 в estate_translations полем cardTags (JSON-массив).
--
-- Распроданность — прежний "status" = 'sold_out': тег «Распродано» на карточке и
-- странице, планировки без цен (services/i18n.ts).

ALTER TABLE complexes
  ADD COLUMN IF NOT EXISTS "showOnSite" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "filterClass" varchar(20) NOT NULL DEFAULT 'business',
  ADD COLUMN IF NOT EXISTS "cardImage" varchar(500) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "cardTags" jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE complexes SET "showOnSite" = true;
