/**
 * Тема шапки над фото-слайдом: яркость верхней полосы картинки считается при
 * загрузке, при публикации слайд получает data-header-theme. Слайдер главной —
 * снимок живого блока (fixtures/heroSliderBlock.json): 2 фото, 2 видео.
 * Языковые версии — через настоящий applyTranslationsToTree.
 */
jest.mock('../config/database', () => ({
  AppDataSource: { getRepository: () => ({}) },
}))

import sharp from 'sharp'
import {
  HEADER_BRIGHT_THRESHOLD,
  applyAutoHeaderThemes,
  slideMediaRefs,
  themeFromBrightness,
  topBandBrightness,
} from '../services/headerTheme'
import { applyTranslationsToTree } from '../services/TranslationService'
import type { StructureNode } from '../scripts/choiceToPlanTypes'

const HERO: StructureNode = require('./fixtures/heroSliderBlock.json')
/** Файлы фото-слайдов главной — uuid из адреса фона (не id записи медиатеки). */
const FILE_A = 'file:58f397f3-bca6-42ec-8465-0d89e40f4c03'
const FILE_B = 'file:968e5407-9af7-47ea-a05f-742d19397f5b'
const UZ_FILE = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d'

/** Картинка 200×100: верхние `topPx` строк одного цвета, остальное — другого. */
async function image(top: string, bottom: string, topPx = 25): Promise<Buffer> {
  const band = await sharp({ create: { width: 200, height: topPx, channels: 4, background: top } }).png().toBuffer()
  return sharp({ create: { width: 200, height: 100, channels: 4, background: bottom } })
    .composite([{ input: band, top: 0, left: 0 }])
    .png()
    .toBuffer()
}

const slides = (root: StructureNode): StructureNode[] => {
  const out: StructureNode[] = []
  const walk = (n: StructureNode) => {
    if (n.attributes?.['data-carousel-slide'] === 'true') out.push(n)
    for (const c of n.children ?? []) walk(c)
  }
  walk(root)
  return out
}
const themes = (root: StructureNode) => slides(root).map((s) => s.attributes?.['data-header-theme'] ?? null)

