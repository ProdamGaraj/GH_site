import { describe, it, expect } from 'vitest'
import { apartmentSummary } from './houseSummary'

const apts = (...statuses: string[]) => statuses.map((status) => ({ status }))

describe('apartmentSummary', () => {
  it('счётчики по статусам в порядке справочника', () => {
    expect(apartmentSummary(apts('sold', 'available', 'available', 'reserved'))).toBe(
      '4 квартиры из CRM · в продаже 2 · бронь 1 · проданы 1'
    )
  })

  it('склонение', () => {
    expect(apartmentSummary(apts('available'))).toBe('1 квартира из CRM · в продаже 1')
    expect(apartmentSummary(apts(...Array(11).fill('available')))).toMatch(/^11 квартир /)
    expect(apartmentSummary(apts(...Array(154).fill('available')))).toMatch(/^154 квартиры /)
  })

  it('незнакомый статус не теряется', () => {
    expect(apartmentSummary(apts('available', 'нечто', ''))).toBe(
      '3 квартиры из CRM · в продаже 1 · нечто 1 · без статуса 1'
    )
  })

  it('пусто', () => {
    expect(apartmentSummary([])).toBe('квартир из CRM пока нет')
    expect(apartmentSummary(undefined)).toBe('квартир из CRM пока нет')
  })
})
