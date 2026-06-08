import { describe, it, expect } from 'vitest'
import type { BlockNode } from '@/shared/types'
import {
  normalizeFieldName,
  wrapBackgroundValue,
  looksLikeImageValue,
  blockMatchesField,
  isImageField,
  hasBoundDescendantImg,
  resolveStyleTarget,
} from './repeaterMappingHelper'

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

describe('normalizeFieldName', () => {
  it('срезает префикс item.', () => {
    expect(normalizeFieldName('item.image')).toBe('image')
    expect(normalizeFieldName('item.project-image')).toBe('project-image')
  })
  it('чинит артефакт ".-"', () => {
    expect(normalizeFieldName('item.project.-image')).toBe('project-image')
  })
  it('обрезает крайние точки/дефисы', () => {
    expect(normalizeFieldName('item..-image-')).toBe('image')
  })
  it('пустой/невалидный вход', () => {
    expect(normalizeFieldName('')).toBe('')
    // @ts-expect-error проверяем устойчивость к не-строке
    expect(normalizeFieldName(null)).toBe('')
  })
})

describe('wrapBackgroundValue', () => {
  it('оборачивает голый URL', () => {
    expect(wrapBackgroundValue('/media/a.png')).toBe('url("/media/a.png")')
  })
  it('не трогает уже обёрнутые/функциональные значения', () => {
    expect(wrapBackgroundValue('url("/x.png")')).toBe('url("/x.png")')
    expect(wrapBackgroundValue('linear-gradient(#000,#fff)')).toBe('linear-gradient(#000,#fff)')
    expect(wrapBackgroundValue('none')).toBe('none')
    expect(wrapBackgroundValue('var(--bg)')).toBe('var(--bg)')
  })
  it('пустая строка → пусто (без невалидного url())', () => {
    expect(wrapBackgroundValue('')).toBe('')
  })
  it('экранирует кавычки в URL', () => {
    expect(wrapBackgroundValue('/a"b.png')).toBe('url("/a\\"b.png")')
  })
})

describe('looksLikeImageValue', () => {
  it('распознаёт расширения картинок', () => {
    expect(looksLikeImageValue('/media/photo.jpg')).toBe(true)
    expect(looksLikeImageValue('https://x/y.webp?v=2')).toBe(true)
  })
  it('data-uri и unsplash', () => {
    expect(looksLikeImageValue('data:image/png;base64,AAAA')).toBe(true)
    expect(looksLikeImageValue('https://images.unsplash.com/abc')).toBe(true)
  })
  it('http/относительный путь только если поле «про картинку»', () => {
    expect(looksLikeImageValue('https://x/y', 'slide-image')).toBe(true)
    expect(looksLikeImageValue('/files/123', 'background')).toBe(true)
    expect(looksLikeImageValue('https://x/y', 'title')).toBe(false)
  })
  it('не-строки → false', () => {
    expect(looksLikeImageValue(undefined)).toBe(false)
    expect(looksLikeImageValue(42)).toBe(false)
  })
})

describe('blockMatchesField', () => {
  it('по data-bind', () => {
    expect(blockMatchesField(node({ attributes: { 'data-bind': 'image' } }), 'item.image')).toBe(true)
    expect(blockMatchesField(node({ attributes: { 'data-bind': 'slide-image' } }), 'item.image')).toBe(true)
  })
  it('по data-field', () => {
    expect(blockMatchesField(node({ attributes: { 'data-field': 'image' } }), 'item.image')).toBe(true)
  })
  it('по metadata.name', () => {
    expect(blockMatchesField(node({ metadata: { name: 'Slide Image' } }), 'item.image')).toBe(true)
  })
  it('по синониму (container для image)', () => {
    expect(blockMatchesField(node({ metadata: { name: 'Image Container' } }), 'item.image')).toBe(true)
    expect(blockMatchesField(node({ metadata: { name: 'Background' } }), 'item.image')).toBe(true)
  })
  it('не матчит чужое поле', () => {
    expect(blockMatchesField(node({ attributes: { 'data-bind': 'title' } }), 'item.image')).toBe(false)
    expect(blockMatchesField(node({ metadata: { name: 'Price' } }), 'item.image')).toBe(false)
  })
  it('пустой блок → false', () => {
    expect(blockMatchesField(node({}), 'item.image')).toBe(false)
  })
})

describe('isImageField', () => {
  it('по targetProperty', () => {
    expect(isImageField({ targetProperty: 'item.image' })).toBe(true)
    expect(isImageField({ targetProperty: 'item.slide-bg' })).toBe(true)
    expect(isImageField({ targetProperty: 'self.style.backgroundImage' })).toBe(true)
  })
  it('по sourceField', () => {
    expect(isImageField({ sourceField: 'photo_url', targetProperty: 'item.cover' })).toBe(true)
  })
  it('текстовое поле → false', () => {
    expect(isImageField({ sourceField: 'name', targetProperty: 'item.title' })).toBe(false)
  })
})

