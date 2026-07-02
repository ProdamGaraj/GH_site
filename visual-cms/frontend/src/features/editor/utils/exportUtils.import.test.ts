// @vitest-environment jsdom
/**
 * Тесты импорта HTML и извлечения общих стилей/скриптов.
 *
 * Покрывает:
 *  - extractDocumentAssets: инлайн <style>→css, <script>→js, внешние →raw;
 *    topLevelOnly не лезет внутрь вложенных элементов (защита от задвоения);
 *  - importFromHTML: @media/:hover/@keyframes целиком в globalCss (раньше терялось),
 *    инлайн <script>→globalJs, внешние <link>/<script src>→customHeadHtml,
 *    простые .class{} инлайнятся в styles.properties (канвас), НО класс, который
 *    ещё участвует в @media/псевдо/комбинаторах, не инлайнится — его база тоже
 *    уходит в globalCss (иначе инлайн перебивал бы эти правила),
 *    битый/пустой HTML не падает;
 *  - mergeHtmlIntoTree: верхнеуровневые инлайн ассеты → globalCss/globalJs,
 *    сохранение metadata совпавших узлов, стабильный round-trip.
 */
import { describe, it, expect } from 'vitest'
import type { BlockNode } from '@/shared/types'
import {
  extractDocumentAssets,
  importFromHTML,
  mergeHtmlIntoTree,
  generateFullPageHTML,
  generateHTMLDocument,
  generateFullExport,
  collectTreeGlobalCss,
  collectTreeGlobalJs,
  importFromFiles,
} from './exportUtils'

const parse = (html: string): Document =>
  new DOMParser().parseFromString(html, 'text/html')

const node = (partial: Partial<BlockNode>): BlockNode => ({
  id: partial.id ?? 'n',
  elementType: partial.elementType ?? 'container',
  tagName: partial.tagName ?? 'div',
  styles: partial.styles ?? { properties: {} },
  children: partial.children ?? [],
  attributes: partial.attributes ?? {},
  content: partial.content,
  metadata: partial.metadata ?? {},
  variations: partial.variations,
  scripts: partial.scripts,
})

describe('extractDocumentAssets', () => {
  it('инлайн <style>→css, <script>→js, внешние →raw', () => {
    const doc = parse(`
      <head>
        <style>.a{color:red}</style>
        <link rel="stylesheet" href="/x.css">
        <script src="/x.js"></script>
      </head>
      <body>
        <script>console.log(1)</script>
      </body>`)
    const a = extractDocumentAssets(doc)
    expect(a.css).toContain('.a{color:red}')
    expect(a.js).toContain('console.log(1)')
    expect(a.rawHead).toContain('/x.css')
    expect(a.rawHead).toContain('/x.js')
  })

  it('topLevelOnly не извлекает вложенные <script> (защита html-code от задвоения)', () => {
    const doc = parse(`
      <body>
        <div><script>NESTED()</script></div>
        <script>TOPLEVEL()</script>
      </body>`)
    const top = extractDocumentAssets(doc, { topLevelOnly: true })
    expect(top.js).toContain('TOPLEVEL()')
    expect(top.js).not.toContain('NESTED()')

    // полный режим (импорт) — забирает оба, дерево их всё равно отбрасывает
    const full = extractDocumentAssets(doc)
    expect(full.js).toContain('NESTED()')
    expect(full.js).toContain('TOPLEVEL()')
  })

  it('topLevelOnly разводит сырьё по head/body', () => {
    const doc = parse(`
      <head><link rel="stylesheet" href="/h.css"></head>
      <body><script src="/b.js"></script><p>x</p></body>`)
    const a = extractDocumentAssets(doc, { topLevelOnly: true })
    expect(a.rawHead).toContain('/h.css')
    expect(a.rawBodyEnd).toContain('/b.js')
  })
})

