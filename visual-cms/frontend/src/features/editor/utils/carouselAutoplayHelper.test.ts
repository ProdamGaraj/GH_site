import { describe, it, expect } from 'vitest'
import type { BlockNode } from '@/shared/types'
import { readAutoplayMs } from './carouselAutoplayHelper'

const node = (attrs: Record<string, string>): BlockNode =>
  ({ id: 'x', tagName: 'div', elementType: 'container', styles: { properties: {} }, children: [], attributes: attrs, metadata: {} } as BlockNode)

describe('readAutoplayMs', () => {
  it('нет атрибута → 0 (автоплей выключен)', () => {
    expect(readAutoplayMs(node({}))).toBe(0)
  })

  it('положительное число → как есть', () => {
    expect(readAutoplayMs(node({ 'data-carousel-autoplay': '5000' }))).toBe(5000)
  })

  it('0 → 0 (выключено)', () => {
    expect(readAutoplayMs(node({ 'data-carousel-autoplay': '0' }))).toBe(0)
  })

  it('отрицательное → 0', () => {
    expect(readAutoplayMs(node({ 'data-carousel-autoplay': '-100' }))).toBe(0)
  })

  it('нечисловое → 0', () => {
    expect(readAutoplayMs(node({ 'data-carousel-autoplay': 'abc' }))).toBe(0)
  })

  it('число с хвостом (parseInt) → числовая часть', () => {
    expect(readAutoplayMs(node({ 'data-carousel-autoplay': '3000ms' }))).toBe(3000)
  })
})
