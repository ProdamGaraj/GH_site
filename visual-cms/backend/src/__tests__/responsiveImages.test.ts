import {
  applyBackgroundVariants,
  backgroundSteps,
  declaredWidth,
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

  it('ширина в разметке (атрибут width) — sizes по ней: логотип 118px не берёт вариант 1024px', () => {
    const out = injectResponsiveImages(`<img src="/media/${ID}.png" width="118" />`, mapOf(rendition(ID)))
    expect(out).toContain('sizes="118px"')
  })

  it('ширина во встроенном стиле в px — sizes по ней; не шире файла', () => {
    expect(injectResponsiveImages(`<img src="/media/${ID}.png" style="height: 40px; width: 178px">`, mapOf(rendition(ID)))).toContain('sizes="178px"')
    expect(injectResponsiveImages(`<img src="/media/${ID}.png" width="5000">`, mapOf(rendition(ID)))).toContain('sizes="3840px"')
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

describe('backgroundSteps', () => {
  it('вариант шириной W — экранам до W/2, по убыванию', () => {
    const r = rendition(ID, 'png', {
      width: 7067,
      variants: [375, 768, 1024, 1512, 2560, 3840].map((w) => ({ width: w, storageKey: `${ID}.w${w}.webp` })),
    })
    expect(backgroundSteps(r)).toEqual([
      { maxWidth: 1920, storageKey: `${ID}.w3840.webp` },
      { maxWidth: 1280, storageKey: `${ID}.w2560.webp` },
      { maxWidth: 756, storageKey: `${ID}.w1512.webp` },
      { maxWidth: 512, storageKey: `${ID}.w1024.webp` },
      { maxWidth: 384, storageKey: `${ID}.w768.webp` },
      // 375 → экран 187px: таких нет, ступень не нужна.
    ])
  })

  it('варианты не уже оригинала и с нулевой шириной пропускаются; ширина неизвестна — берутся все', () => {
    const variants = [
      { width: 1280, storageKey: 'a' },
      { width: 0, storageKey: 'b' },
      { width: 768, storageKey: 'c' },
    ]
    expect(backgroundSteps(rendition(ID, 'png', { width: 1280, variants }))).toEqual([{ maxWidth: 384, storageKey: 'c' }])
    expect(backgroundSteps(rendition(ID, 'png', { width: null, variants })).map((s) => s.maxWidth)).toEqual([640, 384])
  })

  it('нет вариантов — нет ступеней', () => {
    expect(backgroundSteps(rendition(ID, 'png', { variants: [] }))).toEqual([])
  })
})

describe('applyBackgroundVariants (фон по размеру экрана)', () => {
  const map = mapOf(rendition(ID), rendition(ID2, 'jpg'))
  const VAR = '--m-aaaaaaaa'
  const VAR2 = '--m-11111111'
  const page = (body: string, head = '') => `<html><head>${head}</head><body>${body}</body></html>`

  it('встроенный фон: адрес остаётся запасным значением переменной, размеры — в <head>', () => {
    const out = applyBackgroundVariants(
      page(`<div style="background-image: url(&quot;/media/${ID}.opt.webp&quot;)"></div>`),
      map,
    )
    expect(out).toContain(`style="background-image: var(${VAR}, url(&quot;/media/${ID}.opt.webp&quot;))"`)
    expect(out).toContain(
      '<style data-media-variants>\n' +
        `@media (max-width:640px){:root{${VAR}:url("/media/${ID}.w1280.webp")}}\n` +
        `@media (max-width:384px){:root{${VAR}:url("/media/${ID}.w768.webp")}}\n` +
        '</style>\n</head>',
    )
  })

  it('скрипт страницы по-прежнему читает адрес полноразмерной картинки из стиля', () => {
    const out = applyBackgroundVariants(page(`<div style="background-image: url(&quot;/media/${ID}.opt.webp&quot;)"></div>`), map)
    const inline = out.match(/style="([^"]*)"/)![1].replace(/&quot;/g, '"')
    // Так делает увеличение фото в блоках проекта (shot() в complexMedia.ts).
    const m = inline.match(/url\(["']?(.*?)["']?\)/)
    expect(m?.[1]).toBe(`/media/${ID}.opt.webp`)
  })

  it.each([
    ['переменная --image в одинарных кавычках', `<i style="--image: url('/media/${ID}.opt.webp'); position: relative"></i>`, `--image: var(${VAR}, url('/media/${ID}.opt.webp')); position: relative`],
    ['без кавычек', `<i style="background: url(/media/${ID}.opt.webp) center / cover"></i>`, `background: var(${VAR}, url(/media/${ID}.opt.webp)) center / cover`],
    ['градиент поверх фото', `<i style="background-image: linear-gradient(rgba(0, 0, 0, 0.4), transparent), url(&quot;/media/${ID}.opt.webp&quot;)"></i>`, `linear-gradient(rgba(0, 0, 0, 0.4), transparent), var(${VAR}, url(&quot;/media/${ID}.opt.webp&quot;))`],
    ['оригинал без webp-версии', `<i style="background-image: url(/media/${ID}.png)"></i>`, `background-image: var(${VAR}, url(/media/${ID}.png))`],
  ])('%s', (_name, body, expected) => {
    expect(applyBackgroundVariants(page(body), map)).toContain(expected)
  })

  it('правила в <style>, в том числе экранные с !important', () => {
    const css = `<style>@media (max-width: 767px){[data-element-id="s"]{background-image: url("/media/${ID2}.opt.webp") !important; --slide-image: url("/media/${ID2}.opt.webp") !important}}</style>`
    const out = applyBackgroundVariants(page('', css), map)
    expect(out).toContain(`background-image: var(${VAR2}, url("/media/${ID2}.opt.webp")) !important; --slide-image: var(${VAR2}, url("/media/${ID2}.opt.webp")) !important`)
    expect(out).toContain(`${VAR2}:url("/media/${ID2}.w768.webp")`)
  })

  it('одна картинка в нескольких местах — одна переменная; разные картинки — в одном @media', () => {
    const out = applyBackgroundVariants(
      page(
        `<i style="background-image: url(/media/${ID}.opt.webp)"></i>` +
          `<b style="background-image: url(/media/${ID}.opt.webp)"></b>` +
          `<u style="background-image: url(/media/${ID2}.opt.webp)"></u>`,
      ),
      map,
    )
    expect(out.match(/@media/g)).toHaveLength(2)
    expect(out).toContain(`@media (max-width:384px){:root{${VAR}:url("/media/${ID}.w768.webp");${VAR2}:url("/media/${ID2}.w768.webp")}}`)
  })

  it('элементы списка с общим id и разными картинками получают каждый свою', () => {
    const out = applyBackgroundVariants(
      page(
        `<div data-element-id="card" style="--image: url('/media/${ID}.opt.webp')"></div>` +
          `<div data-element-id="card" style="--image: url('/media/${ID2}.opt.webp')"></div>`,
      ),
      map,
    )
    expect(out).toContain(`data-element-id="card" style="--image: var(${VAR}, `)
    expect(out).toContain(`data-element-id="card" style="--image: var(${VAR2}, `)
  })

  it('абсолютный адрес: варианты с того же адреса', () => {
    const out = applyBackgroundVariants(page(`<i style="background: url(https://site.uz/media/${ID}.opt.webp)"></i>`), map)
    expect(out).toContain(`${VAR}:url("https://site.uz/media/${ID}.w768.webp")`)
  })

  it('совпали первые 8 знаков uuid — у второй картинки полное имя переменной', () => {
    const twin = 'aaaaaaaa-0000-0000-0000-000000000001'
    const out = applyBackgroundVariants(
      page(`<i style="background: url(/media/${ID}.opt.webp)"></i><b style="background: url(/media/${twin}.opt.webp)"></b>`),
      mapOf(rendition(ID), rendition(twin)),
    )
    expect(out).toContain(`var(${VAR}, url(/media/${ID}.opt.webp))`)
    expect(out).toContain(`var(--m-aaaaaaaa000000000000000000000001, url(/media/${twin}.opt.webp))`)
  })

  it('не трогаются: выбранный вручную вариант, GIF/SVG, видео, чужие адреса, файл без вариантов', () => {
    const html = page(
      [
        `<i style="background: url(/media/${ID}.w768.webp)"></i>`,
        `<i style="background: url(/media/${ID2}.gif)"></i>`,
        `<i style="background: url(/media/${ID2}.mp4)"></i>`,
        `<i style="background: url(/images/hero.png)"></i>`,
        `<i style="background: url(https://cdn.example.com/x.jpg)"></i>`,
      ].join(''),
    )
    expect(applyBackgroundVariants(html, map)).toBe(html)
    const plain = page(`<i style="background: url(/media/${ID}.opt.webp)"></i>`)
    expect(applyBackgroundVariants(plain, mapOf(rendition(ID, 'png', { variants: [] })))).toBe(plain)
    expect(applyBackgroundVariants(plain, new Map())).toBe(plain)
  })

  it('<script> не трогается: там адрес — данные', () => {
    const script = `<script>var css = 'url("/media/${ID}.opt.webp")';</script>`
    const out = applyBackgroundVariants(page(`${script}<i style="background: url(/media/${ID}.opt.webp)"></i>`), map)
    expect(out).toContain(script)
    expect(out).toContain(`var(${VAR}, url(/media/${ID}.opt.webp))`)
  })

  it('<img>, ссылки и data-атрибуты не трогаются', () => {
    const html = page(`<img src="/media/${ID}.opt.webp"><a href="/media/${ID}.png">x</a><div data-plan-images="/media/${ID}.opt.webp"></div>`)
    expect(applyBackgroundVariants(html, map)).toBe(html)
  })

  it('кусок разметки без </head> не меняется — блоку стилей некуда встать', () => {
    const html = `<div style="background: url(/media/${ID}.opt.webp)"></div>`
    expect(applyBackgroundVariants(html, map)).toBe(html)
  })

  it('повторный вызов ничего не меняет', () => {
    const once = applyBackgroundVariants(page(`<i style="background: url(/media/${ID}.opt.webp)"></i>`), map)
    expect(applyBackgroundVariants(once, map)).toBe(once)
  })
})

describe('optimizeMediaInHtml — страница целиком', () => {
  it('оригинал в фоне → webp-версия и размеры по экрану; повторный проход ничего не меняет', () => {
    const map = mapOf(rendition(ID), rendition(ID2, 'jpg'))
    const html = `<html><head></head><body><div style="background-image: url(&quot;/media/${ID2}.jpg&quot;)"><img src="/media/${ID}.png" alt=""></div></body></html>`
    const once = optimizeMediaInHtml(html, map)
    expect(once).toContain(`var(--m-11111111, url(&quot;/media/${ID2}.opt.webp&quot;))`)
    expect(once).toContain(`--m-11111111:url("/media/${ID2}.w768.webp")`)
    expect(once).toContain(`src="/media/${ID}.opt.webp"`)
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

describe('declaredWidth', () => {
  it('атрибут width, затем width в px во встроенном стиле', () => {
    expect(declaredWidth('<img width="118" style="width: 50px">')).toBe(118)
    expect(declaredWidth('<img style="max-width: 300px; width: 120.5px">')).toBe(121)
  })

  it('проценты, max-width и ширина без единиц в стиле — не ширина', () => {
    expect(declaredWidth('<img style="width: 100%">')).toBeNull()
    expect(declaredWidth('<img style="max-width: 300px">')).toBeNull()
    expect(declaredWidth('<img data-width="40">')).toBeNull()
    expect(declaredWidth('<img>')).toBeNull()
  })
})