describe('importFromHTML — захват стилей/скриптов', () => {
  it('@media/@keyframes → globalCss, а :hover → states (правая панель)', () => {
    const html = `
      <style>
        .box { color: black; }
        .box:hover { color: blue; }
        @media (max-width: 600px) { .box { display: none; } }
        @keyframes spin { from { transform: rotate(0) } to { transform: rotate(360deg) } }
      </style>
      <div class="box">hi</div>`
    const root = importFromHTML(html)
    // нераспознанное остаётся в globalCss
    expect(root.metadata.globalCss).toContain('@media')
    expect(root.metadata.globalCss).toContain('@keyframes')
    // hover распознан → в states, не дублируется в globalCss
    expect(root.metadata.globalCss).not.toContain(':hover')
    expect(root.styles.states?.hover?.color).toBe('blue')
    // .box участвует в @media → его базовое правило НЕ инлайнится (иначе инлайн
    // перебил бы @media), а тоже уходит в globalCss; в properties его свойств нет
    expect((root.styles.properties as Record<string, string>).color).toBeUndefined()
    expect(root.metadata.globalCss).toContain('.box')
  })

  it('инлайн <script>→globalJs, внешние <link>/<script src>→customHeadHtml', () => {
    const html = `
      <link rel="stylesheet" href="https://cdn/x.css">
      <script src="https://cdn/x.js"></script>
      <script>window.__init = true;</script>
      <section>content</section>`
    const root = importFromHTML(html)
    expect(root.metadata.globalJs).toContain('window.__init = true;')
    expect(root.metadata.customHeadHtml).toContain('cdn/x.css')
    expect(root.metadata.customHeadHtml).toContain('cdn/x.js')
    // внешний src не должен утечь в globalJs
    expect(root.metadata.globalJs || '').not.toContain('cdn/x.js')
  })

  it('простые .class{} инлайнятся в properties и НЕ дублируются в globalCss', () => {
    const html = `<style>.box{color:red}</style><div class="box"></div>`
    const root = importFromHTML(html)
    expect((root.styles.properties as Record<string, string>).color).toBe('red')
    // распознанное правило не оседает в globalCss (одна точка правды)
    expect(root.metadata.globalCss || '').not.toContain('.box')
  })

  it('класс с @media: базовое правило НЕ инлайнится, а уходит в globalCss ПЕРЕД @media', () => {
    // Регрессия: инлайн base перебивал бы @media (баг «бургер не собирается»).
    const html = `
      <style>
        .menu { display: flex; gap: 8px; }
        .burger { display: none; }
        @media (max-width: 1180px) {
          .menu { display: none; }
          .burger { display: inline-flex; }
        }
      </style>
      <nav class="menu"></nav><button class="burger"></button>`
    const root = importFromHTML(html)
    const css = root.metadata.globalCss || ''
    const menu = root.children.find(c => c.attributes.class === 'menu')
    const burger = root.children.find(c => c.attributes.class === 'burger')
    // базовые правила классов из @media НЕ инлайнятся…
    expect((menu?.styles.properties as Record<string, string>).display).toBeUndefined()
    expect((burger?.styles.properties as Record<string, string>).display).toBeUndefined()
    // …а лежат сырыми в globalCss, причём ДО @media (чтобы @media их переопределял)
    expect(css).toContain('.menu {')
    expect(css).toContain('.burger {')
    expect(css.indexOf('.menu {')).toBeLessThan(css.indexOf('@media'))
  })

  it('маппит :hover/:focus/:active/:disabled в states по классу элемента', () => {
    const html = `
      <style>
        .btn:hover { background-color: red; }
        .btn:focus { outline-color: blue; }
        .btn:active { transform: scale(0.95); }
        .btn:disabled { opacity: 0.5; }
      </style>
      <section><button class="btn">x</button></section>`
    const root = importFromHTML(html)
    const btn = root.children[0]
    expect(btn.styles.states?.hover?.backgroundColor).toBe('red')
    expect(btn.styles.states?.focus?.outlineColor).toBe('blue')
    expect(btn.styles.states?.active?.transform).toBe('scale(0.95)')
    expect(btn.styles.states?.disabled?.opacity).toBe('0.5')
  })

  it('сложные селекторы (вложенные, группы, id, тег) остаются в globalCss', () => {
    const html = `
      <style>
        .a .b { color: red; }
        .a, .b { margin: 0; }
        #x { padding: 1px; }
        div { gap: 2px; }
      </style>
      <div class="a"><span class="b">y</span></div>`
    const css = importFromHTML(html).metadata.globalCss || ''
    expect(css).toContain('.a .b')
    expect(css).toContain('.a, .b')
    expect(css).toContain('#x')
    expect(css).toContain('div {')
  })

  it('пустой/битый HTML не падает и возвращает валидный контейнер', () => {
    expect(() => importFromHTML('')).not.toThrow()
    const root = importFromHTML('<div><span>unclosed')
    expect(root).toBeTruthy()
    expect(root.tagName).toBeTruthy()
    expect(Array.isArray(root.children)).toBe(true)
  })
})

