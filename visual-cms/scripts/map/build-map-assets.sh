#!/usr/bin/env bash
# Сборка карты проекта: тайлы OpenStreetMap, шрифты подписей, спрайт, MapLibre
# и стиль — в каталог, который nginx отдаёт по адресу /map/.
#
# Запуск на сервере (из корня репозитория, каталог visual-cms):
#   bash scripts/map/build-map-assets.sh
#   bash scripts/map/build-map-assets.sh --build=20260925 --bbox=69.05,41.15,69.55,41.50
#
# Что получится в map-assets/ (каталог в .gitignore, в git не кладётся):
#   tiles/tashkent-<сборка>.pmtiles  тайлы области (~30 МБ на Ташкент с пригородами)
#   fonts/<шрифт>/<диапазон>.pbf     Noto Sans Regular/Medium/Italic (SIL OFL 1.1, текст в fonts/OFL.txt)
#   sprites/v4/light*               значки базовой карты (MIT, из tangrams/icons)
#   lib/maplibre-gl-<версия>/        MapLibre GL JS (BSD-3-Clause)
#   lib/pmtiles-<версия>/            чтение PMTiles в браузере (BSD-3-Clause)
#   style.json, manifest.json       стиль и описание сборки — пишутся последними
#
# Тайлы вырезаются из ежедневной сборки планеты Protomaps без её скачивания:
# pmtiles берёт по сети только куски нужной области. Все версии закреплены —
# сборка повторяема. Обновлять раз в полгода–год: новая сборка кладёт новые
# тайлы рядом, переключает style.json и удаляет тайлы старше предыдущих.
set -euo pipefail

PMTILES_CLI_VERSION=1.31.2
MAPLIBRE_VERSION=4.7.1
PMTILES_JS_VERSION=4.5.0
BASEMAPS_VERSION=5.7.2
BASEMAPS_ASSETS_COMMIT=028c18f713baecad011301ff7a69acc39bcc2ae7
FONTS=("Noto Sans Regular" "Noto Sans Medium" "Noto Sans Italic")

BBOX="69.05,41.15,69.55,41.50"   # Ташкент с пригородами: lon,lat,lon,lat
MAXZOOM=15                         # дальше MapLibre растягивает детали сам
BUILD=""                           # дата сборки Protomaps; пусто — последняя

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="$(cd "$HERE/../.." && pwd)/map-assets"

for arg in "$@"; do
  case "$arg" in
    --build=*) BUILD="${arg#*=}" ;;
    --bbox=*) BBOX="${arg#*=}" ;;
    --maxzoom=*) MAXZOOM="${arg#*=}" ;;
    --out=*) OUT="${arg#*=}" ;;
    *) echo "Неизвестный параметр: $arg" >&2; exit 2 ;;
  esac
done

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$OUT"/tiles "$OUT"/fonts "$OUT"/sprites/v4 "$OUT"/lib

step() { echo "==> $*"; }

# --- Сборка Protomaps ---
if [ -z "$BUILD" ]; then
  BUILD="$(curl -fsSL https://build-metadata.protomaps.dev/builds.json |
    node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const b=JSON.parse(s);console.log(b[b.length-1].key.replace(".pmtiles",""))})')"
fi
case "$BUILD" in
  [0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]) ;;
  *) echo "Странная дата сборки: '$BUILD' (нужно YYYYMMDD)" >&2; exit 1 ;;
esac
TILES_FILE="tashkent-$BUILD.pmtiles"

# --- pmtiles CLI ---
case "$(uname -s)" in
  Linux) CLI_ARCHIVE="go-pmtiles_${PMTILES_CLI_VERSION}_Linux_x86_64.tar.gz"; CLI_BIN=pmtiles ;;
  MINGW*|MSYS*|CYGWIN*) CLI_ARCHIVE="go-pmtiles_${PMTILES_CLI_VERSION}_Windows_x86_64.zip"; CLI_BIN=pmtiles.exe ;;
  *) echo "Нет сборки pmtiles для $(uname -s)" >&2; exit 1 ;;
esac
step "pmtiles CLI $PMTILES_CLI_VERSION"
curl -fsSL -o "$WORK/$CLI_ARCHIVE" \
  "https://github.com/protomaps/go-pmtiles/releases/download/v${PMTILES_CLI_VERSION}/${CLI_ARCHIVE}"
case "$CLI_ARCHIVE" in
  *.zip) (cd "$WORK" && unzip -q -o "$CLI_ARCHIVE") ;;
  *) tar -xzf "$WORK/$CLI_ARCHIVE" -C "$WORK" ;;
esac

# --- Тайлы ---
if [ -s "$OUT/tiles/$TILES_FILE" ]; then
  step "тайлы $TILES_FILE уже есть — пропускаю"
