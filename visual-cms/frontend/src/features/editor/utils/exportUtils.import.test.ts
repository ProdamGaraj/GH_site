// @vitest-environment jsdom
/**
 * Тесты импорта HTML и извлечения общих стилей/скриптов.
 *
 * Покрывает:
 *  - extractDocumentAssets: инлайн <style>→css, <script>→js, внешние →raw;
 *    topLevelOnly не лезет внутрь вложенных элементов (защита от задвоения);
 *  - importFromHTML: @media/:hover/@keyframes целиком в globalCss (раньше терялось),
 *    инлайн <script>→globalJs, внешние <link>/<script src>→customHeadHtml,
 *    простые .class{} по-прежнему инлайнятся в styles.properties (канвас),
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
  it('@media/:hover/@keyframes целиком в globalCss (не теряются)', () => {
    const html = `
      <style>
        .box:hover { color: blue; }
        @media (max-width: 600px) { .box { display: none; } }
        @keyframes spin { from { transform: rotate(0) } to { transform: rotate(360deg) } }
      </style>
      <div class="box">hi</div>`
    const root = importFromHTML(html)
    expect(root.metadata.globalCss).toContain(':hover')
    expect(root.metadata.globalCss).toContain('@media')
    expect(root.metadata.globalCss).toContain('@keyframes')
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

  it('простые .class{} по-прежнему инлайнятся в styles.properties (канвас)', () => {
    const html = `<style>.box{color:red}</style><div class="box"></div>`
    const root = importFromHTML(html)
    // styles.properties.color приходит из cssRules (kebab→camel при необходимости)
    expect((root.styles.properties as Record<string, string>).color).toBe('red')
    // и одновременно сырой CSS сохранён в globalCss
    expect(root.metadata.globalCss).toContain('.box{color:red}')
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