describe('hasBoundDescendantImg', () => {
  it('true если есть вложенный <img>, привязанный к тому же полю', () => {
    const tree = node({
      children: [node({ tagName: 'img', attributes: { 'data-bind': 'image' } })],
    })
    expect(hasBoundDescendantImg(tree, 'item.image')).toBe(true)
  })
  it('false если <img> привязан к другому полю', () => {
    const tree = node({
      children: [node({ tagName: 'img', attributes: { 'data-bind': 'title' } })],
    })
    expect(hasBoundDescendantImg(tree, 'item.image')).toBe(false)
  })
  it('false без вложенных img', () => {
    expect(hasBoundDescendantImg(node({}), 'item.image')).toBe(false)
  })
})

describe('resolveStyleTarget', () => {
  it('self.style.backgroundImage применяется только к корню', () => {
    const root = node({ id: 'root' })
    expect(resolveStyleTarget(root, { targetProperty: 'self.style.backgroundImage' }, true)).toEqual({
      cssKey: 'backgroundImage',
      isBackground: true,
    })
    expect(resolveStyleTarget(root, { targetProperty: 'self.style.backgroundImage' }, false)).toBeNull()
  })

  it('[data-bind=hero].style.backgroundImage по совпадению data-bind', () => {
    const hero = node({ attributes: { 'data-bind': 'hero' } })
    expect(
      resolveStyleTarget(hero, { targetProperty: '[data-bind=hero].style.backgroundImage' }, false)
    ).toEqual({ cssKey: 'backgroundImage', isBackground: true })
    const other = node({ attributes: { 'data-bind': 'other' } })
    expect(
      resolveStyleTarget(other, { targetProperty: '[data-bind=hero].style.backgroundImage' }, false)
    ).toBeNull()
  })

  it('self.style.color — не фон', () => {
    const root = node({})
    expect(resolveStyleTarget(root, { targetProperty: 'self.style.color' }, true)).toEqual({
      cssKey: 'color',
      isBackground: false,
    })
  })

  // ── Ключевой кейс бага ────────────────────────────────────────────────
  it('item.image вешает backgroundImage на контейнер БЕЗ существующего фона', () => {
    const container = node({
      tagName: 'div',
      attributes: { 'data-bind': 'image' },
      styles: { properties: {} }, // фон пуст — раньше Canvas не находил элемент
    })
    expect(resolveStyleTarget(container, { sourceField: 'image', targetProperty: 'item.image' }, false)).toEqual({
      cssKey: 'backgroundImage',
      isBackground: true,
    })
  })

  it('item.image на контейнере по metadata.name', () => {
    const container = node({ tagName: 'div', metadata: { name: 'Slide Image' } })
    expect(resolveStyleTarget(container, { targetProperty: 'item.image' }, false)).not.toBeNull()
  })

  it('item.image на <img> → null (это путь атрибута src, не фон)', () => {
    const img = node({ tagName: 'img', attributes: { 'data-bind': 'image' } })
    expect(resolveStyleTarget(img, { targetProperty: 'item.image' }, false)).toBeNull()
  })

  it('item.image на <a> → null', () => {
    const a = node({ tagName: 'a', attributes: { 'data-bind': 'image' } })
    expect(resolveStyleTarget(a, { targetProperty: 'item.image' }, false)).toBeNull()
  })

  it('item.image не ставит фон контейнеру, если внутри есть привязанный <img>', () => {
    const container = node({
      tagName: 'div',
      attributes: { 'data-bind': 'image' },
      children: [node({ tagName: 'img', attributes: { 'data-bind': 'image' } })],
    })
    expect(resolveStyleTarget(container, { targetProperty: 'item.image' }, false)).toBeNull()
  })

  it('item.title (текст) → null (не стиль)', () => {
    const container = node({ tagName: 'div', attributes: { 'data-bind': 'title' } })
    expect(resolveStyleTarget(container, { sourceField: 'name', targetProperty: 'item.title' }, false)).toBeNull()
  })

  it('item.image на несовпадающем контейнере → null', () => {
    const container = node({ tagName: 'div', metadata: { name: 'Price Tag' } })
    expect(resolveStyleTarget(container, { targetProperty: 'item.image' }, false)).toBeNull()
  })

  it('пустой/неизвестный targetProperty → null', () => {
    expect(resolveStyleTarget(node({}), { targetProperty: '' }, true)).toBeNull()
    expect(resolveStyleTarget(node({}), { targetProperty: 'children.0.content' }, true)).toBeNull()
  })
})