else
  step "тайлы: сборка $BUILD, область $BBOX, до z$MAXZOOM"
  "$WORK/$CLI_BIN" extract "https://build.protomaps.com/$BUILD.pmtiles" "$WORK/$TILES_FILE" \
    --bbox="$BBOX" --maxzoom="$MAXZOOM" 2>&1 | grep -v "fetching chunks" || true
  [ -s "$WORK/$TILES_FILE" ] || { echo "pmtiles extract не создал файл" >&2; exit 1; }
  mv "$WORK/$TILES_FILE" "$OUT/tiles/$TILES_FILE"
fi

# --- Шрифты и спрайт ---
step "шрифты и спрайт (basemaps-assets ${BASEMAPS_ASSETS_COMMIT:0:7})"
curl -fsSL -o "$WORK/assets.tar.gz" \
  "https://codeload.github.com/protomaps/basemaps-assets/tar.gz/$BASEMAPS_ASSETS_COMMIT"
ASSETS_ROOT="basemaps-assets-$BASEMAPS_ASSETS_COMMIT"
members=("$ASSETS_ROOT/fonts/OFL.txt" "$ASSETS_ROOT/sprites/v4/light.json" "$ASSETS_ROOT/sprites/v4/light.png"
  "$ASSETS_ROOT/sprites/v4/light@2x.json" "$ASSETS_ROOT/sprites/v4/light@2x.png")
for font in "${FONTS[@]}"; do members+=("$ASSETS_ROOT/fonts/$font"); done
tar -xzf "$WORK/assets.tar.gz" -C "$WORK" "${members[@]}"
for font in "${FONTS[@]}"; do
  rm -rf "$OUT/fonts/$font"
  cp -r "$WORK/$ASSETS_ROOT/fonts/$font" "$OUT/fonts/$font"
done
cp "$WORK/$ASSETS_ROOT/fonts/OFL.txt" "$OUT/fonts/OFL.txt"
cp "$WORK/$ASSETS_ROOT"/sprites/v4/light* "$OUT/sprites/v4/"

# --- Библиотеки из npm ---
npm_file() { # пакет версия путь-в-пакете куда
  local name="$1" version="$2" file="$3" dest="$4"
  local base="${name##*/}" # у пакета со scope архив назван без него: @protomaps/basemaps → basemaps-5.7.2.tgz
  local tgz="$WORK/$base-$version.tgz" dir="$WORK/npm-$base-$version"
  [ -f "$tgz" ] || curl -fsSL -o "$tgz" "https://registry.npmjs.org/$name/-/$base-$version.tgz"
  mkdir -p "$dir"
  tar -xzf "$tgz" -C "$dir" "package/$file"
  mkdir -p "$(dirname "$dest")"
  cp "$dir/package/$file" "$dest"
}
step "MapLibre GL JS $MAPLIBRE_VERSION, pmtiles.js $PMTILES_JS_VERSION"
npm_file maplibre-gl "$MAPLIBRE_VERSION" dist/maplibre-gl.js "$OUT/lib/maplibre-gl-$MAPLIBRE_VERSION/maplibre-gl.js"
npm_file maplibre-gl "$MAPLIBRE_VERSION" dist/maplibre-gl.css "$OUT/lib/maplibre-gl-$MAPLIBRE_VERSION/maplibre-gl.css"
npm_file maplibre-gl "$MAPLIBRE_VERSION" dist/LICENSE.txt "$OUT/lib/maplibre-gl-$MAPLIBRE_VERSION/LICENSE.txt"
npm_file pmtiles "$PMTILES_JS_VERSION" dist/pmtiles.js "$OUT/lib/pmtiles-$PMTILES_JS_VERSION/pmtiles.js"

# --- Стиль и описание сборки: пишутся последними и атомарно ---
step "стиль (@protomaps/basemaps $BASEMAPS_VERSION)"
npm_file @protomaps/basemaps "$BASEMAPS_VERSION" dist/cjs/index.cjs "$WORK/basemaps.cjs"
node "$HERE/generate-style.js" "$WORK/basemaps.cjs" "$TILES_FILE" "$WORK/style.json"
cat > "$WORK/manifest.json" <<JSON
{
  "build": "$BUILD",
  "tiles": "tiles/$TILES_FILE",
  "bbox": [$BBOX],
  "maxzoom": $MAXZOOM,
  "maplibre": "lib/maplibre-gl-$MAPLIBRE_VERSION/maplibre-gl.js",
  "maplibreCss": "lib/maplibre-gl-$MAPLIBRE_VERSION/maplibre-gl.css",
  "pmtiles": "lib/pmtiles-$PMTILES_JS_VERSION/pmtiles.js",
  "style": "style.json",
  "generatedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
JSON
mv "$WORK/style.json" "$OUT/style.json"
mv "$WORK/manifest.json" "$OUT/manifest.json"

# --- Уборка: текущие и предыдущие тайлы остаются (кэш у посетителей), старше — нет ---
ls -1t "$OUT"/tiles/tashkent-*.pmtiles 2>/dev/null | tail -n +3 | while read -r old; do
  step "удаляю старые тайлы $(basename "$old")"
  rm -f "$old"
done

step "готово: $OUT"
du -sh "$OUT"/tiles "$OUT"/fonts "$OUT"/sprites "$OUT"/lib 2>/dev/null || true
