import { describe, it, expect } from 'vitest'
import type { BlockNode } from '@/shared/types'
import { ensureNodeShape } from './nodeShape'

const partial = (n: Record<string, unknown>) => n as unknown as BlockNode

describe('ensureNodeShape', () => {
  it('недостающие children/styles/attributes/metadata дополняются на всех уровнях', () => {
    const out = ensureNodeShape(
      partial({
        id: 'root',
        tagName: 'section',
        children: [partial({ id: 'video', tagName: 'video', attributes: { src: '/a.mp4' } })],
      })
    )
    expect(out.styles).toEqual({ properties: {} })
    expect(out.metadata).toEqual({})
    const video = out.children[0]
    expect(video.children).toEqual([])
    expect(video.styles.properties).toEqual({})
    expect(video.attributes).toEqual({ src: '/a.mp4' })
  })

  it('существующие значения не трогаются', () => {
    const node = partial({
      id: 'x',
      tagName: 'div',
      styles: { properties: { color: 'red' }, customCSS: 'a{}' },
      attributes: { class: 'c' },
      metadata: { name: 'Имя' },
      children: [],
      content: 'текст',
    })
    expect(ensureNodeShape(node)).toEqual(node)
  })

  it('специфичные для брейкпоинта дети тоже нормализуются', () => {
    const out = ensureNodeShape(
      partial({
        id: 'root',
        tagName: 'div',
        children: [],
        variations: { mobile: { specificChildren: [partial({ id: 'm', tagName: 'span' })], inheritedOverrides: {} } },
      })
    )
    expect(out.variations!.mobile.specificChildren![0].children).toEqual([])
  })

  it('исходное дерево не мутируется', () => {
    const input = partial({ id: 'root', tagName: 'div', children: [partial({ id: 'a', tagName: 'span' })] })
    const snapshot = JSON.stringify(input)
    ensureNodeShape(input)
    expect(JSON.stringify(input)).toBe(snapshot)
  })
})
