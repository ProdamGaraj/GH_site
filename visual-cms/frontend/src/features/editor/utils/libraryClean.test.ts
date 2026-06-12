import { describe, it, expect } from 'vitest'
import { cleanForLibrary, isLinkedPlaceholder, stripViewportIds } from './libraryClean'
import type { BlockNode } from '@/shared/types'

const node = (overrides: Partial<BlockNode> = {}): BlockNode =>
  ({
    id: 'n1',
    tag: 'div',
    tagName: 'div',
    elementType: 'container',
    styles: { properties: {} },
    attributes: {},
    metadata: {},
    children: [],
    ...overrides,
  }) as BlockNode

describe('isLinkedPlaceholder', () => {
  it('true для linked-узла без children', () => {
    expect(isLinkedPlaceholder(node({ metadata: { linkedBlockId: 'lib-1' }, children: [] }))).toBe(true)
  })

  it('true для linked-узла с отсутствующим массивом children', () => {
    expect(isLinkedPlaceholder(node({ metadata: { linkedBlockId: 'lib-1' }, children: undefined as any }))).toBe(true)
  })

  it('false для развёрнутого linked-узла', () => {
    expect(isLinkedPlaceholder(node({ metadata: { linkedBlockId: 'lib-1' }, children: [node({ id: 'c' })] }))).toBe(false)
  })

  it('false для обычного узла без linkedBlockId, даже пустого', () => {
    expect(isLinkedPlaceholder(node({ children: [] }))).toBe(false)
  })
})

describe('cleanForLibrary', () => {
  it('срезает linkedBlockId и styleOverrides только с корня', () => {
    const src = node({
      metadata: { linkedBlockId: 'lib-self', name: 'Секция', styleOverrides: { x: 1 } } as any,
      children: [
        node({ id: 'nested', metadata: { linkedBlockId: 'lib-other', name: 'Вложенный' } }),
      ],
    })

    const out = cleanForLibrary(src)

    expect(out.metadata.linkedBlockId).toBeUndefined()
    expect((out.metadata as any).styleOverrides).toBeUndefined()
    expect(out.metadata.name).toBe('Секция') // остальные метаданные сохранены
    // вложенная ссылка на ДРУГОЙ блок — легальна и сохраняется
    expect(out.children[0].metadata.linkedBlockId).toBe('lib-other')
  })

  it('не мутирует исходный узел (Redux-state)', () => {
    const src = node({ metadata: { linkedBlockId: 'lib-self', name: 'A' } })
    cleanForLibrary(src)
    expect(src.metadata.linkedBlockId).toBe('lib-self')
  })

  it('рекурсивно убирает _viewportId', () => {
    const src = node({
      children: [{ ...node({ id: 'c1' }), _viewportId: 'desktop' } as any],
    })
    ;(src as any)._viewportId = 'desktop'

    const out = cleanForLibrary(src)

    expect((out as any)._viewportId).toBeUndefined()
    expect((out.children[0] as any)._viewportId).toBeUndefined()
  })
})

describe('stripViewportIds', () => {
  it('нормализует отсутствующий children в пустой массив', () => {
    const out = stripViewportIds(node({ children: undefined as any }))
    expect(out.children).toEqual([])
  })
})
