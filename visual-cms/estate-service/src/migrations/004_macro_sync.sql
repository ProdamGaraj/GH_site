-- Синхронизация квартир и планировок из MacroCRM.
--
-- 1. complexes."externalId" → "externalHouseId". Имя врало: в MacroCRM у нас
--    комплекс — это ДОМ (houseId), а не ЖК (complexId). Проверено на данных:
--    квартира 5139781 имеет houseId 5139395 и complexId 5139393, и 5139395 —
--    ровно тот id, что заведён у нас как externalId проекта ozmakon-business.
--    Запрос квартир уходит с houseIds, не с complexIds.
--
-- 2. plan_types — типы планировок. Одна планировка на много квартир: MacroCRM
--    отдаёт planName и файлы по одной квартире (getFlatPlans), мы группируем
--    и храним тип, а не копию картинки на каждую квартиру.
--

-- --- 1. Переименование --------------------------------------------------

-- RENAME не идемпотентен, поэтому под условием: миграция может доехать на базу,
-- где её уже применили руками, или где колонки 003 ещё нет вовсе.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'complexes' AND column_name = 'externalId'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'complexes' AND column_name = 'externalHouseId'
  ) THEN
    ALTER TABLE complexes RENAME COLUMN "externalId" TO "externalHouseId";
  END IF;
END $$;

ALTER TABLE complexes ADD COLUMN IF NOT EXISTS "externalHouseId" integer;

DROP INDEX IF EXISTS idx_complexes_external_id;
CREATE UNIQUE INDEX IF NOT EXISTS idx_complexes_external_house_id
  ON complexes ("externalHouseId") WHERE "externalHouseId" IS NOT NULL;

-- --- 2. Дома ------------------------------------------------------------

-- Квартиры из Macro привязаны к houseId. У нас Apartment висит на House через
-- FK, значит дому нужен свой внешний id: синк по нему находит или заводит дом,
-- не трогая руками заведённые.
ALTER TABLE houses ADD COLUMN IF NOT EXISTS "externalId" integer;
CREATE UNIQUE INDEX IF NOT EXISTS idx_houses_external_id
  ON houses ("externalId") WHERE "externalId" IS NOT NULL;

-- --- 3. Типы планировок -------------------------------------------------

CREATE TABLE IF NOT EXISTS plan_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "complexId" uuid NOT NULL REFERENCES complexes(id) ON DELETE CASCADE,
  "houseId" uuid NOT NULL REFERENCES houses(id) ON DELETE CASCADE,

  -- Ключ группировки: planName + хеш набора files[].url. Стабилен между
  -- прогонами, поэтому upsert по нему сохраняет id, а значит и переводы.
  signature varchar(200) NOT NULL,

  -- Имя планировки в CRM ("К2-54.65-6"). Не равно площади: у квартиры 5139408
  -- planName «К2-54.65-6» при areaTotal 56.12.
  "planName" varchar(200) NOT NULL DEFAULT '',

  -- [{ title, url, thumbUrl }] из getFlatPlans.
  images jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Ссылка на 3D-тур, если у квартир этого типа она есть. Заполнена примерно
  -- у половины квартир и только в одном доме — поле опциональное.
  "panoUrl" varchar(500) NOT NULL DEFAULT '',

  rooms integer NOT NULL DEFAULT 0,
  "isStudio" boolean NOT NULL DEFAULT false,

  -- Площадь — диапазон, а не число: один planName может накрывать квартиры,
  -- отличающиеся на сотые доли метра.
  "areaMin" numeric(8, 2) NOT NULL DEFAULT 0,
  "areaMax" numeric(8, 2) NOT NULL DEFAULT 0,

  -- Цены в UZS (из копеек Macro делим на 100 на приёме).
  "priceMin" bigint NOT NULL DEFAULT 0,
  "priceMax" bigint NOT NULL DEFAULT 0,

  -- Агрегаты по квартирам типа: карточка фильтруется без обращения к квартирам.
  "apartmentsCount" integer NOT NULL DEFAULT 0,
  floors jsonb NOT NULL DEFAULT '[]'::jsonb,
  entrances jsonb NOT NULL DEFAULT '[]'::jsonb,
  "windowViews" jsonb NOT NULL DEFAULT '[]'::jsonb,

  "order" integer NOT NULL DEFAULT 0,
  "createdAt" timestamptz NOT NULL DEFAULT NOW(),
  "updatedAt" timestamptz NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_plan_types_house_signature
  ON plan_types ("houseId", signature);
CREATE INDEX IF NOT EXISTS idx_plan_types_complex ON plan_types ("complexId");

-- --- 4. Квартиры --------------------------------------------------------

ALTER TABLE apartments ADD COLUMN IF NOT EXISTS "externalId" integer;
ALTER TABLE apartments ADD COLUMN IF NOT EXISTS "planTypeId" uuid
  REFERENCES plan_types(id) ON DELETE SET NULL;

-- dateModified из Macro: если не менялся — планировку повторно не запрашиваем.
-- planProbedAt — когда мы последний раз ходили в getFlatPlans по этой квартире.
ALTER TABLE apartments ADD COLUMN IF NOT EXISTS "dateModified" timestamptz;
ALTER TABLE apartments ADD COLUMN IF NOT EXISTS "planProbedAt" timestamptz;

-- Поля, которые приходят из Macro и нужны фильтрам.
ALTER TABLE apartments ADD COLUMN IF NOT EXISTS "windowView" varchar(120) NOT NULL DEFAULT '';
ALTER TABLE apartments ADD COLUMN IF NOT EXISTS "floorNumber" integer;

CREATE UNIQUE INDEX IF NOT EXISTS idx_apartments_external_id
  ON apartments ("externalId") WHERE "externalId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_apartments_plan_type ON apartments ("planTypeId");

-- Журнала прогонов здесь нет намеренно: синк выполняется в backend CMS, там же
-- живут кнопка, расписание и возобновление после рестарта. Таблица sync_runs
-- заведена в базе CMS (migrations/add-macro-sync-runs.sql).
