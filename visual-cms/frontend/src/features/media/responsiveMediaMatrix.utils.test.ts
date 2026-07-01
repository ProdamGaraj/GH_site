import { describe, it, expect } from 'vitest'
import { parseCssUrl, translationField, findOverride } from './responsiveMediaMatrix.utils'
import type { BlockNode } from '@/shared/types'

describe('parseCssUrl', () => {
  it('извлекает URL из url("…")/url(\'…\')/url(…)', () => {
    expect(parseCssUrl('url("/a.png")')).toBe('/a.png')
    expect(parseCssUrl("url('/b.png')")).toBe('/b.png')
    expect(parseCssUrl('url(/c.png)')).toBe('/c.png')
  })
  it('null для градиентов и мусора', () => {
    expect(parseCssUrl('linear-gradient(#000,#fff)')).toBeNull()
    expect(parseCssUrl(undefined)).toBeNull()
    expect(parseCssUrl('')).toBeNull()
  })
})

describe('translationField', () => {
  it('кодирует слот и брейкпоинт', () => {
    expect(translationField('src', null)).toBe('src')
    expect(translationField('src', 'tablet')).toBe('src@tablet')
    expect(translationField('bg', null)).toBe('bg:image')
    expect(translationField('bg', 'mobile')).toBe('bg:image@mobile')
  })
})

describe('findOverride', () => {
  const root = {
    id: 'root',
    tagName: 'div',
    children: [{ id: 'img1', tagName: 'img', attributes: { src: '/base.jpg' }, children: [] }],
    variations: {
      mobile: { inheritedOverrides: { img1: { attributes: { src: '/m.jpg' } } } },
    },
  } as unknown as BlockNode

  it('находит оверрайд потомка в variations предка', () => {
    expect(findOverride(root, 'img1', 'mobile')?.attributes?.src).toBe('/m.jpg')
  })
  it('null если нет оверрайда / нет дерева', () => {
    expect(findOverride(root, 'img1', 'tablet')).toBeNull()
    expect(findOverride(null, 'img1', 'mobile')).toBeNull()
  })
})
