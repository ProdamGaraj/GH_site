-- История версий блоков библиотеки.
--
-- Версия — состояние блока ДО изменения: триггер на blocks копирует старую
-- строку при каждом UPDATE и DELETE. Ловит все пути записи — редактор блока,
-- «отправить в библиотеку» со страницы, скрипты данных, прямой SQL; удалённый
-- блок восстанавливается из своей последней версии.
--
--   savedAt   — когда это состояние было сохранено (blocks."updatedAt" старой строки);
--   createdAt — когда его заменили или удалили;
--   source    — update | delete | restore | manual | initial; приложение может
--               задать свой источник на транзакцию: set_config('app.block_version_source', 'restore', true);
--   extra     — прочие поля строки (type, isReusable, groupId, tags, …) для
--               восстановления удалённого блока.
--
-- Хранение: последние 200 версий без метки на блок; версии с меткой — всегда.
-- Сохранение без изменений (та же структура и имя) версию не создаёт.
-- Идемпотентно.

CREATE TABLE IF NOT EXISTS block_versions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "blockId" uuid NOT NULL,
  version integer NOT NULL,
  name varchar NOT NULL,
  structure jsonb NOT NULL,
  extra jsonb NOT NULL DEFAULT '{}'::jsonb,
  source varchar(20) NOT NULL DEFAULT 'update',
  label varchar(255),
  "savedAt" timestamp,
  "createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_block_versions_block ON block_versions ("blockId", version DESC);

CREATE OR REPLACE FUNCTION block_versions_capture() RETURNS trigger AS $$
DECLARE
  src text;
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.structure IS NOT DISTINCT FROM NEW.structure
     AND OLD.name IS NOT DISTINCT FROM NEW.name THEN
    RETURN NEW;
  END IF;

  src := coalesce(
    nullif(current_setting('app.block_version_source', true), ''),
    CASE WHEN TG_OP = 'DELETE' THEN 'delete' ELSE 'update' END
  );

  INSERT INTO block_versions ("blockId", version, name, structure, extra, source, "savedAt")
  VALUES (
    OLD.id,
    coalesce((SELECT max(version) FROM block_versions WHERE "blockId" = OLD.id), 0) + 1,
    OLD.name,
    OLD.structure,
    to_jsonb(OLD) - 'structure' - 'name',
    src,
    OLD."updatedAt"
  );

  -- Хранение: 200 последних версий без метки.
  DELETE FROM block_versions
  WHERE id IN (
    SELECT id FROM block_versions
    WHERE "blockId" = OLD.id AND label IS NULL
    ORDER BY version DESC
    OFFSET 200
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS blocks_versioning ON blocks;
CREATE TRIGGER blocks_versioning
  BEFORE UPDATE OR DELETE ON blocks
  FOR EACH ROW EXECUTE FUNCTION block_versions_capture();

-- Начало истории: текущее состояние каждого блока — первой версией с меткой
-- (метка — чтобы хранение её не вытеснило).
INSERT INTO block_versions ("blockId", version, name, structure, extra, source, label, "savedAt")
SELECT b.id, 1, b.name, b.structure, to_jsonb(b) - 'structure' - 'name', 'initial', 'Начало истории', b."updatedAt"
FROM blocks b
WHERE NOT EXISTS (SELECT 1 FROM block_versions v WHERE v."blockId" = b.id);
