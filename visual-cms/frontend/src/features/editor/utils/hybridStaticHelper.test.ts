import { describe, expect, it } from 'vitest'
import type { BlockNode } from '@/shared/types'
import {
  extractTemplateLayoutStyles,
  getHybridStaticDisplayName,
  getHybridStaticSlides,
  getStaticAfter,
  getStaticBefore,
  isHybridStaticSlide,
  markAsHybridStatic,
  prepareHybridStaticNode,
  unmarkAsHybridStatic,
} from './hybridStaticHelper'

const mk = (overrides: Partial<BlockNode> = {}): BlockNode => ({
  id: 'n',
  tag: 'div',
  tagName: 'div',
  elementType: 'container',
  styles: { properties: {} },
  children: [],
  attributes: {},
  metadata: {},
  ...overrides,
})

describe('isHybridStaticSlide', () => {
  it('true когда атрибут установлен', () => {
    expect(isHybridStaticSlide(mk({ attributes: { 'data-carousel-static': 'true' } }))).toBe(true)
  })
  it('false без атрибута', () => {
    expect(isHybridStaticSlide(mk({}))).toBe(false)
  })
})

describe('getHybridStaticSlides', () => {
  it('пустой массив для null/без children', () => {
    expect(getHybridStaticSlides(null)).toEqual([])
    expect(getHybridStaticSlides(undefined)).toEqual([])
    expect(getHybridStaticSlides(mk({ children: [] }))).toEqual([])
  })

  it('возвращает только static-children в DOM-порядке', () => {
    const tpl = mk({ id: 'tpl' })
    const s1 = mk({ id: 's1', attributes: { 'data-carousel-static': 'true' } })
    const s2 = mk({ id: 's2', attributes: { 'data-carousel-static': 'true' } })
    const track = mk({ children: [s1, tpl, s2] })
    expect(getHybridStaticSlides(track).map(c => c.id)).toEqual(['s1', 's2'])
  })

  it('пустой массив если static-children нет', () => {
    const tpl = mk({ id: 'tpl' })
    const other = mk({ id: 'other' })
    expect(getHybridStaticSlides(mk({ children: [tpl, other] }))).toEqual([])
  })
})

describe('markAsHybridStatic / unmarkAsHybridStatic', () => {
  it('mark добавляет атрибут не мутируя оригинал', () => {
    const node = mk({ id: 'n', attributes: { 'data-foo': 'bar' } })
    const marked = markAsHybridStatic(node)
    expect(marked.attributes?.['data-carousel-static']).toBe('true')
    expect(marked.attributes?.['data-foo']).toBe('bar')
    expect(node.attributes?.['data-carousel-static']).toBeUndefined()
    expect(marked).not.toBe(node)
  })

  it('mark создаёт attributes если их нет', () => {
    const node: BlockNode = { ...mk({ id: 'n' }), attributes: undefined as unknown as Record<string, string> }
    const marked = markAsHybridStatic(node)
    expect(marked.attributes?.['data-carousel-static']).toBe('true')
  })

  it('unmark удаляет атрибут не мутируя оригинал', () => {
    const node = mk({ id: 'n', attributes: { 'data-carousel-static': 'true', 'data-foo': 'bar' } })
    const unmarked = unmarkAsHybridStatic(node)
    expect(unmarked.attributes?.['data-carousel-static']).toBeUndefined()
    expect(unmarked.attributes?.['data-foo']).toBe('bar')
    expect(node.attributes?.['data-carousel-static']).toBe('true')
  })

  it('roundtrip mark→unmark возвращает к исходному набору атрибутов', () => {
    const node = mk({ id: 'n', attributes: { 'data-foo': 'bar' } })
    const result = unmarkAsHybridStatic(markAsHybridStatic(node))
    expect(result.attributes).toEqual({ 'data-foo': 'bar' })
  })
})

describe('getHybridStaticDisplayName', () => {
  it('берёт metadata.name когда задан', () => {
    expect(getHybridStaticDisplayName(mk({ metadata: { name: 'Промо' } }))).toBe('Промо')
  })
  it('fallback на tag в lowercase', () => {
    expect(getHybridStaticDisplayName(mk({ tagName: 'SECTION' }))).toBe('section')
  })
  it("fallback 'div' если ни tagName ни tag", () => {
    const node = { ...mk(), tagName: undefined as unknown as string, tag: undefined as unknown as string }
    expect(getHybridStaticDisplayName(node)).toBe('div')
  })
})

describe('getStaticBefore / getStaticAfter', () => {
  const tpl = mk({ id: 'tpl' })
  const sB1 = mk({ id: 'sB1', attributes: { 'data-carousel-static': 'true' } })
  const sB2 = mk({ id: 'sB2', attributes: { 'data-carousel-static': 'true' } })
  const sA1 = mk({ id: 'sA1', attributes: { 'data-carousel-static': 'true' } })
  const sA2 = mk({ id: 'sA2', attributes: { 'data-carousel-static': 'true' } })

  it('split по позиции template', () => {
    const track = mk({ children: [sB1, sB2, tpl, sA1, sA2] })
    expect(getStaticBefore(track, tpl).map(s => s.id)).toEqual(['sB1', 'sB2'])
    expect(getStaticAfter(track, tpl).map(s => s.id)).toEqual(['sA1', 'sA2'])
  })

  it('пустые массивы если template отсутствует или нет static', () => {
    expect(getStaticBefore(null, tpl)).toEqual([])
    expect(getStaticAfter(mk({ children: [tpl] }), tpl)).toEqual([])
    expect(getStaticBefore(mk({ children: [tpl] }), tpl)).toEqual([])
  })

  it('игнорирует non-static children даже если они между template и static', () => {
    const noise = mk({ id: 'noise' })
    const track = mk({ children: [sB1, noise, tpl, noise, sA1] })
    expect(getStaticBefore(track, tpl).map(s => s.id)).toEqual(['sB1'])
    expect(getStaticAfter(track, tpl).map(s => s.id)).toEqual(['sA1'])
  })

  it('пустые массивы если template не найден в track', () => {
    const orphan = mk({ id: 'orphan' })
    expect(getStaticBefore(mk({ children: [sB1] }), orphan)).toEqual([])
    expect(getStaticAfter(mk({ children: [sB1] }), orphan)).toEqual([])
  })
})

