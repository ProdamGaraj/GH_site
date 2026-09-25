/**
 * Проверка генератора стиля карты: node --test scripts/map/generate-style.test.js
 *
 * @protomaps/basemaps подменён заглушкой — проверяем то, что решаем мы сами:
 * пути от /map/, тёплую гамму поверх light, отключённые значки заведений и
 * русские подписи. Что слои из flavor строятся верно — забота basemaps.
 */
'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { buildStyle, WARM, LANG } = require('./generate-style')

function fakeBasemaps() {
  const calls = []
  return {
    calls,
    namedFlavor: (name) => ({ name, background: '#ffffff', water: '#0000ff', roads_major: '#aaaaaa', pois: { blue: '#00f' } }),
    layers: (source, flavor, options) => {
      calls.push({ source, flavor, options })
      return [{ id: 'background', type: 'background' }]
    },
  }
}

test('пути к шрифтам, спрайту и тайлам — от корня сайта /map/', () => {
  const style = buildStyle(fakeBasemaps(), 'tashkent-20260925.pmtiles')
  assert.equal(style.version, 8)
  assert.equal(style.glyphs, '/map/fonts/{fontstack}/{range}.pbf')
  assert.equal(style.sprite, '/map/sprites/v4/light')
  assert.equal(style.sources.protomaps.type, 'vector')
  assert.equal(style.sources.protomaps.url, 'pmtiles:///map/tiles/tashkent-20260925.pmtiles')
})

test('атрибуция OpenStreetMap обязательна (лицензия ODbL)', () => {
  const { attribution } = buildStyle(fakeBasemaps(), 't.pmtiles').sources.protomaps
  assert.match(attribution, /OpenStreetMap/)
  assert.match(attribution, /openstreetmap\.org\/copyright/)
})

test('слои строятся из flavor light с тёплой гаммой, без значков заведений, по-русски', () => {
  const basemaps = fakeBasemaps()
  const style = buildStyle(basemaps, 't.pmtiles')
  assert.equal(basemaps.calls.length, 1)
  const { source, flavor, options } = basemaps.calls[0]
  assert.equal(source, 'protomaps')
  assert.equal(flavor.name, 'light')
  assert.equal(flavor.background, WARM.background)
  assert.equal(flavor.water, WARM.water)
  assert.equal(flavor.roads_major, '#aaaaaa', 'цвета вне тёплой гаммы остаются от light')
  assert.equal(flavor.pois, undefined)
  assert.deepEqual(options, { lang: 'ru' })
  assert.equal(LANG, 'ru')
  assert.deepEqual(style.layers, [{ id: 'background', type: 'background' }])
})

test('тёплая гамма — только корректные hex-цвета', () => {
  for (const [key, color] of Object.entries(WARM)) {
    assert.match(color, /^#[0-9a-f]{6}$/, key)
  }
})
