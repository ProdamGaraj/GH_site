/**
 * Тесты канонического base-CSS и скоупера (D2 — паритет форм редактор↔деплой).
 *
 * Покрывает:
 *  - getResetCss/getBaseCss — статичная база (reset + форм-стили);
 *  - scopeCss — префиксация селекторов под контейнер канваса, спец-случаи
 *    (html/body/:root → scope), сохранность @keyframes/@font-face, списки;
 *  - деплой: HtmlGenerator инлайнит ровно getBaseCss() — ДО авторского CSS,
 *    чтобы стиль блока был главнее стилей форм по умолчанию;
 *  - канвас: база под `:where(scope)` — без добавочной специфичности.
 */
import { styleGenerator, scopeCss } from '../services/StyleGenerator'
import { htmlGenerator } from '../services/HtmlGenerator'
import type { BlockNode } from '../types/blockNode'

const rootNode = (): BlockNode =>
  ({
    id: 'root',
    elementType: 'container',
    tagName: 'div',
    styles: { properties: {} },
    children: [],
    attributes: {},
    metadata: {},
  } as BlockNode)

describe('StyleGenerator — канонический base-CSS', () => {
  describe('getResetCss / getBaseCss', () => {
    it('reset содержит box-sizing, шрифт Muller и base-теги', () => {
      const reset = styleGenerator.getResetCss()
      expect(reset).toContain('box-sizing: border-box')
      expect(reset).toContain("font-family: 'Muller'")
      expect(reset).toContain('scroll-behavior: smooth')
      expect(reset).toMatch(/input, textarea \{/)
    })

    it('рамки сброшены как Tailwind preflight в канвасе: толщина 0, линия solid', () => {
      // Без типа линии рамка с толщиной и цветом видна в редакторе (preflight),
      // но не на сайте (initial: none) — кнопка «Панорама 360°».
      const universal = styleGenerator.getResetCss().match(/\*, \*::before, \*::after \{([^}]*)\}/)
      expect(universal).not.toBeNull()
      expect(universal![1]).toContain('border-width: 0;')
      expect(universal![1]).toContain('border-style: solid;')
      expect(universal![1]).toContain('border-color: #e5e7eb;')
    })

    it('форм-стили идут после сброса рамок — у полей рамка остаётся', () => {
      const base = styleGenerator.getBaseCss()
      expect(base.indexOf('border-style: solid;')).toBeLessThan(base.indexOf('border: 1px solid #d1d5db'))
    })

    it('в канвасе сброс рамок без добавочной специфичности', () => {
      const scoped = styleGenerator.getBaseCssScoped('.canvas-viewport')
      expect(scoped).toMatch(/:where\(\.canvas-viewport\) \*[^{]*\{[^}]*border-style: solid;/)
    })

    it('getBaseCss = reset + форм-стили', () => {
      const base = styleGenerator.getBaseCss()
      expect(base).toContain('box-sizing: border-box') // reset
      expect(base).toContain('button[type="submit"]') // form
      expect(base).toContain('@keyframes spin') // form
      expect(base).toContain('::placeholder') // form
    })
  })

  describe('scopeCss', () => {
    it('простой тег префиксуется контейнером', () => {
      expect(scopeCss('input { color: red; }', '.cv')).toContain('.cv input {')
    })

    it('список через запятую — каждый селектор префиксуется', () => {
      const out = scopeCss('input, textarea, select { width: 100%; }', '.cv')
      expect(out).toContain('.cv input')
      expect(out).toContain('.cv textarea')
      expect(out).toContain('.cv select')
      // исходный неглобальный список не остаётся без префикса
      expect(out).not.toMatch(/(^|\n)\s*input, textarea, select \{/)
    })

    it('html/body/:root → сам scope (это корень канваса, не потомок)', () => {
      expect(scopeCss('body { margin: 0; }', '.cv')).toContain('.cv {')
      expect(scopeCss('html { x: 1; }', '.cv')).toContain('.cv {')
      expect(scopeCss(':root { x: 1; }', '.cv')).toContain('.cv {')
      // не должно появиться «.cv body» / «.cv html»
      expect(scopeCss('body { margin: 0; }', '.cv')).not.toContain('.cv body')
    })

    it('универсальный и псевдоэлементы префиксуются', () => {
      expect(scopeCss('*, *::before { box-sizing: border-box; }', '.cv')).toContain('.cv *')
      expect(scopeCss('::placeholder { color: gray; }', '.cv')).toContain('.cv ::placeholder')
    })

    it('@keyframes проходит дословно (тело НЕ скоупится)', () => {
      const kf = '@keyframes spin {\n  to { transform: rotate(360deg); }\n}'
      const out = scopeCss(kf, '.cv')
      expect(out).toContain('@keyframes spin')
      expect(out).not.toContain('.cv @keyframes')
      // внутренний селектор keyframe (to) не получил префикс
      expect(out).not.toContain('.cv to')
    })

    it('@font-face проходит дословно', () => {
      const ff = "@font-face { font-family: 'X'; src: url('/x.woff2'); }"
      const out = scopeCss(ff, '.cv')
      expect(out).toContain('@font-face')
      expect(out).not.toContain('.cv @font-face')
    })

    it('комментарий в позиции селектора срезается, тело правила скоупится', () => {
      const out = scopeCss('/* c */ input { color: red; }', '.cv')
      expect(out).toContain('.cv input')
      expect(out).not.toContain('/* c */ input {')
    })
  })

  describe('getBaseCssScoped', () => {
    it('форм-поля скоупятся, @keyframes spin сохраняется', () => {
      const scoped = styleGenerator.getBaseCssScoped('.canvas-viewport')
      expect(scoped).toContain(':where(.canvas-viewport) input[type="text"]')
      expect(scoped).toContain(':where(.canvas-viewport) select')
      expect(scoped).toContain(':where(.canvas-viewport) *') // reset
      expect(scoped).toContain('@keyframes spin') // не тронут
      expect(scoped).not.toContain(':where(.canvas-viewport) @keyframes')
    })

    it('скоуп не добавляет специфичности: база в канвасе соревнуется с автором как на сайте', () => {
      const scoped = styleGenerator.getBaseCssScoped('.canvas-viewport')
      // Голый префикс (.canvas-viewport input[type="text"]) давал базе класс
      // сверху и перебивал .lead-form input блока — на сайте они равны.
      expect(scoped).not.toMatch(/(^|[\s,])\.canvas-viewport [a-z*:[]/m)
      expect(scoped).toContain(':where(.canvas-viewport) button[type="submit"]')
      // html/body/:root → сам корень канваса, тоже без специфичности.
      expect(scoped).toMatch(/:where\(\.canvas-viewport\) \{/)
    })
  })

  describe('деплой: база — стили по умолчанию, автор главнее', () => {
    const page = (globalCss: string): string =>
      htmlGenerator.generatePage({ ...rootNode(), metadata: { globalCss } } as BlockNode, {
        metadata: { title: 'T', description: 'D', keywords: [] },
        slug: 'index',
      })

    it('HtmlGenerator инлайнит ровно getBaseCss() один раз', () => {
      const html = page('')
      expect(html).toContain(styleGenerator.getBaseCss())
      expect(html.split('/* Кнопки */')).toHaveLength(2)
    })

    it('стили форм — до CSS страницы и блоков: .lead-form button (золотой) главнее button[type="submit"] (синий)', () => {
      const html = page('.lead-form button { background: gold; }')
      const base = html.indexOf('button[type="submit"]')
      const authored = html.indexOf('.lead-form button { background: gold; }')
      expect(base).toBeGreaterThan(-1)
      expect(authored).toBeGreaterThan(base)
    })
  })
})
