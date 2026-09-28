import { describe, it, expect } from 'vitest'
import { hasSlidesWithoutId, slideLangField } from './slideLangHelper'

describe('slideLangField', () => {
  it('ключ варианта — _id слайда, а не номер', () => {
    expect(slideLangField('3f2a9c10-1b2c-4d3e-8f90-a1b2c3d4e5f6', 'imageUrl')).toBe(
      'media:3f2a9c10-1b2c-4d3e-8f90-a1b2c3d4e5f6:imageUrl'
    )
  })
})

describe('hasSlidesWithoutId', () => {
  it('у всех слайдов есть _id — сохранять нечего', () => {
    expect(hasSlidesWithoutId([{ _id: 'a' }, { _id: 'b', imageUrl: '/media/1.png' }])).toBe(false)
  })

  it('слайд без _id или с пустым _id — id ещё не в базе', () => {
    expect(hasSlidesWithoutId([{ _id: 'a' }, { imageUrl: '/media/1.png' }])).toBe(true)
    expect(hasSlidesWithoutId([{ _id: '' }])).toBe(true)
    expect(hasSlidesWithoutId([null])).toBe(true)
  })

  it('нет слайдов или переменной — нечего сохранять', () => {
    expect(hasSlidesWithoutId([])).toBe(false)
    expect(hasSlidesWithoutId(undefined)).toBe(false)
    expect(hasSlidesWithoutId('x')).toBe(false)
  })
})