describe('extractTemplateLayoutStyles', () => {
  it('пустой объект для null/undefined template', () => {
    expect(extractTemplateLayoutStyles(null)).toEqual({})
    expect(extractTemplateLayoutStyles(undefined)).toEqual({})
  })

  it('извлекает только layout-ключи, игнорируя content-стили и width/flex-* (ними рулит CarouselRuntime)', () => {
    const tpl = mk({
      styles: {
        properties: {
          width: '100%',
          minWidth: '100%',
          flexShrink: 0,
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          backgroundImage: 'url(/foo.png)',
          color: 'red',
          padding: '10px',
        },
      },
    })
    const out = extractTemplateLayoutStyles(tpl)
    // высота и выравнивание — копируем
    expect(out.height).toBe('100vh')
    expect(out.display).toBe('flex')
    expect(out.alignItems).toBe('center')
    // width / min-width / flex-* — НЕ копируем (конфликт с applyTrackLayout)
    expect(out.width).toBeUndefined()
    expect(out.minWidth).toBeUndefined()
    expect(out.flexShrink).toBeUndefined()
    // content — игнорируем
    expect(out.backgroundImage).toBeUndefined()
    expect(out.color).toBeUndefined()
    expect(out.padding).toBeUndefined()
  })

  it('пропускает пустые/null/undefined значения', () => {
    const tpl = mk({
      styles: {
        properties: {
          height: '',
          display: undefined as unknown as string,
          minHeight: '500px',
        },
      },
    })
    const out = extractTemplateLayoutStyles(tpl)
    expect(out.height).toBeUndefined()
    expect(out.display).toBeUndefined()
    expect(out.minHeight).toBe('500px')
  })
})

describe('prepareHybridStaticNode', () => {
  const tpl = mk({
    styles: {
      properties: {
        width: '100%',
        minWidth: '100%',
        flexShrink: 0,
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        backgroundImage: 'url(/foo.png)', // не layout — НЕ должно копироваться
      },
    },
  })

  it('добавляет оба маркера: data-carousel-static и data-carousel-slide', () => {
    const out = prepareHybridStaticNode(mk({ id: 'n' }), tpl)
    expect(out.attributes?.['data-carousel-static']).toBe('true')
    expect(out.attributes?.['data-carousel-slide']).toBe('true')
  })

  it('копирует layout-стили template и НЕ затирает контент-стили узла', () => {
    const node = mk({
      styles: { properties: { color: 'blue', padding: '20px', backgroundColor: 'red' } },
    })
    const out = prepareHybridStaticNode(node, tpl)
    const props = out.styles?.properties as Record<string, unknown>
    // layout-стили template (height/display/выравнивание) — wins
    expect(props.height).toBe('100vh')
    expect(props.display).toBe('flex')
    expect(props.alignItems).toBe('center')
    // width / min-width НЕ копируются из template (ими рулит CarouselRuntime)
    expect(props.width).toBeUndefined()
    expect(props.minWidth).toBeUndefined()
    // flex-shrink: 0 — fallback (страховка от FOUC до applyTrackLayout)
    expect(props.flexShrink).toBe(0)
    // content-стили узла остаются
    expect(props.color).toBe('blue')
    expect(props.padding).toBe('20px')
    expect(props.backgroundColor).toBe('red')
    // background template НЕ переехал
    expect(props.backgroundImage).toBeUndefined()
  })

  it('применяет fallback (только flexShrink: 0) когда template отсутствует', () => {
    const node = mk({ id: 'n', styles: { properties: { color: 'blue' } } })
    const out = prepareHybridStaticNode(node, null)
    const props = out.styles?.properties as Record<string, unknown>
    // width/min-width НЕ в fallback (ими рулит CarouselRuntime)
    expect(props.width).toBeUndefined()
    expect(props.minWidth).toBeUndefined()
    expect(props.flexShrink).toBe(0)
    expect(props.color).toBe('blue')
  })

  it('layout template имеет приоритет над собственными layout-стилями узла (кроме width/flex-*)', () => {
    const node = mk({
      styles: { properties: { width: '50%', height: '500px', flexShrink: 1 } },
    })
    const out = prepareHybridStaticNode(node, tpl)
    const props = out.styles?.properties as Record<string, unknown>
    // height из template wins
    expect(props.height).toBe('100vh')
    // width узла остаётся (template его не переопределяет — потому что не копируется),
    // но CarouselRuntime всё равно перезапишет его inline-style'ом на (100/n)%
    expect(props.width).toBe('50%')
    // flexShrink узла перекрывает fallback (own > fallback)
    expect(props.flexShrink).toBe(1)
  })

  it('не мутирует исходный узел', () => {
    const node = mk({ id: 'n', styles: { properties: { color: 'blue' } } })
    const before = JSON.stringify(node)
    prepareHybridStaticNode(node, tpl)
    expect(JSON.stringify(node)).toBe(before)
  })
})
