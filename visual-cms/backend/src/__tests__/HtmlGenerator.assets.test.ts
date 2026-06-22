/**
 * Тесты инжекта общих стилей/скриптов (сайт → страница → блок) в генератор HTML.
 *
 * Покрывает:
 *  - каскад: reset → site → page → block(dedup) → dynamic в <head>;
 *            рантаймы → site → page → block в конце <body>;
 *  - экранирование закрывающих тегов </style>/</script> в сыром CSS/JS;
 *  - дедуп block-ассетов по контенту (linked/repeater эмитятся один раз);
 *  - сбор ассетов из variations.specificChildren;
 *  - guard'ы: пустые/пробельные поля не дают пустых тегов;
 *  - анти-регресс: без ассетов вывод не содержит маркеров уровней.
 */
import { htmlGenerator, GeneratePageOptions } from '../services/HtmlGenerator'
import type { BlockNode } from '../types/blockNode'

function node(partial: Partial<BlockNode> = {}): BlockNode {
  return {
    id: partial.id ?? 'root',
    elementType: partial.elementType ?? 'container',
    tagName: partial.tagName ?? 'div',
    styles: partial.styles ?? { properties: {} },
    children: partial.children ?? [],
    attributes: partial.attributes ?? {},
    content: partial.content,
    metadata: partial.metadata ?? {},
    variations: partial.variations,
    scripts: partial.scripts,
  } as BlockNode
}

const opts = (o: Partial<GeneratePageOptions> = {}): GeneratePageOptions => ({
  metadata: { title: 'T', description: 'D', keywords: [] },
  slug: 'index',
  ...o,
})

const countOccurrences = (haystack: string, needle: string): number =>
  haystack.split(needle).length - 1

