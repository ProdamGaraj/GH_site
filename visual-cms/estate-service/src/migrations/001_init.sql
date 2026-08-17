-- estate-service schema (идемпотентно). Соответствует моделям TypeORM.

CREATE TABLE IF NOT EXISTS complexes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          varchar(160) NOT NULL,
  "order"       int NOT NULL DEFAULT 0,
  status        varchar(20) NOT NULL DEFAULT 'active',
  name          varchar(200) NOT NULL,
  "className"   varchar(60) NOT NULL DEFAULT '',
  intro         text NOT NULL DEFAULT '',
  about         text NOT NULL DEFAULT '',
  "aboutExtra"  text NOT NULL DEFAULT '',
  "locationText" text NOT NULL DEFAULT '',
  "yardEyebrow" varchar(120) NOT NULL DEFAULT '',
  "yardTitle"   varchar(200) NOT NULL DEFAULT '',
  "yardText"    text NOT NULL DEFAULT '',
  "yardFeatures" jsonb NOT NULL DEFAULT '[]',
  stats         jsonb NOT NULL DEFAULT '[]',
  logo          varchar(500) NOT NULL DEFAULT '',
  "logoClass"   varchar(60) NOT NULL DEFAULT '',
  media         varchar(500) NOT NULL DEFAULT '',
  "aboutVideo"  varchar(500) NOT NULL DEFAULT '',
  "mapUrl"      varchar(500) NOT NULL DEFAULT '',
  "mapImage"    varchar(500) NOT NULL DEFAULT '',
  "heroImages"  jsonb NOT NULL DEFAULT '[]',
  gallery       jsonb NOT NULL DEFAULT '[]',
  "hallGallery" jsonb NOT NULL DEFAULT '[]',
  "yardGallery" jsonb NOT NULL DEFAULT '[]',
  "createdAt"   timestamptz NOT NULL DEFAULT now(),
  "updatedAt"   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_complexes_slug ON complexes (slug);

CREATE TABLE IF NOT EXISTS houses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "complexId"   uuid NOT NULL REFERENCES complexes(id) ON DELETE CASCADE,
  "order"       int NOT NULL DEFAULT 0,
  name          varchar(120) NOT NULL DEFAULT '',
  floors        varchar(60) NOT NULL DEFAULT '',
  deadline      varchar(60) NOT NULL DEFAULT '',
  "className"   varchar(60) NOT NULL DEFAULT '',
  entrances     int,
  "createdAt"   timestamptz NOT NULL DEFAULT now(),
  "updatedAt"   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_houses_complex ON houses ("complexId");

CREATE TABLE IF NOT EXISTS apartments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "houseId"     uuid NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
  "order"       int NOT NULL DEFAULT 0,
  rooms         int NOT NULL DEFAULT 0,
  "areaM2"      numeric(8,2) NOT NULL DEFAULT 0,
  price         bigint NOT NULL DEFAULT 0,
  "oldPrice"    bigint,
  entrance      int,
  "apartmentClass" varchar(60) NOT NULL DEFAULT '',
  badges        jsonb NOT NULL DEFAULT '[]',
  floor         varchar(20) NOT NULL DEFAULT '',
  number        varchar(40) NOT NULL DEFAULT '',
  deadline      varchar(60) NOT NULL DEFAULT '',
  "offerLabel"  varchar(80) NOT NULL DEFAULT '',
  status        varchar(20) NOT NULL DEFAULT 'available',
  "planImage"   varchar(500) NOT NULL DEFAULT '',
  "createdAt"   timestamptz NOT NULL DEFAULT now(),
  "updatedAt"   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_apartments_house ON apartments ("houseId");

CREATE TABLE IF NOT EXISTS estate_translations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entityType"  varchar(20) NOT NULL,
  "entityId"    uuid NOT NULL,
  locale        varchar(10) NOT NULL,
  field         varchar(60) NOT NULL,
  value         text NOT NULL DEFAULT '',
  "createdAt"   timestamptz NOT NULL DEFAULT now(),
  "updatedAt"   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_estate_tr_unique
  ON estate_translations ("entityType", "entityId", locale, field);
CREATE INDEX IF NOT EXISTS idx_estate_tr_lookup
  ON estate_translations ("entityType", "entityId", locale);
