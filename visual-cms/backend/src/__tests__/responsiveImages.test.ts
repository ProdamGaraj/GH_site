import {
  extractMediaUuids,
  injectResponsiveImages,
  optimizeMediaInHtml,
  swapCssMediaUrls,
  type MediaRendition,
} from '../services/responsiveImages'

const ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const ID2 = '11111111-2222-3333-4444-555555555555'

/** Файл медиатеки: оригинал `<id>.<ext>`, webp-версия и варианты 1280/768. */
function rendition(id: string, ext = 'png', overrides: Partial<MediaRendition> = {}): MediaRendition {
  return {
    storageKey: `${id}.${ext}`,
    optimizedKey: `${id}.opt.webp`,
    width: 3840,
    variants: [
      { width: 1280, storageKey: `${id}.w1280.webp` },
      { width: 768, storageKey: `${id}.w768.webp` },
    ],
    ...overrides,
  }
}

const mapOf = (...items: MediaRendition[]) => new Map(items.map((r) => [r.storageKey.split('.')[0], r]))

describe('injectResponsiveImages (<img>)', () => {
  it('оригинал → оптимизированный src, srcset из полноразмерной версии и вариантов, sizes', () => {
    const out = injectResponsiveImages(`<img src="/media/${ID}.png" data-element-id="x" />`, mapOf(rendition(ID)))
    expect(out).toBe(
      `<img src="/media/${ID}.opt.webp" data-element-id="x"` +
        ` srcset="/media/${ID}.opt.webp 3840w, /media/${ID}.w1280.webp 1280w, /media/${ID}.w768.webp 768w"` +
        ` sizes="(max-width: 3840px) 100vw, 3840px" />`
    )
  })

  it('src уже оптимизированный — srcset добавляется, src тот же', () => {
    const out = injectResponsiveImages(`<img src="/media/${ID}.opt.webp">`, mapOf(rendition(ID)))
    expect(out).toContain(`src="/media/${ID}.opt.webp"`)
    expect(out).toContain(`srcset="/media/${ID}.opt.webp 3840w, /media/${ID}.w1280.webp 1280w`)
  })

  it('без оптимизированной версии (не стала меньше) — оригинал остаётся и идёт в srcset', () => {
    const out = injectResponsiveImages(`<img src="/media/${ID}.jpg">`, mapOf(rendition(ID, 'jpg', { optimizedKey: null })))
    expect(out).toContain(`src="/media/${ID}.jpg"`)
    expect(out).toContain(`srcset="/media/${ID}.jpg 3840w, /media/${ID}.w1280.webp 1280w`)
  })

  it('файл не шире вариантов — полноразмерной версии в srcset нет', () => {
    const out = injectResponsiveImages(`<img src="/media/${ID}.png">`, mapOf(rendition(ID, 'png', { width: 1280 })))
    expect(out).toContain(`srcset="/media/${ID}.w1280.webp 1280w, /media/${ID}.w768.webp 768w"`)
  })

  it('sizes — не шире файла: логотип без CSS-ширины не растягивается на весь экран', () => {
    const out = injectResponsiveImages(`<img src="/media/${ID}.png">`, mapOf(rendition(ID, 'png', { width: 1100 })))
    expect(out).toContain('sizes="(max-width: 1100px) 100vw, 1100px"')
  })

  it('ширина файла неизвестна — только лёгкий src, без srcset (sizes не посчитать)', () => {
    const out = injectResponsiveImages(`<img src="/media/${ID}.png">`, mapOf(rendition(ID, 'png', { width: null })))
    expect(out).toBe(`<img src="/media/${ID}.opt.webp">`)
  })

  it('src — сам вариант: srcset из вариантов, полноразмерную версию не подмешиваем', () => {
    const out = injectResponsiveImages(`<img src="/media/${ID}.w768.webp">`, mapOf(rendition(ID)))
    expect(out).toContain(`src="/media/${ID}.w768.webp"`)
    expect(out).toContain(`srcset="/media/${ID}.w1280.webp 1280w, /media/${ID}.w768.webp 768w"`)
  })

  it('без вариантов — только оптимизированный src, srcset не нужен', () => {
    const out = injectResponsiveImages(`<img src="/media/${ID}.png">`, mapOf(rendition(ID, 'png', { variants: [] })))
    expect(out).toBe(`<img src="/media/${ID}.opt.webp">`)
  })

  it('GIF и SVG не трогаются: webp-вариант GIF — только первый кадр анимации', () => {
    for (const ext of ['gif', 'svg', 'GIF']) {
      const html = `<img src="/media/${ID}.${ext}">`
      expect(injectResponsiveImages(html, mapOf(rendition(ID, ext)))).toBe(html)
    }
  })

  it('сохраняет префикс origin из исходного src', () => {
    const out = injectResponsiveImages(`<img src="https://cdn.example.com/media/${ID}.jpg" />`, mapOf(rendition(ID, 'jpg')))
    expect(out).toContain(`src="https://cdn.example.com/media/${ID}.opt.webp"`)
    expect(out).toContain(`https://cdn.example.com/media/${ID}.w1280.webp 1280w`)
  })

  it('варианты по убыванию ширины независимо от порядка в данных', () => {
    const r = rendition(ID, 'png', {
      width: 1920,
      variants: [
        { width: 768, storageKey: `${ID}.w768.webp` },
        { width: 1920, storageKey: `${ID}.w1920.webp` },
        { width: 1280, storageKey: `${ID}.w1280.webp` },
      ],
    })
    expect(injectResponsiveImages(`<img src="/media/${ID}.png" />`, mapOf(r))).toContain(
      `srcset="/media/${ID}.w1920.webp 1920w, /media/${ID}.w1280.webp 1280w, /media/${ID}.w768.webp 768w"`
    )
  })

  it('свой srcset не перезаписывается, src не трогается', () => {
    const html = `<img src="/media/${ID}.png" srcset="custom 1x" />`
    expect(injectResponsiveImages(html, mapOf(rendition(ID)))).toBe(html)
  })

  it('свой sizes сохраняется', () => {
    const out = injectResponsiveImages(`<img src="/media/${ID}.png" sizes="50vw" />`, mapOf(rendition(ID)))
    expect(out).toContain('sizes="50vw"')
    expect(out).not.toContain('3840px"')
  })

  it('чужие картинки и файлы не из медиатеки не трогаются', () => {
    const html = `<img src="https://example.com/photo.jpg" /><img src="/media/${ID2}.png" />`
    expect(injectResponsiveImages(html, mapOf(rendition(ID)))).toBe(html)
    expect(injectResponsiveImages(html, new Map())).toBe(html)
  })

  it('несколько картинок в документе', () => {
    const out = injectResponsiveImages(`<img src="/media/${ID}.png" /><div></div><img src="/media/${ID2}.jpg" />`, mapOf(rendition(ID), rendition(ID2, 'jpg')))
    expect(out).toContain(`/media/${ID}.w1280.webp 1280w`)
    expect(out).toContain(`/media/${ID2}.w768.webp 768w`)
  })
})