describe('HtmlGenerator — общие стили/скрипты по уровням', () => {
  describe('анти-регресс (без ассетов)', () => {
    it('не добавляет маркеры уровней и пустые теги', () => {
      const html = htmlGenerator.generatePage(node(), opts())
      expect(html).not.toContain('/* Site CSS */')
      expect(html).not.toContain('/* Page CSS */')
      expect(html).not.toContain('/* Block CSS */')
      expect(html).not.toContain('/* Site JS */')
      expect(html).not.toContain('/* Page JS */')
      expect(html).not.toContain('/* Block JS */')
      // нет пустого авторского <script></script>
      expect(html).not.toContain('<script>\n\n</script>')
      expect(html).toContain('<!DOCTYPE html>')
    })
  })

  describe('инжект и каскад CSS в <head>', () => {
    it('site → page → block, после reset, до keyframes', () => {
      const tree = node({
        metadata: { globalCss: '.page-css{color:red}' },
        children: [node({ id: 'c1', metadata: { globalCss: '.block-css{color:blue}' } })],
      })
      const html = htmlGenerator.generatePage(tree, opts({ siteCss: '.site-css{color:green}' }))

      const iReset = html.indexOf('box-sizing')
      const iSite = html.indexOf('.site-css')
      const iPage = html.indexOf('.page-css')
      const iBlock = html.indexOf('.block-css')
      const iKeyframes = html.indexOf('Keyframes for animations')
      const iHeadEnd = html.indexOf('</head>')

      expect(iSite).toBeGreaterThan(iReset)
      expect(iPage).toBeGreaterThan(iSite)
      expect(iBlock).toBeGreaterThan(iPage)
      expect(iKeyframes).toBeGreaterThan(iBlock)
      // весь авторский CSS — внутри <head>
      expect(iBlock).toBeLessThan(iHeadEnd)
      expect(html).toContain('/* Site CSS */')
      expect(html).toContain('/* Page CSS */')
      expect(html).toContain('/* Block CSS */')
    })
  })

  describe('инжект и каскад JS в конце <body>', () => {
    it('рантаймы → site → page → block, перед </body>', () => {
      const tree = node({
        metadata: { globalJs: 'PAGE_JS()' },
        children: [node({ id: 'c1', metadata: { globalJs: 'BLOCK_JS()' } })],
      })
      // navigation эмитит nav-рантайм — проверяем, что авторский JS идёт после него
      const html = htmlGenerator.generatePage(
        tree,
        opts({ siteJs: 'SITE_JS()', navigation: [{ label: 'Home', href: '/' }] }),
      )

      const iNavRuntime = html.indexOf('Site Navigation Runtime')
      const iSite = html.indexOf('SITE_JS()')
      const iPage = html.indexOf('PAGE_JS()')
      const iBlock = html.indexOf('BLOCK_JS()')
      const iBodyEnd = html.indexOf('</body>')

      expect(iNavRuntime).toBeGreaterThan(-1)
      expect(iSite).toBeGreaterThan(iNavRuntime)
      expect(iPage).toBeGreaterThan(iSite)
      expect(iBlock).toBeGreaterThan(iPage)
      expect(iBlock).toBeLessThan(iBodyEnd)
    })
  })

  describe('экранирование закрывающих тегов', () => {
    it('</script> в JS не закрывает инлайн <script>', () => {
      const html = htmlGenerator.generatePage(
        node(),
        opts({ siteJs: 'var s = "</script>";' }),
      )
      expect(html).toContain('var s = "<\\/script>";')
      // сырой опасный </script> в составе пользовательского кода не утёк
      expect(html).not.toContain('"</script>";')
    })

    it('</style> в CSS не закрывает инлайн <style>', () => {
      const html = htmlGenerator.generatePage(
        node({ metadata: { globalCss: '.x::after{content:"</style>"}' } }),
        opts(),
      )
      expect(html).toContain('content:"<\\/style>"')
    })
  })

  describe('дедуп block-ассетов по контенту', () => {
    it('одинаковые CSS/JS блоков эмитятся один раз', () => {
      const dupCss = '.dup-block{display:flex}'
      const dupJs = 'DUP_BLOCK_JS()'
      const tree = node({
        children: [
          node({ id: 'a', metadata: { globalCss: dupCss, globalJs: dupJs } }),
          node({ id: 'b', metadata: { globalCss: dupCss, globalJs: dupJs } }),
          node({ id: 'c', metadata: { globalCss: dupCss, globalJs: dupJs } }),
        ],
      })
      const html = htmlGenerator.generatePage(tree, opts())
      expect(countOccurrences(html, dupCss)).toBe(1)
      expect(countOccurrences(html, dupJs)).toBe(1)
    })

    it('разные CSS блоков эмитятся каждый', () => {
      const tree = node({
        children: [
          node({ id: 'a', metadata: { globalCss: '.block-a{}' } }),
          node({ id: 'b', metadata: { globalCss: '.block-b{}' } }),
        ],
      })
      const html = htmlGenerator.generatePage(tree, opts())
      expect(html).toContain('.block-a{}')
      expect(html).toContain('.block-b{}')
    })
  })

  describe('сбор ассетов из variations.specificChildren', () => {
    it('CSS из specificChildren попадает в block-уровень', () => {
      const tree = node({
        children: [],
        variations: {
          mobile: {
            specificChildren: [node({ id: 'sc', metadata: { globalCss: '.specific-child{}' } })],
          },
        },
      })
      const html = htmlGenerator.generatePage(tree, opts())
      expect(html).toContain('.specific-child{}')
    })
  })

  describe('guard\'ы пустых значений', () => {
    it('пробельные ассеты не дают маркеров уровней', () => {
      const html = htmlGenerator.generatePage(
        node({ metadata: { globalCss: '   ', globalJs: '\n\t' } }),
        opts({ siteCss: '', siteJs: undefined }),
      )
      expect(html).not.toContain('/* Site CSS */')
      expect(html).not.toContain('/* Page CSS */')
      expect(html).not.toContain('/* Page JS */')
    })
  })

  describe('page-уровень берётся из метаданных корня, без двойного эмита', () => {
    it('CSS корня эмитится один раз как Page CSS', () => {
      const tree = node({ metadata: { globalCss: '.root-only-css{}' } })
      const html = htmlGenerator.generatePage(tree, opts())
      expect(html).toContain('/* Page CSS */')
      expect(countOccurrences(html, '.root-only-css{}')).toBe(1)
    })
  })

  describe('site custom head/body инжекты', () => {
    it('siteCustomHead попадает в <head>, siteCustomBodyEnd — перед </body>', () => {
      const html = htmlGenerator.generatePage(
        node(),
        opts({
          siteCustomHead: '<meta name="site-marker">',
          siteCustomBodyEnd: '<!-- site-body-marker -->',
        }),
      )
      const iHeadMarker = html.indexOf('site-marker')
      const iHeadEnd = html.indexOf('</head>')
      const iBodyMarker = html.indexOf('site-body-marker')
      const iBodyEnd = html.indexOf('</body>')
      expect(iHeadMarker).toBeGreaterThan(-1)
      expect(iHeadMarker).toBeLessThan(iHeadEnd)
      expect(iBodyMarker).toBeGreaterThan(iHeadEnd)
      expect(iBodyMarker).toBeLessThan(iBodyEnd)
    })
  })
})