describe('mergeHtmlIntoTree — round-trip и сохранение metadata', () => {
  it('верхнеуровневый инлайн <style>/<script> → globalCss/globalJs', () => {
    const existing = node({ id: 'root', metadata: { name: 'Root' } })
    const html = `
      <head><style>.r{margin:0}</style></head>
      <body>
        <div data-element-id="root"></div>
        <script>BODY_JS()</script>
      </body>`
    const merged = mergeHtmlIntoTree(html, existing)
    expect(merged.metadata.globalCss).toContain('.r{margin:0}')
    expect(merged.metadata.globalJs).toContain('BODY_JS()')
  })

  it('сохраняет metadata/scripts совпавшего по data-element-id узла', () => {
    const existing = node({
      id: 'root',
      metadata: { name: 'Hero', linkedBlockId: 'lib-1' },
      scripts: [{ id: 's1', name: 'x', code: 'foo()', trigger: 'load', enabled: true }],
    })
    const html = `<body><div data-element-id="root" style="color: green"></div></body>`
    const merged = mergeHtmlIntoTree(html, existing)
    expect(merged.metadata.name).toBe('Hero')
    expect(merged.metadata.linkedBlockId).toBe('lib-1')
    expect(merged.scripts?.[0].code).toBe('foo()')
    // визуальное обновилось
    expect((merged.styles.properties as Record<string, string>).color).toBe('green')
  })

  it('round-trip: globalCss/globalJs переживают generateFullPageHTML → merge', () => {
    const existing = node({
      id: 'root',
      metadata: { name: 'Root', globalCss: '.k{padding:1px}', globalJs: 'KEEP_JS()' },
    })
    const source = generateFullPageHTML(existing, 'Test')
    expect(source).toContain('.k{padding:1px}')
    expect(source).toContain('KEEP_JS()')

    const merged = mergeHtmlIntoTree(source, existing)
    expect(merged.metadata.globalCss).toContain('.k{padding:1px}')
    expect(merged.metadata.globalJs).toContain('KEEP_JS()')
  })
})

describe('экспорт включает общие стили/скрипты страницы', () => {
  it('generateHTMLDocument дописывает globalCss к styles', () => {
    const root = node({ id: 'r', metadata: { globalCss: '.exported{gap:4px}' } })
    const { css } = generateHTMLDocument(root, { title: 'X' })
    expect(css).toContain('.exported{gap:4px}')
  })

  it('generateFullExport (html) кладёт globalJs в script.js', () => {
    const root = node({ id: 'r', metadata: { name: 'Page', globalJs: 'EXPORTED_JS()' } })
    const result = generateFullExport(root, { name: 'Page', type: 'page', format: 'html' })
    const scriptFile = result.files.find(f => f.path.endsWith('script.js'))
    expect(scriptFile?.content).toContain('EXPORTED_JS()')
  })
})

describe('collectTreeGlobalCss (живое превью канваса)', () => {
  it('собирает globalCss страницы и блоков с дедупом по контенту', () => {
    const tree = node({
      id: 'root',
      metadata: { globalCss: '.page{gap:1px}' },
      children: [
        node({ id: 'a', metadata: { globalCss: '.block{gap:2px}' } }),
        node({ id: 'b', metadata: { globalCss: '.block{gap:2px}' } }),
      ],
    })
    const css = collectTreeGlobalCss(tree)
    expect(css).toContain('.page{gap:1px}')
    expect(css).toContain('.block{gap:2px}')
    expect(css.split('.block{gap:2px}').length - 1).toBe(1)
  })

  it('null/пустое дерево → пустая строка', () => {
    expect(collectTreeGlobalCss(null)).toBe('')
    expect(collectTreeGlobalCss(node({ metadata: {} }))).toBe('')
  })
})

