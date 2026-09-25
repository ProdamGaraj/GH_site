#!/usr/bin/env node
/**
 * Стиль карты проекта для MapLibre — из слоёв Protomaps (@protomaps/basemaps).
 *
 * Запускается из build-map-assets.sh; руками — когда меняются цвета:
 *   node generate-style.js <basemaps index.cjs> <имя файла тайлов> <куда писать style.json>
 *
 * Основа — flavor «light», перекрашенный в тёплую гамму дизайна сайта (фон
 * #f4f1ea, как у карточек). Значки чужих заведений (pois) не подключаются:
 * на карте проекта главные — наши места, у них свои иконки и цвета. Подписи —
 * по-русски; где русского имени в OSM нет, остаётся исходное.
 *
 * Пути в стиле — от корня сайта (/map/…). MapLibre нужны полные адреса, их
 * подставляет рантайм карты по адресу страницы: один и тот же style.json
 * работает на стенде и на боевом сайте.
 */
'use strict'

const fs = require('fs')

/** Тёплая гамма поверх flavor «light» — как в прототипе, одобренном владельцем. */
const WARM = {
  background: '#f4f1ea',
  earth: '#f4f1ea',
  park_a: '#e4e8d8',
  park_b: '#d9e2c8',
  wood_a: '#dfe5d3',
  wood_b: '#d3dcc2',
  scrub_a: '#e6e8da',
  scrub_b: '#dde2cf',
  water: '#cfdde3',
  buildings: '#e7e1d5',
  school: '#efe9dc',
  hospital: '#efe4df',
  industrial: '#e9e6df',
  pedestrian: '#efebe2',
  pier: '#efebe2',
}

const LANG = 'ru'

function buildStyle(basemaps, tilesFile) {
  const flavor = { ...basemaps.namedFlavor('light'), ...WARM, pois: undefined }
  return {
    version: 8,
    name: 'Golden House — карта проекта',
    glyphs: '/map/fonts/{fontstack}/{range}.pbf',
    sprite: '/map/sprites/v4/light',
    sources: {
      protomaps: {
        type: 'vector',
        url: `pmtiles:///map/tiles/${tilesFile}`,
        attribution: '© <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>, <a href="https://protomaps.com">Protomaps</a>',
      },
    },
    layers: basemaps.layers('protomaps', flavor, { lang: LANG }),
  }
}

module.exports = { buildStyle, WARM, LANG }

if (require.main === module) {
  const [basemapsPath, tilesFile, outPath] = process.argv.slice(2)
  if (!basemapsPath || !tilesFile || !outPath) {
    console.error('usage: node generate-style.js <basemaps index.cjs> <tiles file> <out style.json>')
    process.exit(2)
  }
  const style = buildStyle(require(require('path').resolve(basemapsPath)), tilesFile)
  fs.writeFileSync(outPath, JSON.stringify(style))
  console.log(`style.json: ${style.layers.length} слоёв, тайлы ${tilesFile}`)
}