describe('swapCssMediaUrls (CSS-фоны)', () => {
  const map = mapOf(rendition(ID), rendition(ID2, 'jpg'))

  it.each([
    ['&quot; во встроенном стиле', `style="background-image: url(&quot;/media/${ID}.png&quot;)"`, `style="background-image: url(&quot;/media/${ID}.opt.webp&quot;)"`],
    ['двойные кавычки в <style>', `.a { background: url("/media/${ID}.png") center; }`, `.a { background: url("/media/${ID}.opt.webp") center; }`],
    ['одинарные кавычки в переменной', `style="--image: url('/media/${ID2}.jpg'); position: relative"`, `style="--image: url('/media/${ID2}.opt.webp'); position: relative"`],
    ['без кавычек', `url(/media/${ID}.png)`, `url(/media/${ID}.opt.webp)`],
    ['пробел после скобки и абсолютный адрес', `url( "https://site.uz/media/${ID}.png" )`, `url( "https://site.uz/media/${ID}.opt.webp" )`],
    ['градиент поверх фото', `background-image: linear-gradient(rgba(0, 0, 0, 0.4), transparent), url(&quot;/media/${ID}.png&quot;)`, `background-image: linear-gradient(rgba(0, 0, 0, 0.4), transparent), url(&quot;/media/${ID}.opt.webp&quot;)`],
  ])('%s', (_name, input, expected) => {
    expect(swapCssMediaUrls(input, map)).toBe(expected)
  })

  it('уже лёгкие версии, GIF/SVG, видео и файлы без webp-версии не трогаются', () => {
    const noOpt = mapOf(rendition(ID, 'png', { optimizedKey: null }))
    const html = [
      `url(/media/${ID}.w768.webp)`,
      `url(/media/${ID}.opt.webp)`,
      `url(/media/${ID2}.gif)`,
      `url(/media/${ID2}.svg)`,
      `url(/media/${ID2}.mp4)`,
    ].join(' ')
    expect(swapCssMediaUrls(html, map)).toBe(html)
    expect(swapCssMediaUrls(`url(/media/${ID}.png)`, noOpt)).toBe(`url(/media/${ID}.png)`)
  })

  it('ссылки, meta и data-атрибуты не трогаются — там может быть нужен оригинал', () => {
    const html =
      `<a href="/media/${ID}.png">скачать</a>` +
      `<meta property="og:image" content="/media/${ID}.png">` +
      `<div data-plan-images="/media/${ID}.png|/media/${ID2}.jpg"></div>`
    expect(swapCssMediaUrls(html, map)).toBe(html)
  })
})

describe('optimizeMediaInHtml', () => {
  it('<img> и CSS за один проход; повторный проход ничего не меняет', () => {
    const map = mapOf(rendition(ID), rendition(ID2, 'jpg'))
    const html = `<div style="background-image: url(&quot;/media/${ID2}.jpg&quot;)"><img src="/media/${ID}.png" alt=""></div>`
    const once = optimizeMediaInHtml(html, map)
    expect(once).toContain(`url(&quot;/media/${ID2}.opt.webp&quot;)`)
    expect(once).toContain(`src="/media/${ID}.opt.webp"`)
    expect(once).toContain('srcset=')
    expect(optimizeMediaInHtml(once, map)).toBe(once)
  })
})

describe('extractMediaUuids', () => {
  it('уникальные uuid хранилища в нижнем регистре, из любых версий файла', () => {
    const html = `<img src="/media/${ID}.png"><img src="/media/${ID.toUpperCase()}.opt.webp"><i style="background: url(/media/${ID2}.w768.webp)"></i>`
    expect(extractMediaUuids(html).sort()).toEqual([ID2, ID].sort())
  })

  it('пусто без ссылок на медиатеку', () => {
    expect(extractMediaUuids('<div>hi</div>')).toEqual([])
    expect(extractMediaUuids('')).toEqual([])
  })
})
