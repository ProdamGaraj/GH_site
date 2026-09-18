-- Счётчики картинок в журнале синхронизации.
--
-- Отдельным файлом, а не дописыванием в add-macro-sync-runs.sql: раннер
-- отмечает применённые миграции ПО ИМЕНИ ФАЙЛА, и правка уже применённой
-- не выполнится никогда. Колонки при этом появятся в сущности, и первый же
-- SELECT упадёт с «column does not exist».
--
-- Зачем счётчики. «Скачано 17» само по себе не отличает норму от поломки:
-- остальные 170 могли уже лежать в медиатеке с прошлого прогона. А неудачный
-- перенос раньше просто убирал ракурс с карточки, и узнать об этом было
-- неоткуда.

ALTER TABLE macro_sync_runs
  ADD COLUMN IF NOT EXISTS "imagesReused" integer NOT NULL DEFAULT 0;
ALTER TABLE macro_sync_runs
  ADD COLUMN IF NOT EXISTS "imagesFailed" integer NOT NULL DEFAULT 0;
