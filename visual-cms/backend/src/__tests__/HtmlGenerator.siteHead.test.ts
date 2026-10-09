/**
 * Head страницы из настроек сайта: значок, описание и картинка для соцсетей по
 * умолчанию; шрифт Muller — только когда его файлы есть на сайте.
 */
import { htmlGenerator, MULLER_FONT_FILES, ogLocale } from '../services/HtmlGenerator'

const root = { id: 'root', tagName: 'div', elementType: 'container', styles: { properties: {} }, attributes: {}, metadata: {}, children: [] }
const render = (metadata: Record<string, unknown>, options: Record<string, unknown> = {}) =>
  htmlGenerator.generatePage(root as any, { metadata: { title: 'T', description: '', keywords: [], ...metadata }, slug: 'about', ...options } as any)

describe('HtmlGenerator: head из настроек сайта', () => {
  it('значок сайта — <link rel="icon">; svg — с типом', () => {
    expect(render({}, { siteFavicon: '/media/icon.png' })).toContain('<link rel="icon" href="/media/icon.png">')
    expect(render({}, { siteFavicon: '/media/icon.svg' })).toContain('<link rel="icon" href="/media/icon.svg" type="image/svg+xml">')
    expect(render({})).not.toContain('rel="icon"')
  })

  it('пустое описание страницы — описание сайта (и в og:description)', () => {
    const html = render({}, { siteDescription: 'Жилые комплексы' })
    expect(html).toContain('<meta name="description" content="Жилые комплексы">')
    expect(html).toContain('<meta property="og:description" content="Жилые комплексы">')
  })

  it('своё описание страницы главнее описания сайта', () => {
    expect(render({ description: 'Своё' }, { siteDescription: 'Сайт' })).toContain('<meta name="description" content="Своё">')
  })

  it('og:image: своя картинка страницы, иначе сайта, иначе тега нет', () => {
    expect(render({ ogImage: '/p.jpg' }, { siteOgImage: '/s.jpg' })).toContain('<meta property="og:image" content="/p.jpg">')
    expect(render({}, { siteOgImage: '/s.jpg' })).toContain('<meta property="og:image" content="/s.jpg">')
    expect(render({})).not.toContain('og:image')
  })

  it('Muller: @font-face только с fontFaces (файлы на сайте есть)', () => {
    expect(render({})).not.toContain('@font-face')
    const html = render({}, { fontFaces: true })
    for (const file of Object.keys(MULLER_FONT_FILES)) expect(html).toContain(`url('/fonts/${file}')`)
    expect(html).toContain('font-weight: 800')
  })
})

describe('og:locale', () => {
  it('язык страницы → язык_СТРАНА; неизвестный — как есть', () => {
    expect(ogLocale('ru')).toBe('ru_RU')
    expect(ogLocale('uz')).toBe('uz_UZ')
    expect(ogLocale('en-GB')).toBe('en_US')
    expect(ogLocale('kz')).toBe('kz')
  })

  it('в head — по lang страницы', () => {
    expect(render({}, { lang: 'uz' })).toContain('<meta property="og:locale" content="uz_UZ">')
    expect(render({})).toContain('<meta property="og:locale" content="ru_RU">')
  })
})
