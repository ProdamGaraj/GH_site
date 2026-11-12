import { describe, it, expect } from 'vitest'
import type { BlockNode } from '@/shared/types'
import { findNodeInTree, getEffectiveTree } from './variationUtils'

/**
 * Узлы, созданные не редактором (импорт, миграции данных), могут прийти без
 * children или styles. Раньше getEffectiveTree падал на таком узле, и
 * страница не открывалась в редакторе вовсе («Cannot read properties of
 * undefined (reading 'map')»).
 */
const partial = (n: Record<string, unknown>) => n as unknown as BlockNode

const tree = partial({
  id: 'root',
  tagName: 'section',
  styles: { properties: {} },
  attributes: {},
  children: [
    partial({ id: 'video', tagName: 'video', attributes: { src: '/a.mp4' } }),
    partial({ id: 'box', tagName: 'div', attributes: {}, children: [partial({ id: 'leaf', tagName: 'span' })] }),
  ],
})

describe('getEffectiveTree — неполные узлы', () => {
  it('базовый режим: узел без children не роняет дерево', () => {
    const out = getEffectiveTree(tree, null, 'base')
    expect(out.children.map((c) => c.id)).toEqual(['video', 'box'])
    expect(out.children[0].children).toEqual([])
    expect(out.children[1].children[0].children).toEqual([])
  })

  it('адаптивный режим без вариации — тоже', () => {
    const out = getEffectiveTree(tree, 'mobile', 'responsive')
    expect(out.children[0].children).toEqual([])
  })

  it('вариация с переопределением узла без styles — стили собираются из переопределения', () => {
    const withVariation = partial({
      ...tree,
      variations: {
        mobile: { inheritedOverrides: { video: { styles: { width: '50%' } } }, specificChildren: [] },
      },
    })
    const out = getEffectiveTree(withVariation, 'mobile', 'responsive')
    const video = out.children.find((c) => c.id === 'video')!
    expect(video.styles.properties).toMatchObject({ width: '50%' })
    expect(video.children).toEqual([])
  })
})

/**
 * Паритет «канвас = сайт»: экранные правки применяются как на деплое — по id
 * узла из любого места дерева и с каскадом экранов (см. screenOverrides.ts).
 */
