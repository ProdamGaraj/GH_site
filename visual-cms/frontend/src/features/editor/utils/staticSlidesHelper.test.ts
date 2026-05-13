import { describe, it, expect } from 'vitest'
import type { BlockNode } from '@/shared/types'
import {
  getSlideChildren,
  withSlideAttribute,
  getSlideDisplayName,
  isLinkedSlide,
  SLIDE_ATTR,
} from './staticSlidesHelper'

const mk = (overrides: Partial<BlockNode> & { id: string }): BlockNode => {
  const base = {
    tag: 'div',
    tagName: 'div',
    elementType: 'container' as const,
    styles: { properties: {} },
    children: [],
    attributes: {},
    metadata: {},
  }
  return { ...base, ...overrides } as BlockNode
}

describe('getSlideChildren', () => {
  it('возвращает [] для null/undefined', () => {
    expect(getSlideChildren(null)).toEqual([])
    expect(getSlideChildren(undefined)).toEqual([])
  })

  it('возвращает [] если children не массив', () => {
    expect(getSlideChildren({ id: 't' } as unknown as BlockNode)).toEqual([])
  })

  it('возвращает children как есть', () => {
    const c1 = mk({ id: 'c1' })
    const c2 = mk({ id: 'c2' })
    const t = mk({ id: 't', children: [c1, c2] })
    expect(getSlideChildren(t)).toEqual([c1, c2])
  })
})

describe('withSlideAttribute', () => {
  it('добавляет data-carousel-slide="true" если его нет', () => {
    const n = mk({ id: 'n', attributes: { class: 'foo' } })
    const out = withSlideAttribute(n)
    expect(out.attributes[SLIDE_ATTR]).toBe('true')
    expect(out.attributes.class).toBe('foo')
  })

  it('возвращает тот же объект если атрибут уже стоит (короткий путь)', () => {
    const n = mk({ id: 'n', attributes: { [SLIDE_ATTR]: 'true' } })
    const out = withSlideAttribute(n)
    expect(out).toBe(n)
  })

  it('не мутирует вход', () => {
    const n = mk({ id: 'n', attributes: {} })
    withSlideAttribute(n)
    expect(n.attributes[SLIDE_ATTR]).toBeUndefined()
  })

  it('работает с пустыми attributes', () => {
    const n = mk({ id: 'n' })
    const out = withSlideAttribute(n)
    expect(out.attributes[SLIDE_ATTR]).toBe('true')
  })
})

describe('getSlideDisplayName', () => {
  it('берёт metadata.name если есть', () => {
    const n = mk({ id: 'n', metadata: { name: 'Hero Banner' } })
    expect(getSlideDisplayName(n, 0)).toBe('Hero Banner')
  })

  it('добавляет 🔗 для linked-плейсхолдера', () => {
    const n = mk({ id: 'n', metadata: { name: 'Hero Banner', linkedBlockId: 'lib-1' } })
    expect(getSlideDisplayName(n, 0)).toBe('🔗 Hero Banner')
  })

  it('fallback на tagName + index если имени нет', () => {
    const n = mk({ id: 'n', tagName: 'section' })
    expect(getSlideDisplayName(n, 2)).toBe('section 3')
  })

  it('fallback не считает пустое/whitespace-имя валидным', () => {
    const n = mk({ id: 'n', tagName: 'div', metadata: { name: '   ' } })
    expect(getSlideDisplayName(n, 0)).toBe('div 1')
  })

  it('игнорирует не-строковое metadata.name', () => {
    const n = mk({ id: 'n', tagName: 'div', metadata: { name: 123 as unknown as string } })
    expect(getSlideDisplayName(n, 0)).toBe('div 1')
  })
})

describe('isLinkedSlide', () => {
  it('true когда есть metadata.linkedBlockId-строка', () => {
    expect(isLinkedSlide(mk({ id: 'n', metadata: { linkedBlockId: 'lib-1' } }))).toBe(true)
  })

  it('false когда linkedBlockId — пустая строка', () => {
    expect(isLinkedSlide(mk({ id: 'n', metadata: { linkedBlockId: '' } }))).toBe(false)
  })

  it('false без metadata', () => {
    expect(isLinkedSlide(mk({ id: 'n' }))).toBe(false)
  })
})