describe('импорт: устойчивый разбор стилей и атрибутов', () => {
  it('url(https://…) в значении не обрезается на двоеточии', () => {
    const html = `<div style="background-image: url('https://cdn.example.com/a/b.png'); color: red"></div>`
    const props = importFromHTML(html).styles.properties as Record<string, string>
    expect(props.backgroundImage).toBe("url('https://cdn.example.com/a/b.png')")
    expect(props.color).toBe('red')
  })

  it('CSS-переменные (--var) сохраняются, не превращаются в -Var', () => {
    const html = `<div style="--image: url('https://x/y.png'); background: var(--image) center / cover"></div>`
    const props = importFromHTML(html).styles.properties as Record<string, string>
    expect(props['--image']).toBe("url('https://x/y.png')")
    expect(props['-Image']).toBeUndefined()
    expect(props.background).toBe('var(--image) center / cover')
  })

  it('data-URI с `;` внутри url() не рвётся', () => {
    const html = `<div style="background: url(data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=) no-repeat"></div>`
    const props = importFromHTML(html).styles.properties as Record<string, string>
    expect(props.background).toBe('url(data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=) no-repeat')
  })

  it('class/id/data-* сохраняются на элементах (для globalCss-селекторов)', () => {
    const html = `<section class="hero main" id="top" data-role="x"><p class="lead">y</p></section>`
    const root = importFromHTML(html)
    expect(root.attributes.class).toBe('hero main')
    expect(root.attributes.id).toBe('top')
    expect(root.attributes['data-role']).toBe('x')
    expect(root.children[0].attributes.class).toBe('lead')
  })

  it('правило класса с url(https://…) инлайнится без обрезки', () => {
    const html = `<style>.bg{background-image:url(https://x/y.png)}</style><div class="bg"></div>`
    const props = importFromHTML(html).styles.properties as Record<string, string>
    expect(props.backgroundImage).toBe('url(https://x/y.png)')
  })
})

describe('importFromFiles (html + css + js)', () => {
  it('CSS-файл → properties/states/globalCss, JS-файл → globalJs', () => {
    const result = importFromFiles({
      html: '<section class="hero"><button class="btn">x</button></section>',
      css: '.hero { padding: 10px; } .btn:hover { color: red; } @media (max-width: 600px) { .hero { padding: 2px; } }',
      js: 'BUNDLE_JS()',
    })
    // .hero участвует в @media → базовое правило не инлайнится, уходит в globalCss
    expect((result.styles.properties as Record<string, string>).padding).toBeUndefined()
    expect(result.metadata.globalCss).toContain('.hero')
    expect(result.children[0].styles.states?.hover?.color).toBe('red')
    expect(result.metadata.globalCss).toContain('@media')
    expect(result.metadata.globalJs).toContain('BUNDLE_JS()')
  })

  it('работает без css/js (только html), сохраняет класс', () => {
    const result = importFromFiles({ html: '<div class="x">hi</div>' })
    expect(result.attributes.class).toBe('x')
  })
})

describe('collectTreeGlobalJs', () => {
  it('собирает globalJs страницы и блоков с дедупом по контенту', () => {
    const tree = node({
      id: 'root',
      metadata: { globalJs: 'PAGE_JS()' },
      children: [
        node({ id: 'a', metadata: { globalJs: 'BLOCK_JS()' } }),
        node({ id: 'b', metadata: { globalJs: 'BLOCK_JS()' } }),
      ],
    })
    const js = collectTreeGlobalJs(tree)
    expect(js).toContain('PAGE_JS()')
    expect(js.split('BLOCK_JS()').length - 1).toBe(1)
  })

  it('null → пустая строка', () => {
    expect(collectTreeGlobalJs(null)).toBe('')
  })
})