describe('getEffectiveTree — экранные правки как на деплое', () => {
  const standard = [
    { id: 'desktop-hd', width: 1440 },
    { id: 'desktop-fhd', width: 1920 },
    { id: 'tablet', width: 768 },
    { id: 'mobile', width: 375 },
  ]
  const node = (id: string, extra: Record<string, unknown> = {}) =>
    partial({ id, tagName: 'div', styles: { properties: {} }, attributes: {}, children: [], ...extra })

  // page ─ complexes ─ wrap (держит tablet-правку для promo) ; page ─ promo ─ head
  const strayTree = () =>
    node('page', {
      children: [
        node('complexes', {
          children: [node('wrap', { variations: { tablet: { inheritedOverrides: { promo: { styles: { display: 'grid' } } } } } })],
        }),
        node('promo', { styles: { properties: { display: 'flex' } }, children: [node('head')] }),
      ],
    })

  const byId = (root: BlockNode, id: string): BlockNode | undefined => {
    if (root.id === id) return root
    for (const child of root.children) {
      const found = byId(child, id)
      if (found) return found
    }
    return undefined
  }

  it('правка, которую держит не родитель, применяется к узлу', () => {
    const out = getEffectiveTree(strayTree(), 'tablet', 'responsive', standard)
    expect(byId(out, 'promo')!.styles.properties).toMatchObject({ display: 'grid' })
  })

  it('планшетная правка видна на телефоне, но не на Desktop HD', () => {
    expect(byId(getEffectiveTree(strayTree(), 'mobile', 'responsive', standard), 'promo')!.styles.properties.display).toBe('grid')
    expect(byId(getEffectiveTree(strayTree(), 'desktop-hd', 'responsive', standard), 'promo')!.styles.properties.display).toBe('flex')
  })

  it('базовый режим экранные правки не применяет', () => {
    expect(byId(getEffectiveTree(strayTree(), null, 'base', standard), 'promo')!.styles.properties.display).toBe('flex')
  })

  it('узел, скрытый на планшете, скрыт и на телефоне; display на телефоне возвращает его', () => {
    const hidden = node('page', {
      variations: { tablet: { inheritedOverrides: { a: { hidden: true } } } },
      children: [node('a'), node('b')],
    })
    expect(getEffectiveTree(hidden, 'tablet', 'responsive', standard).children.map((c) => c.id)).toEqual(['b'])
    expect(getEffectiveTree(hidden, 'mobile', 'responsive', standard).children.map((c) => c.id)).toEqual(['b'])
    expect(getEffectiveTree(hidden, 'desktop-hd', 'responsive', standard).children.map((c) => c.id)).toEqual(['a', 'b'])

    const shownAgain = node('page', {
      variations: {
        tablet: { inheritedOverrides: { a: { hidden: true } } },
        mobile: { inheritedOverrides: { a: { styles: { display: 'block' } } } },
      },
      children: [node('a'), node('b')],
    })
    expect(getEffectiveTree(shownAgain, 'mobile', 'responsive', standard).children.map((c) => c.id)).toEqual(['a', 'b'])
  })

  it('скрытие «чужой» записью убирает узел из дерева', () => {
    const tree = node('page', {
      children: [
        node('holder', { variations: { mobile: { inheritedOverrides: { deep: { hidden: true } } } } }),
        node('box', { children: [node('deep'), node('kept')] }),
      ],
    })
    const out = getEffectiveTree(tree, 'mobile', 'responsive', standard)
    expect(byId(out, 'box')!.children.map((c) => c.id)).toEqual(['kept'])
  })

  it('пустое значение правки не затирает базовый стиль', () => {
    const tree = node('page', {
      variations: { tablet: { inheritedOverrides: { a: { styles: { color: '', gap: '4px' } } } } },
      children: [node('a', { styles: { properties: { color: 'red' } } })],
    })
    expect(byId(getEffectiveTree(tree, 'tablet', 'responsive', standard), 'a')!.styles.properties).toEqual({
      color: 'red',
      gap: '4px',
    })
  })

  it('правка корня применяется к корню; hidden корень не убирает', () => {
    const tree = node('page', {
      variations: { tablet: { inheritedOverrides: { page: { styles: { padding: '0' } } } } },
      children: [node('a')],
    })
    const out = getEffectiveTree(tree, 'tablet', 'responsive', standard)
    expect(out.styles.properties).toMatchObject({ padding: '0' })

    const hiddenRoot = node('page', {
      variations: { tablet: { inheritedOverrides: { page: { hidden: true } } } },
      children: [node('a')],
    })
    const outHidden = getEffectiveTree(hiddenRoot, 'tablet', 'responsive', standard)
    expect(outHidden.id).toBe('page')
    expect(outHidden.children.map((c) => c.id)).toEqual(['a'])
  })

  it('specificChildren своего экрана добавляются, чужого — нет; исходное дерево не мутируется', () => {
    const tree = node('page', {
      variations: {
        tablet: { specificChildren: [node('t-only')], inheritedOverrides: { a: { styles: { color: 'red' } } } },
        mobile: { specificChildren: [node('m-only')] },
      },
      children: [node('a')],
    })
    const snapshot = JSON.stringify(tree)
    expect(getEffectiveTree(tree, 'tablet', 'responsive', standard).children.map((c) => c.id)).toEqual(['a', 't-only'])
    expect(getEffectiveTree(tree, 'mobile', 'responsive', standard).children.map((c) => c.id)).toEqual(['a', 'm-only'])
    expect(JSON.stringify(tree)).toBe(snapshot)
  })
})

describe('findNodeInTree — узел с итоговыми экранными стилями', () => {
  const standard = [
    { id: 'desktop-hd', width: 1440 },
    { id: 'tablet', width: 768 },
    { id: 'mobile', width: 375 },
  ]
  const leafTree = partial({
    id: 'page',
    tagName: 'div',
    styles: { properties: {} },
    attributes: {},
    children: [
      partial({
        id: 'holder',
        tagName: 'div',
        styles: { properties: {} },
        attributes: {},
        children: [],
        variations: { tablet: { inheritedOverrides: { leaf: { styles: { color: 'red' } } } } },
      }),
      partial({
        id: 'box',
        tagName: 'div',
        styles: { properties: {} },
        attributes: {},
        children: [partial({ id: 'leaf', tagName: 'span', styles: { properties: { color: 'black' } }, attributes: {}, children: [] })],
      }),
    ],
  })

  it('глубокий узел получает «чужую» правку и каскад', () => {
    expect(findNodeInTree(leafTree, 'leaf', 'tablet', 'responsive', standard)!.styles.properties.color).toBe('red')
    expect(findNodeInTree(leafTree, 'leaf', 'mobile', 'responsive', standard)!.styles.properties.color).toBe('red')
    expect(findNodeInTree(leafTree, 'leaf', 'desktop-hd', 'responsive', standard)!.styles.properties.color).toBe('black')
    expect(findNodeInTree(leafTree, 'leaf', null, 'base', standard)!.styles.properties.color).toBe('black')
  })

  it('неизвестный id → null', () => {
    expect(findNodeInTree(leafTree, 'nope', 'tablet', 'responsive', standard)).toBeNull()
  })
})
