import { describe, it, expect } from 'vitest'
import {
  readSlideResponsive,
  writeSlideResponsive,
  countSlideResponsive,
} from './slideResponsiveHelper'

describe('slideResponsiveHelper', () => {
  it('read: пусто по умолчанию', () => {
    expect(readSlideResponsive({}, 'imageUrl', 'mobile')).toBe('')
    expect(readSlideResponsive({ _responsive: { imageUrl: { mobile: '/m.jpg' } } }, 'imageUrl', 'mobile')).toBe('/m.jpg')
  })

  it('write: создаёт _responsive[field][bp] иммутабельно', () => {
    const slide = { imageUrl: '/base.jpg' }
    const next = writeSlideResponsive(slide, 'imageUrl', 'tablet', '/t.jpg')
    expect((next._responsive as any).imageUrl.tablet).toBe('/t.jpg')
    // оригинал не тронут
    expect((slide as any)._responsive).toBeUndefined()
  })

  it('write: пустое значение удаляет вариант и чистит пустые карты', () => {
    const slide = { _responsive: { imageUrl: { tablet: '/t.jpg' } } }
    const next = writeSlideResponsive(slide, 'imageUrl', 'tablet', '')
    expect(next._responsive).toBeUndefined() // карта опустела → ключ убран
  })

  it('write: несколько брейкпоинтов и полей сосуществуют', () => {
    let s: Record<string, unknown> = {}
    s = writeSlideResponsive(s, 'imageUrl', 'tablet', '/t.jpg')
    s = writeSlideResponsive(s, 'imageUrl', 'mobile', '/m.jpg')
    s = writeSlideResponsive(s, 'bgUrl', 'mobile', '/bg-m.jpg')
    expect(countSlideResponsive(s, 'imageUrl')).toBe(2)
    expect(countSlideResponsive(s, 'bgUrl')).toBe(1)
    expect(readSlideResponsive(s, 'imageUrl', 'mobile')).toBe('/m.jpg')
  })
})
