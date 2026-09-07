import { describe, it, expect } from 'vitest'
import type { BlockNode } from '@/shared/types'
import { readAutoplayMs,
  readEffect,
  readDurationMs,
  CAROUSEL_EFFECTS,
} from './carouselAutoplayHelper'

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

describe('readEffect', () => {
  const withAttr = (attrs: Record<string, string>) => ({ id: 'n', attributes: attrs } as any)

  it('без атрибута — сдвиг по горизонтали (дефолт рантайма)', () => {
    expect(readEffect({ id: 'n' } as any).id).toBe('slide')
  })
  it('читает заданный эффект', () => {
    expect(readEffect(withAttr({ 'data-carousel-effect': 'fade' })).id).toBe('fade')
  })
  it('неизвестное значение трактует как дефолт — так же, как рантайм', () => {
    expect(readEffect(withAttr({ 'data-carousel-effect': 'кувырок' })).id).toBe('slide')
  })
  it('у каждого эффекта есть подпись и подсказка', () => {
    for (const e of CAROUSEL_EFFECTS) {
      expect(e.label.length).toBeGreaterThan(0)
      expect(e.hint.length).toBeGreaterThan(0)
    }
  })
  it('идентификаторы уникальны', () => {
    expect(new Set(CAROUSEL_EFFECTS.map((e) => e.id)).size).toBe(CAROUSEL_EFFECTS.length)
  })
})

describe('readDurationMs', () => {
  const withAttr = (v: string) => ({ id: 'n', attributes: { 'data-carousel-duration': v } } as any)

  it('без атрибута — null, действует дефолт эффекта', () => {
    expect(readDurationMs({ id: 'n' } as any)).toBeNull()
  })
  it('читает число', () => {
    expect(readDurationMs(withAttr('1200'))).toBe(1200)
  })
  it('ноль допустим — это мгновенная смена', () => {
    expect(readDurationMs(withAttr('0'))).toBe(0)
  })
  it('мусор и отрицательные значения — null, а не NaN', () => {
    expect(readDurationMs(withAttr('быстро'))).toBeNull()
    expect(readDurationMs(withAttr('-5'))).toBeNull()
    expect(readDurationMs(withAttr(''))).toBeNull()
  })
})