describe('topBandBrightness — яркость того, что под шапкой', () => {
  it('тёмный верх, светлый низ — тёмный фон под шапкой', async () => {
    const b = await topBandBrightness(await image('#1a1d22', '#f4f1ea'))
    expect(b).not.toBeNull()
    expect(b!).toBeLessThan(HEADER_BRIGHT_THRESHOLD)
    expect(themeFromBrightness(b!)).toBe('dark')
  })

  it('светлый верх, тёмный низ — светлый', async () => {
    const b = await topBandBrightness(await image('#f4f1ea', '#101010'))
    expect(themeFromBrightness(b!)).toBe('light')
  })

  it('решает верхняя четверть кадра, а не весь кадр', async () => {
    // Тёмная полоса — лишь верхние 10%: под шапкой (25%) в основном светло.
    const b = await topBandBrightness(await image('#000000', '#ffffff', 10))
    expect(themeFromBrightness(b!)).toBe('light')
  })

  it('прозрачное — как на белом', async () => {
    const clear = await sharp({ create: { width: 50, height: 50, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer()
    expect(themeFromBrightness((await topBandBrightness(clear))!)).toBe('light')
  })

  it('не картинка — null, без исключения', async () => {
    expect(await topBandBrightness(Buffer.from('не картинка'))).toBeNull()
  })
})

describe('applyAutoHeaderThemes — слайдер главной', () => {
  it('файл слайда — из адреса фона, а не из metadata.mediaAssetId (тот на стенде устарел)', () => {
    expect(slideMediaRefs(HERO).sort()).toEqual([FILE_A, FILE_B].sort())
  })

  it('фото получают тему по яркости; видео и слайд без файла — нет', () => {
    const out = applyAutoHeaderThemes(HERO, new Map([[FILE_A, 110], [FILE_B, 193]]))
    expect(themes(out)).toEqual(['dark', 'light', null, null, null])
  })

  it('ручная тема главнее; исходник не мутируется', () => {
    const snapshot = JSON.stringify(HERO)
    const manual: StructureNode = JSON.parse(snapshot)
    slides(manual)[0].attributes!['data-header-theme'] = 'light'
    const out = applyAutoHeaderThemes(manual, new Map([[FILE_A, 10]]))
    expect(themes(out)[0]).toBe('light')
    expect(slideMediaRefs(manual)).toEqual([FILE_B])
    expect(JSON.stringify(HERO)).toBe(snapshot)
  })

  it('нет яркости (старый файл без бэкфилла) — слайд без метки, шапка решает как раньше', () => {
    const out = applyAutoHeaderThemes(HERO, new Map([[FILE_B, 200]]))
    expect(themes(out)[0]).toBeNull()
    expect(applyAutoHeaderThemes(HERO, new Map())).toBe(HERO)
  })

  it('фон не из медиатеки — темы нет (а не тема старого файла слайда)', () => {
    const node: StructureNode = {
      id: 's',
      attributes: { 'data-carousel-slide': 'true' },
      metadata: { mediaAssetId: 'old' },
      styles: { properties: { backgroundImage: 'url("https://cdn.example.com/hero.jpg")' } },
      children: [],
    }
    expect(slideMediaRefs(node)).toEqual([])
  })

  it('фона в стилях нет — исходный файл слайда (asset:<id>)', () => {
    const node: StructureNode = { id: 's', attributes: { 'data-carousel-slide': 'true' }, metadata: { mediaAssetId: 'm1' }, children: [] }
    expect(slideMediaRefs(node)).toEqual(['asset:m1'])
    expect(themes(applyAutoHeaderThemes(node, new Map([['asset:m1', 30]])))).toEqual(['dark'])
  })

  it('производные файла (.opt.webp, .w800.webp) — тот же файл', () => {
    const node = (url: string): StructureNode => ({
      id: 's',
      attributes: { 'data-carousel-slide': 'true' },
      styles: { properties: { backgroundImage: `url("${url}")` } },
      children: [],
    })
    expect(slideMediaRefs(node(`/media/${FILE_A.slice(5)}.opt.webp`))).toEqual([FILE_A])
    expect(slideMediaRefs(node(`https://site.uz/media/${FILE_A.slice(5)}.w800.webp`))).toEqual([FILE_A])
  })

  it('слайд в экранной вставке (variations) тоже размечается', () => {
    const root: StructureNode = {
      id: 'page',
      children: [],
      variations: {
        mobile: {
          specificChildren: [{ id: 's', attributes: { 'data-carousel-slide': 'true' }, metadata: { mediaAssetId: 'm1' }, children: [] }],
        },
      },
    }
    expect(slideMediaRefs(root)).toEqual(['asset:m1'])
    const out = applyAutoHeaderThemes(root, new Map([['asset:m1', 30]])) as any
    expect(out.variations.mobile.specificChildren[0].attributes['data-header-theme']).toBe('dark')
  })
})

describe('языковые версии', () => {
  const [photoA] = slides(HERO)
  const BRIGHTNESS = new Map([[FILE_A, 110], [FILE_B, 193], [`file:${UZ_FILE}`, 230]])
  const uz = (fields: Record<string, string>) => applyTranslationsToTree(HERO, { [photoA.id!]: fields }).structure

  it('своё фото языка — тема по нему, без всяких настроек', () => {
    const out = applyAutoHeaderThemes(uz({ 'bg:image': `/media/${UZ_FILE}.png` }), BRIGHTNESS)
    expect(themes(out)[0]).toBe('light')
    // На основном языке — по основному фото.
    expect(themes(applyAutoHeaderThemes(HERO, BRIGHTNESS))[0]).toBe('dark')
  })

  it('ручная тема языка главнее его фото', () => {
    const out = applyAutoHeaderThemes(uz({ 'bg:image': `/media/${UZ_FILE}.png`, 'data-header-theme': 'dark' }), BRIGHTNESS)
    expect(themes(out)[0]).toBe('dark')
  })

  it('«Авто» у языка снимает ручную тему основного: решает фото языка', () => {
    const manualRu: StructureNode = JSON.parse(JSON.stringify(HERO))
    slides(manualRu)[0].attributes!['data-header-theme'] = 'dark'
    const uzAuto = applyTranslationsToTree(manualRu, {
      [photoA.id!]: { 'bg:image': `/media/${UZ_FILE}.png`, 'data-header-theme': 'auto' },
    }).structure
    expect(themes(applyAutoHeaderThemes(uzAuto, BRIGHTNESS))[0]).toBe('light')
  })

  it('«Авто» у видео-слайда снимается совсем — дальше решают кадры в браузере', () => {
    const video = slides(HERO)[2]
    const out = applyAutoHeaderThemes(applyTranslationsToTree(HERO, { [video.id!]: { 'data-header-theme': 'auto' } }).structure, new Map())
    expect(slides(out)[2].attributes).not.toHaveProperty('data-header-theme')
  })
})
