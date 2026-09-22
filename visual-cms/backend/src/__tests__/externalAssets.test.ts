/**
 * Перевод ссылок с внешнего демо-хоста в медиатеку.
 *
 * Адреса встречаются не только в атрибутах: они лежат в CSS-переменных узла и
 * в `metadata.globalCss` блока. Пропустить любое из этих мест — оставить
 * живую витрину зависимой от чужого GitHub Pages, причём незаметно.
 */
import {
  collectExternalUrls,
  fileNameFromUrl,
  buildRewriteMap,
  rewriteValue,
  EXTERNAL_HOST,
} from '../scripts/externalAssets'

const ext = (name: string) => `https://${EXTERNAL_HOST}/golden-house/assets/${name}`

const structure = {
  tagName: 'section',
  metadata: {
    globalCss: `.hero { background: url('${ext('hero-gh.png')}') center / cover; }`,
  },
  children: [
    {
      tagName: 'div',
      attributes: { class: 'project-image' },
      styles: { properties: { '--image': `url('${ext('project-assalom-dostlik-card.jpg')}')` } },
    },
    {
      tagName: 'img',
      attributes: { src: ext('trustbank-logo.png'), alt: 'Trustbank' },
    },
    { tagName: 'p', content: `Логотип: ${ext('golden-house-logo.png')}` },
    { tagName: 'p', content: 'Текст без ссылок' },
  ],
}

const assets = [
  { fileName: 'hero-gh.png', storageKey: '968e5407.png' },
  { fileName: 'project-assalom-dostlik-card.jpg', storageKey: 'd65851c0.jpg' },
  { fileName: 'trustbank-logo.png', storageKey: '351e0678.png' },
  { fileName: 'golden-house-logo.png', storageKey: 'b6025d0c.png' },
]

describe('collectExternalUrls', () => {
  it('находит адреса в атрибутах, стилях, тексте и globalCss', () => {
    expect(collectExternalUrls(structure)).toEqual([
      ext('golden-house-logo.png'),
      ext('hero-gh.png'),
      ext('project-assalom-dostlik-card.jpg'),
      ext('trustbank-logo.png'),
    ])
  })

  it('не захватывает закрывающую кавычку и скобку из url(...)', () => {
    const urls = collectExternalUrls({ s: `url('${ext('a.png')}')` })
    expect(urls).toEqual([ext('a.png')])
  })

  it('повторы схлопываются', () => {
    const urls = collectExternalUrls([ext('a.png'), ext('a.png'), { x: ext('a.png') }])
    expect(urls).toEqual([ext('a.png')])
  })

  it('структура без внешних адресов даёт пустой список', () => {
    expect(collectExternalUrls({ a: '/media/x.png', b: 'https://example.com/y.png' })).toEqual([])
  })
})

describe('fileNameFromUrl', () => {
  it('берёт последний сегмент', () => {
    expect(fileNameFromUrl(ext('hero-gh.png'))).toBe('hero-gh.png')
  })
  it('отбрасывает строку запроса и якорь', () => {
    expect(fileNameFromUrl(ext('hero-gh.png') + '?v=2')).toBe('hero-gh.png')
    expect(fileNameFromUrl(ext('hero-gh.png') + '#x')).toBe('hero-gh.png')
  })
})

describe('buildRewriteMap', () => {
  it('сопоставляет по имени файла', () => {
    const { replacements, unmatched } = buildRewriteMap(collectExternalUrls(structure), assets)
    expect(unmatched).toEqual([])
    expect(replacements.get(ext('hero-gh.png'))).toBe('/media/968e5407.png')
    expect(replacements.get(ext('trustbank-logo.png'))).toBe('/media/351e0678.png')
  })

  it('регистр имени не мешает', () => {
    const { replacements } = buildRewriteMap([ext('HERO-GH.PNG')], assets)
    expect(replacements.get(ext('HERO-GH.PNG'))).toBe('/media/968e5407.png')
  })

  it('адрес без файла в медиатеке попадает в unmatched, а не переписывается наугад', () => {
    const { replacements, unmatched } = buildRewriteMap([ext('нет-такого.png')], assets)
    expect(replacements.size).toBe(0)
    expect(unmatched).toEqual([ext('нет-такого.png')])
  })
})

describe('rewriteValue', () => {
  const { replacements } = buildRewriteMap(collectExternalUrls(structure), assets)
  const { value, count } = rewriteValue(structure, replacements)

  it('переписывает все места сразу', () => {
    expect(count).toBe(4)
    expect(collectExternalUrls(value)).toEqual([])
  })

  it('CSS-переменная узла сохраняет обёртку url(...)', () => {
    expect(value.children[0].styles!.properties['--image']).toBe("url('/media/d65851c0.jpg')")
  })

  it('globalCss блока тоже переписан', () => {
    expect(value.metadata.globalCss).toBe(".hero { background: url('/media/968e5407.png') center / cover; }")
  })

  it('атрибут и текст переписаны, соседние поля целы', () => {
    expect(value.children[1].attributes!.src).toBe('/media/351e0678.png')
    expect(value.children[1].attributes!.alt).toBe('Trustbank')
    expect(value.children[2].content).toBe('Логотип: /media/b6025d0c.png')
    expect(value.children[3].content).toBe('Текст без ссылок')
  })

  it('исходная структура не мутируется', () => {
    expect(collectExternalUrls(structure)).toHaveLength(4)
  })

  it('один адрес дважды в строке заменяется дважды', () => {
    const twice = { s: `${ext('hero-gh.png')} и ещё ${ext('hero-gh.png')}` }
    const r = rewriteValue(twice, replacements)
    expect(r.count).toBe(2)
    expect(r.value.s).toBe('/media/968e5407.png и ещё /media/968e5407.png')
  })

  it('пустая карта замен ничего не трогает', () => {
    const r = rewriteValue(structure, new Map())
    expect(r.count).toBe(0)
    expect(r.value).toEqual(structure)
  })
})
