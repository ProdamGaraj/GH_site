import {
  groupTranslations,
  buildTranslationRows,
  buildComplexAdmin,
  fieldKind,
  isTranslatableField,
} from '../services/adminSerialize'
import { TrRow } from '../services/i18n'

describe('fieldKind / isTranslatableField', () => {
  it('knows translatable fields per entity', () => {
    expect(fieldKind('complex', 'name')).toBe('string')
    expect(fieldKind('complex', 'stats')).toBe('json')
    expect(fieldKind('apartment', 'badges')).toBe('json')
    expect(fieldKind('complex', 'slug')).toBeUndefined() // not translatable
    expect(isTranslatableField('house', 'floors')).toBe(true)
    expect(isTranslatableField('house', 'entrances')).toBe(false)
  })
})

describe('groupTranslations', () => {
  it('groups by entityId → locale → field and parses json fields', () => {
    const rows: TrRow[] = [
      { entityType: 'complex', entityId: 'c1', locale: 'uz', field: 'name', value: 'UZ name' },
      { entityType: 'complex', entityId: 'c1', locale: 'en', field: 'name', value: 'EN name' },
      { entityType: 'complex', entityId: 'c1', locale: 'en', field: 'stats', value: '[{"value":"9","label":"Floors"}]' },
      { entityType: 'apartment', entityId: 'a1', locale: 'uz', field: 'badges', value: '["Aksiya"]' },
    ]
    const map = groupTranslations(rows)
    expect(map.get('c1')).toEqual({
      uz: { name: 'UZ name' },
      en: { name: 'EN name', stats: [{ value: '9', label: 'Floors' }] },
    })
    expect(map.get('a1')).toEqual({ uz: { badges: ['Aksiya'] } })
  })

  it('keeps raw string when json parse fails', () => {
    const map = groupTranslations([
      { entityType: 'complex', entityId: 'c1', locale: 'en', field: 'stats', value: 'broken[' },
    ])
    expect(map.get('c1')!.en.stats).toBe('broken[')
  })
})

describe('buildTranslationRows', () => {
  it('serializes string + json fields, skips ru/empty/non-translatable', () => {
    const rows = buildTranslationRows('complex', 'c1', {
      ru: { name: 'IGNORED (ru is base)' },
      uz: { name: 'UZ', slug: 'not-translatable', intro: '' },
      en: { stats: [{ value: '9', label: 'Floors' }], name: 'EN' },
    })
    expect(rows).toEqual(
      expect.arrayContaining([
        { entityType: 'complex', entityId: 'c1', locale: 'uz', field: 'name', value: 'UZ' },
        { entityType: 'complex', entityId: 'c1', locale: 'en', field: 'name', value: 'EN' },
        { entityType: 'complex', entityId: 'c1', locale: 'en', field: 'stats', value: '[{"value":"9","label":"Floors"}]' },
      ])
    )
    // ru dropped, slug (non-translatable) dropped, empty intro dropped
    expect(rows.find((r) => r.locale === 'ru')).toBeUndefined()
    expect(rows.find((r) => r.field === 'slug')).toBeUndefined()
    expect(rows.find((r) => r.field === 'intro')).toBeUndefined()
    expect(rows.length).toBe(3)
  })

  it('returns empty for undefined translations', () => {
    expect(buildTranslationRows('house', 'h1', undefined)).toEqual([])
  })
})

describe('buildComplexAdmin', () => {
  it('nests houses+apartments with per-entity translations', () => {
    const complex = { id: 'c1', slug: 'x', name: 'ru' }
    const houses = [{ id: 'h1', complexId: 'c1', order: 0, name: 'H1' }]
    const apartments = [{ id: 'a1', houseId: 'h1', order: 0, number: '102' }]
    const translations: TrRow[] = [
      { entityType: 'complex', entityId: 'c1', locale: 'uz', field: 'name', value: 'UZ' },
      { entityType: 'apartment', entityId: 'a1', locale: 'en', field: 'offerLabel', value: 'Promo' },
    ]
    const dto = buildComplexAdmin(complex, houses, apartments, translations)
    expect(dto.translations).toEqual({ uz: { name: 'UZ' } })
    expect(dto.houses[0].translations).toEqual({}) // no house translations
    expect(dto.houses[0].apartments[0].translations).toEqual({ en: { offerLabel: 'Promo' } })
  })
})
