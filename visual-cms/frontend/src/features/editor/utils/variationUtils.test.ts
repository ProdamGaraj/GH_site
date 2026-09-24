import { describe, it, expect } from 'vitest'
import type { BlockNode } from '@/shared/types'
import { getEffectiveTree } from './variationUtils'

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
