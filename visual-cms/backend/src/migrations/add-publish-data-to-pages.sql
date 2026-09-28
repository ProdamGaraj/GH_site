-- Данные страницы при публикации: [{ name, dataSourceId, arrayPath? }].
-- Источники запрашиваются на деплое на языке страницы и подставляются в
-- разметку, как у страниц коллекции (DeployService.applyPublishData).
ALTER TABLE pages ADD COLUMN IF NOT EXISTS "publishData" jsonb;
