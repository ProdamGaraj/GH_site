# map-assets

Собирается скриптом `scripts/map/build-map-assets.sh`, nginx отдаёт каталог по
адресу `/map/`. Содержимое в git не кладётся — этот файл держит сам каталог,
чтобы Docker не создавал его при старте `public-site`.

Подробности: `scripts/map/README.md`.
