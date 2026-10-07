import { describe, it, expect } from 'vitest'
import { fieldKey, sameMarkMode } from './sameMark'

describe('sameMarkMode — что пишет клик по «Один для всех языков»', () => {
  it('текст (переводится по умолчанию): включить — same, выключить — снять отметку', () => {
    expect(sameMarkMode(true, false)).toBe('same')
    expect(sameMarkMode(false, false)).toBe('default')
  })

  it('ссылка/медиа (общие по умолчанию): выключить — translate, включить — снять отметку', () => {
    expect(sameMarkMode(false, true)).toBe('translate')
    expect(sameMarkMode(true, true)).toBe('default')
  })

  it('fieldKey совпадает с ключом правок панели', () => {
    expect(fieldKey('node-1', 'content')).toBe('node-1::content')
  })
})
