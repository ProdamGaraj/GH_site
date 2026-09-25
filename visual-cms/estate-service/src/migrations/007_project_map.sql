-- Карта проекта: точка дома, отдел продаж, места рядом и их типы.
--
-- У ЖК:
--   "housePoint"  {"lat": 41.31, "lng": 69.28} — точка дома, центр карты.
--                 NULL — карты на странице проекта нет.
--   "salesOffice" {"lat": …, "lng": …, "address": "…"} — отдел продаж;
--                 от него строятся кнопки «Вызвать такси» и «Маршрут».
--   "places"      [{"id": "<uuid>", "type": "school", "name": "…",
--                   "lat": …, "lng": …}] — места рядом. Переводы названий —
--                 в estate_translations полем placeNames: {id места: перевод}.
--
-- Типы мест — общие для всех ЖК: ключ неизменен (на него ссылаются места),
-- название на трёх языках, иконка из набора (services/mapIcons.ts), цвет.
-- Тип, которым пользуются места, удалить нельзя — его прячут флагом hidden.

ALTER TABLE complexes
  ADD COLUMN IF NOT EXISTS "housePoint" jsonb,
  ADD COLUMN IF NOT EXISTS "salesOffice" jsonb,
  ADD COLUMN IF NOT EXISTS "places" jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS place_types (
  "key"       varchar(40) PRIMARY KEY,
  "nameRu"    varchar(80) NOT NULL,
  "nameUz"    varchar(80) NOT NULL DEFAULT '',
  "nameEn"    varchar(80) NOT NULL DEFAULT '',
  "icon"      varchar(40) NOT NULL,
  "color"     varchar(7)  NOT NULL,
  "order"     integer     NOT NULL DEFAULT 0,
  "hidden"    boolean     NOT NULL DEFAULT false,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

-- Типы по умолчанию. ON CONFLICT — чтобы не перетирать правки из админки.
INSERT INTO place_types ("key", "nameRu", "nameUz", "nameEn", "icon", "color", "order") VALUES
  ('school',       'Школа',          'Maktab',            'School',        'school',         '#2f6fdf', 10),
  ('kindergarten', 'Детский сад',    'Bolalar bogʻchasi', 'Kindergarten',  'baby',           '#f08c2e', 20),
  ('university',   'Вуз',            'Oliygoh',           'University',    'graduation-cap', '#5a6b85', 30),
  ('hospital',     'Больница',       'Kasalxona',         'Hospital',      'hospital',       '#e04848', 40),
  ('clinic',       'Поликлиника',    'Poliklinika',       'Clinic',        'stethoscope',    '#d9534f', 50),
  ('pharmacy',     'Аптека',         'Dorixona',          'Pharmacy',      'pill',           '#14a37f', 60),
  ('park',         'Парк',           'Park',              'Park',          'trees',          '#3f9b4a', 70),
  ('metro',        'Метро',          'Metro',             'Metro',         'train-front',    '#7b4fd6', 80),
  ('shop',         'Магазин',        'Doʻkon',            'Shop',          'shopping-cart',  '#c0569a', 90),
  ('mall',         'Торговый центр', 'Savdo markazi',     'Shopping mall', 'shopping-bag',   '#a8458a', 100),
  ('sport',        'Спорт',          'Sport',             'Sport',         'dumbbell',       '#1f9bc9', 110),
  ('mosque',       'Мечеть',         'Masjid',            'Mosque',        'moon-star',      '#2e8b77', 120),
  ('bank',         'Банк',           'Bank',              'Bank',          'landmark',       '#8a6d3b', 130)
ON CONFLICT ("key") DO NOTHING;
