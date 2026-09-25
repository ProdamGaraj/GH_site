# Карта проекта: свои тайлы

Карта на страницах ЖК работает целиком с нашего сервера: MapLibre GL JS рисует
векторные тайлы OpenStreetMap из одного файла PMTiles. Внешних API, ключей и
лимитов нет.

## Сборка

Из каталога `visual-cms` на сервере:

```bash
bash scripts/map/build-map-assets.sh
```

Скрипт кладёт всё в `visual-cms/map-assets/`, nginx отдаёт этот каталог по
адресу `/map/` (см. `nginx-public.shared.conf`, том `./map-assets` у
`public-site` в compose-файлах). Нужны `bash`, `curl`, `tar`, `node` и
доступ в интернет. Занимает около минуты, на диске ~45 МБ.

Параметры:

| Параметр | По умолчанию | Что это |
|---|---|---|
| `--build=YYYYMMDD` | последняя | ежедневная сборка планеты Protomaps |
| `--bbox=lon,lat,lon,lat` | `69.05,41.15,69.55,41.50` | область: Ташкент с пригородами |
| `--maxzoom=N` | `15` | глубже MapLibre растягивает детали сам |
| `--out=каталог` | `visual-cms/map-assets` | куда класть |

ЖК вне области покажется на пустом фоне — тогда расширить `--bbox` и
пересобрать.

## Обновление

Раз в полгода–год, чтобы подтянуть новые дома и улицы из OpenStreetMap:
запустить скрипт ещё раз. Новые тайлы ложатся рядом со старыми, `style.json`
переключается на них, тайлы старше предыдущих удаляются. Перезапускать nginx
не нужно.

Версии библиотек закреплены в начале скрипта. Поднимая MapLibre или pmtiles,
проверить карту на стенде: рантайм берёт пути к ним из `manifest.json`.

## Цвета

Стиль строит `generate-style.js` из слоёв `@protomaps/basemaps`: flavor
`light`, перекрашенный в тёплую гамму сайта (`WARM`). Значки чужих заведений
выключены. После правки цветов — пересобрать скриптом (тайлы не
перекачиваются) и проверить тесты:

```bash
node --test scripts/map/generate-style.test.js
```

## Карта на странице проекта

- Данные — estate-service (`services/projectMap.ts`): `mapHouse` (0..1, без
  точки дома карты нет), `mapPoints`, `mapLegend`, `mapOffices`. Координаты,
  места и типы мест задаются в админке estate.
- Разметка — блок «Complex location», миграция
  `backend/src/scripts/migrate-project-map.ts`.
- Рантайм — `backend/src/services/runtime/map-runtime.js`. Генератор вставляет
  его только в страницы с `[data-map]`. MapLibre подгружается, когда карта
  подъезжает к экрану.

## Проверка в браузере

После передеплоя страниц проектов или пересборки карты:

```bash
node scripts/map/check-project-map.js https://test_analytics.gh.uz/ru/complex/assalom-dostlik/
```

Проверяет отрисовку, ошибки, метки (не плывут ли при масштабировании),
легенду, подсказки, ссылки поездки и запасной список мест без `/map/`.
Скриншоты кладёт в `./map-check`. Нужны `playwright-core` из
`visual-cms/node_modules` и Chrome (`--chrome=путь`, если он не на обычном
месте).

## Что в каталоге и лицензии

| Путь | Что | Лицензия |
|---|---|---|
| `tiles/tashkent-<сборка>.pmtiles` | данные карты | © участники OpenStreetMap, ODbL — подпись на карте обязательна, её добавляет стиль |
| `fonts/` | Noto Sans для подписей | SIL Open Font License 1.1, текст в `fonts/OFL.txt` |
| `sprites/v4/` | значки базовой карты (protomaps/basemaps-assets) | MIT, производные от tangrams/icons |
| `lib/maplibre-gl-<версия>/` | MapLibre GL JS | BSD-3-Clause, текст в `LICENSE.txt` рядом |
| `lib/pmtiles-<версия>/` | чтение PMTiles в браузере | BSD-3-Clause |
| `style.json` | стиль | слои @protomaps/basemaps, BSD-3-Clause |
| `manifest.json` | сборка, версии, пути для рантайма | — |
