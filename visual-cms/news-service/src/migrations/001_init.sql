-- news-service schema (идемпотентно). Соответствует моделям TypeORM.

-- Рубрики (бейдж карточки: «Новости», «Акции»). Ключ неизменен — на него
-- ссылаются новости; рубрика, которой пользуются, не удаляется, а прячется.
CREATE TABLE IF NOT EXISTS news_categories (
  key           varchar(40) PRIMARY KEY,
  "nameRu"      varchar(80) NOT NULL,
  "nameUz"      varchar(80) NOT NULL DEFAULT '',
  "nameEn"      varchar(80) NOT NULL DEFAULT '',
  "order"       int NOT NULL DEFAULT 0,
  hidden        boolean NOT NULL DEFAULT false,
  "createdAt"   timestamptz NOT NULL DEFAULT now(),
  "updatedAt"   timestamptz NOT NULL DEFAULT now()
);

-- Теги. Так же: неизменный ключ, перевод колонками.
CREATE TABLE IF NOT EXISTS news_tags (
  key           varchar(40) PRIMARY KEY,
  "nameRu"      varchar(80) NOT NULL,
  "nameUz"      varchar(80) NOT NULL DEFAULT '',
  "nameEn"      varchar(80) NOT NULL DEFAULT '',
  "order"       int NOT NULL DEFAULT 0,
  hidden        boolean NOT NULL DEFAULT false,
  "createdAt"   timestamptz NOT NULL DEFAULT now(),
  "updatedAt"   timestamptz NOT NULL DEFAULT now()
);

-- Новость. Базовый язык — ru; переводы uz/en — в news_translations.
-- hero/cover/sections — jsonb (см. services/news.ts): секции хранят свой id,
-- порядок массива = порядок блоков на странице.
CREATE TABLE IF NOT EXISTS news (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          varchar(120) NOT NULL,
  "slugLocked"  boolean NOT NULL DEFAULT false,
  status        varchar(20) NOT NULL DEFAULT 'draft',
  "publishedAt" timestamptz NULL,
  "categoryKey" varchar(40) NULL REFERENCES news_categories(key) ON UPDATE CASCADE,
  "tagKeys"     text[] NOT NULL DEFAULT '{}',
  title         varchar(300) NOT NULL DEFAULT '',
  lead          text NOT NULL DEFAULT '',
  cover         jsonb NULL,
  hero          jsonb NOT NULL DEFAULT '[]',
  sections      jsonb NOT NULL DEFAULT '[]',
  "publishOn"   text[] NOT NULL DEFAULT '{}',
  "createdAt"   timestamptz NOT NULL DEFAULT now(),
  "updatedAt"   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_news_slug ON news (slug);
CREATE INDEX IF NOT EXISTS idx_news_status_date ON news (status, "publishedAt" DESC);

-- Overlay-переводы новостей (как estate_translations): поле title/lead —
-- строка, sections — json {"<id секции>": {"html": "..."}}.
CREATE TABLE IF NOT EXISTS news_translations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "newsId"      uuid NOT NULL REFERENCES news(id) ON DELETE CASCADE,
  locale        varchar(10) NOT NULL,
  field         varchar(60) NOT NULL,
  value         text NOT NULL DEFAULT '',
  "createdAt"   timestamptz NOT NULL DEFAULT now(),
  "updatedAt"   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_news_tr_unique ON news_translations ("newsId", locale, field);

-- Что выкачено на сайт: CMS сообщает после деплоя коллекции новостей.
-- Публичная лента отдаёт только выкаченное — иначе карточка вела бы на 404.
CREATE TABLE IF NOT EXISTS news_deployments (
  "newsId"      uuid NOT NULL REFERENCES news(id) ON DELETE CASCADE,
  locale        varchar(10) NOT NULL,
  "deployedAt"  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("newsId", locale)
);
