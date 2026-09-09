-- Журнал прогонов синхронизации с MacroCRM.
--
-- Живёт в базе CMS, а не estate-service: синк выполняется здесь, здесь же
-- кнопка в интерфейсе и расписание. Курсор нужен для возобновления: полный
-- обход планировок двух домов — 339 запросов и около четырёх минут, за которые
-- контейнер может уехать в рестарт, а начинать заново значит второй раз съесть
-- лимит в 100 запросов в минуту.

CREATE TABLE IF NOT EXISTS macro_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "houseIds" jsonb NOT NULL DEFAULT '[]'::jsonb,
  status varchar(20) NOT NULL DEFAULT 'running',
  trigger varchar(20) NOT NULL DEFAULT 'manual',
  "apartmentsSeen" integer NOT NULL DEFAULT 0,
  "plansProbed" integer NOT NULL DEFAULT 0,
  "planTypesUpserted" integer NOT NULL DEFAULT 0,
  "imagesDownloaded" integer NOT NULL DEFAULT 0,
  "apiCalls" integer NOT NULL DEFAULT 0,
  cursor jsonb,
  error text,
  "startedAt" timestamptz NOT NULL DEFAULT NOW(),
  "finishedAt" timestamptz
);

CREATE INDEX IF NOT EXISTS idx_macro_sync_runs_started
  ON macro_sync_runs ("startedAt" DESC);
