-- Яркость верхней полосы картинки (YIQ, 0..255) — того, над чем висит шапка
-- сайта. По ней слайд карусели с этим фото получает тему шапки при публикации
-- (services/headerTheme.ts). Считается при загрузке; для уже загруженных —
-- scripts/backfill-media-top-brightness.ts.
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS "topBrightness" smallint;
