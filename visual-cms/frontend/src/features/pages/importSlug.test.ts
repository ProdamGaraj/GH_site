import { describe, it, expect } from 'vitest'
import { importedPageSlug } from './importSlug'

describe('importedPageSlug', () => {
  it('index и home — не адрес главной: с суффиксом', () => {
    expect(importedPageSlug('index')).toBe('index-page')
    expect(importedPageSlug('index.html')).toBe('index-page')
    expect(importedPageSlug('Home')).toBe('home-page')
  })

  it('обычные имена — латиница и дефисы, без дефисов по краям', () => {
    expect(importedPageSlug('About Us')).toBe('about-us')
    expect(importedPageSlug(' buyers.html ')).toBe('buyers')
  })

  it('имя без латиницы — «page»', () => {
    expect(importedPageSlug('Покупателям')).toBe('page')
  })
})
