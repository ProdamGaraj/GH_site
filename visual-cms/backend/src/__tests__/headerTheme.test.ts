/**
 * Тема шапки над фото-слайдом: яркость верхней полосы картинки считается при
 * загрузке, при публикации слайд получает data-header-theme. Слайдер главной —
 * снимок живого блока (fixtures/heroSliderBlock.json): 2 фото, 2 видео.
 */
import sharp from 'sharp'
import {
  HEADER_BRIGHT_THRESHOLD,
  applyAutoHeaderThemes,
  slideAssetIds,
  themeFromBrightness,
  topBandBrightness,
} from '../services/headerTheme'
import type { StructureNode } from '../scripts/choiceToPlanTypes'

const HERO: StructureNode = require('./fixtures/heroSliderBlock.json')
const PHOTO_A = '836b46a5-e17f-4f1c-809c-982b5b7aa694'
const PHOTO_B = '91327896-00f2-4b0b-ae93-9cb9a8d648ca'

/** Картинка 200×100: верхние `topPx` строк одного цвета, остальное — другого. */
async function image(top: string, bottom: string, topPx = 25, alpha = 1): Promise<Buffer> {
  const band = await sharp({ create: { width: 200, height: topPx, channels: 4, background: top } }).png().toBuffer()
  return sharp({ create: { width: 200, height: 100, channels: 4, background: bottom } })
    .composite([{ input: band, top: 0, left: 0 }])
    .ensureAlpha(alpha)
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
  it('на тему претендуют только фото-слайды с файлом медиатеки', () => {
    expect(slideAssetIds(HERO).sort()).toEqual([PHOTO_A, PHOTO_B].sort())
  })

  it('фото получают тему по яркости; видео и слайд без файла — нет', () => {
    const out = applyAutoHeaderThemes(HERO, new Map([[PHOTO_A, 40], [PHOTO_B, 220]]))
    const themes = slides(out).map((s) => s.attributes!['data-header-theme'] ?? null)
    expect(themes).toEqual(['dark', 'light', null, null, null])
  })

  it('ручная метка главнее; исходник не мутируется', () => {
    const snapshot = JSON.stringify(HERO)
    const manual: StructureNode = JSON.parse(snapshot)
    slides(manual)[0].attributes!['data-header-theme'] = 'light'
    const out = applyAutoHeaderThemes(manual, new Map([[PHOTO_A, 10]]))
    expect(slides(out)[0].attributes!['data-header-theme']).toBe('light')
    expect(slideAssetIds(manual)).toEqual([PHOTO_B])
    expect(JSON.stringify(HERO)).toBe(snapshot)
  })

  it('нет яркости (старый файл без бэкфилла) — слайд без метки, шапка решает как раньше', () => {
    const out = applyAutoHeaderThemes(HERO, new Map([[PHOTO_B, 200]]))
    expect(slides(out)[0].attributes).not.toHaveProperty('data-header-theme')
    expect(applyAutoHeaderThemes(HERO, new Map())).toBe(HERO)
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
    expect(slideAssetIds(root)).toEqual(['m1'])
    const out = applyAutoHeaderThemes(root, new Map([['m1', 30]])) as any
    expect(out.variations.mobile.specificChildren[0].attributes['data-header-theme']).toBe('dark')
  })
})
