import { describe, it, expect } from 'vitest'
import { getT, setT, isRu } from './tfield'

describe('tfield getT/setT', () => {
  const form = {
    name: 'ru name',
    intro: 'ru intro',
    translations: { uz: { name: 'uz name' }, en: {} },
  }

  it('getT returns base value for ru', () => {
    expect(getT(form, 'name', 'ru')).toBe('ru name')
  })

  it('getT returns override for uz, undefined when absent', () => {
    expect(getT(form, 'name', 'uz')).toBe('uz name')
    expect(getT(form, 'intro', 'uz')).toBeUndefined() // no override → fallback in UI
  })

  it('setT for ru writes the base field, keeps translations', () => {
    const next = setT(form, 'name', 'ru', 'new ru')
    expect(next.name).toBe('new ru')
    expect(next.translations).toEqual(form.translations)
    expect(form.name).toBe('ru name') // immutable
  })

  it('setT for uz writes into translations without touching base', () => {
    const next = setT(form, 'intro', 'uz', 'uz intro')
    expect((next.translations as any).uz).toEqual({ name: 'uz name', intro: 'uz intro' })
    expect(next.intro).toBe('ru intro') // base untouched
    expect((form.translations as any).uz).toEqual({ name: 'uz name' }) // immutable
  })

  it('setT for a new locale creates its bucket', () => {
    const bare = { name: 'x' } as any
    const next = setT(bare, 'name', 'en', 'EN')
    expect(next.translations).toEqual({ en: { name: 'EN' } })
  })

  it('isRu', () => {
    expect(isRu('ru')).toBe(true)
    expect(isRu('uz')).toBe(false)
  })
})
