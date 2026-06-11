import { describe, it, expect } from 'vitest'
import type { BlockNode } from '@/shared/types'
import {
  isBlockLink,
  canBeLink,
  isVoidTag,
  isLinkWrapper,
  makeNodeLink,
  unmakeNodeLink,
  hasLinkDescendant,
  hasLinkAncestor,
} from './linkUtils'

/** Минимальный фабричный helper для BlockNode в тестах. */
const node = (partial: Partial<BlockNode>): BlockNode => ({
  id: partial.id || 'n',
  elementType: partial.elementType || 'container',
  tagName: partial.tagName || 'div',
  styles: partial.styles || { properties: {} },
  children: partial.children || [],
  attributes: partial.attributes || {},
  content: partial.content,
  metadata: partial.metadata || {},
  ...partial,
})

describe('isBlockLink', () => {
  it('контейнер с tagName=a — блок-ссылка', () => {
    expect(isBlockLink(node({ tagName: 'a' }))).toBe(true)
  })
  it('инлайн-ссылка (elementType=link) — не блок-ссылка', () => {
    expect(isBlockLink(node({ elementType: 'link', tagName: 'a' }))).toBe(false)
  })
  it('обычный div — не ссылка', () => {
    expect(isBlockLink(node({ tagName: 'div' }))).toBe(false)
  })
})

describe('canBeLink', () => {
  it('контейнер, текст, кнопка — могут', () => {
    expect(canBeLink(node({ elementType: 'container', tagName: 'section' }))).toBe(true)
    expect(canBeLink(node({ elementType: 'text', tagName: 'p' }))).toBe(true)
    expect(canBeLink(node({ elementType: 'button', tagName: 'button' }))).toBe(true)
  })
  it('инлайн-ссылка — не может (уже ссылка)', () => {
    expect(canBeLink(node({ elementType: 'link', tagName: 'a' }))).toBe(false)
  })
  it('void-элементы (img, input) — могут (через обёртку)', () => {
    expect(canBeLink(node({ elementType: 'image', tagName: 'img' }))).toBe(true)
    expect(canBeLink(node({ elementType: 'input', tagName: 'input' }))).toBe(true)
  })
})

describe('isVoidTag', () => {
  it('img — void, div — нет; регистр не важен', () => {
    expect(isVoidTag(node({ tagName: 'img' }))).toBe(true)
    expect(isVoidTag(node({ tagName: 'IMG' }))).toBe(true)
    expect(isVoidTag(node({ tagName: 'div' }))).toBe(false)
  })
})

describe('isLinkWrapper', () => {
  it('распознаёт только <a> с metadata.isLinkWrapper', () => {
    expect(isLinkWrapper(node({ tagName: 'a', metadata: { isLinkWrapper: true } }))).toBe(true)
    expect(isLinkWrapper(node({ tagName: 'a' }))).toBe(false)
    expect(isLinkWrapper(node({ tagName: 'div', metadata: { isLinkWrapper: true } }))).toBe(false)
    expect(isLinkWrapper(null)).toBe(false)
  })
})

describe('makeNodeLink', () => {
  it('меняет tagName на a и запоминает исходный тег', () => {
    const updates = makeNodeLink(node({ tagName: 'section', metadata: { name: 'Hero' } }))
    expect(updates.tagName).toBe('a')
    expect(updates.metadata?.originalTagName).toBe('section')
    expect(updates.metadata?.name).toBe('Hero')
  })
  it('пустой tagName трактует как div', () => {
    const updates = makeNodeLink(node({ tagName: '' }))
    expect(updates.metadata?.originalTagName).toBe('div')
  })
  it('void-элемент и инлайн-ссылка — no-op', () => {
    expect(makeNodeLink(node({ tagName: 'img' }))).toEqual({})
    expect(makeNodeLink(node({ elementType: 'link', tagName: 'a' }))).toEqual({})
  })
  it('повторный вызов на уже превращённом блоке — no-op', () => {
    expect(makeNodeLink(node({ tagName: 'a', metadata: { originalTagName: 'div' } }))).toEqual({})
  })
})

describe('unmakeNodeLink', () => {
  it('восстанавливает исходный тег и чистит ссылочные атрибуты', () => {
    const updates = unmakeNodeLink(node({
      tagName: 'a',
      metadata: { name: 'Hero', originalTagName: 'section' },
      attributes: { href: '/about', target: '_blank', rel: 'noopener', 'data-page-id': 'p1', class: 'hero' },
    }))
    expect(updates.tagName).toBe('section')
    expect(updates.metadata?.originalTagName).toBeUndefined()
    expect(updates.metadata?.name).toBe('Hero')
    expect(updates.attributes).toEqual({ class: 'hero' })
  })
  it('без originalTagName откатывает в div', () => {
    expect(unmakeNodeLink(node({ tagName: 'a' })).tagName).toBe('div')
  })
  it('не трогает обычный блок и инлайн-ссылку', () => {
    expect(unmakeNodeLink(node({ tagName: 'div' }))).toEqual({})
    expect(unmakeNodeLink(node({ elementType: 'link', tagName: 'a' }))).toEqual({})
  })
})

describe('hasLinkDescendant', () => {
  it('находит ссылку на любой глубине', () => {
    const tree = node({ children: [node({ id: 'c1', children: [node({ id: 'c2', tagName: 'a' })] })] })
    expect(hasLinkDescendant(tree)).toBe(true)
  })
  it('сам узел-ссылка без детей-ссылок — false', () => {
    expect(hasLinkDescendant(node({ tagName: 'a' }))).toBe(false)
  })
})

describe('hasLinkAncestor', () => {
  const tree = node({
    id: 'root',
    children: [
      node({ id: 'link-wrap', tagName: 'a', children: [node({ id: 'inner' })] }),
      node({ id: 'plain' }),
    ],
  })
  it('узел внутри <a> — true', () => {
    expect(hasLinkAncestor(tree, 'inner')).toBe(true)
  })
  it('узел вне <a> — false; сам <a> не считается своим предком', () => {
    expect(hasLinkAncestor(tree, 'plain')).toBe(false)
    expect(hasLinkAncestor(tree, 'link-wrap')).toBe(false)
  })
  it('null root — false', () => {
    expect(hasLinkAncestor(null, 'inner')).toBe(false)
  })
})
