import {
  applyOverlay,
  indexTranslations,
  normalizeLocale,
  COMPLEX_TR_FIELDS,
  APARTMENT_TR_FIELDS,
  DEFAULT_LOCALE,
  TrRow,
} from '../services/i18n'

describe('normalizeLocale', () => {
  it('accepts supported locales', () => {
    expect(normalizeLocale('ru')).toBe('ru')
    expect(normalizeLocale('uz')).toBe('uz')
    expect(normalizeLocale('en')).toBe('en')
  })
  it('is case-insensitive', () => {
    expect(normalizeLocale('UZ')).toBe('uz')
  })
  it('falls back to ru for unknown/empty', () => {
    expect(normalizeLocale('fr')).toBe(DEFAULT_LOCALE)
    expect(normalizeLocale('')).toBe('ru')
    expect(normalizeLocale(undefined)).toBe('ru')
    expect(normalizeLocale(null)).toBe('ru')
  })
})

describe('applyOverlay', () => {
  const base = {
    id: 'c1',
    name: 'Assalom Doʼstlik',
    className: 'Комфорт+',
    intro: 'ru intro',
    yardFeatures: ['Двор', 'BBQ'],
    stats: [{ value: '16', label: 'Этажей' }],
  } as any

  it('returns base unchanged for default locale (ru)', () => {
    const index = indexTranslations([
      { entityType: 'complex', entityId: 'c1', locale: 'ru', field: 'name', value: 'IGNORED' },
    ])
    const out = applyOverlay(base, 'complex', 'c1', 'ru', COMPLEX_TR_FIELDS, index)
    expect(out).toBe(base) // same ref, no copy
    expect(out.name).toBe('Assalom Doʼstlik')
  })

  it('overlays string fields for uz', () => {
    const rows: TrRow[] = [
      { entityType: 'complex', entityId: 'c1', locale: 'uz', field: 'name', value: 'Assalom Doʼstlik UZ' },
      { entityType: 'complex', entityId: 'c1', locale: 'uz', field: 'intro', value: 'uz intro' },
    ]
    const out = applyOverlay(base, 'complex', 'c1', 'uz', COMPLEX_TR_FIELDS, indexTranslations(rows))
    expect(out.name).toBe('Assalom Doʼstlik UZ')
    expect(out.intro).toBe('uz intro')
    // untranslated -> ru fallback
    expect(out.className).toBe('Комфорт+')
    // base not mutated
    expect(base.name).toBe('Assalom Doʼstlik')
  })

  it('parses json fields (yardFeatures, stats) from overlay value', () => {
    const rows: TrRow[] = [
      { entityType: 'complex', entityId: 'c1', locale: 'en', field: 'yardFeatures', value: '["Yard","BBQ zone"]' },
      { entityType: 'complex', entityId: 'c1', locale: 'en', field: 'stats', value: '[{"value":"16","label":"Floors"}]' },
    ]
    const out = applyOverlay(base, 'complex', 'c1', 'en', COMPLEX_TR_FIELDS, indexTranslations(rows))
    expect(out.yardFeatures).toEqual(['Yard', 'BBQ zone'])
    expect(out.stats).toEqual([{ value: '16', label: 'Floors' }])
  })

  it('falls back to base on invalid json overlay', () => {
    const rows: TrRow[] = [
      { entityType: 'complex', entityId: 'c1', locale: 'en', field: 'yardFeatures', value: 'not-json[' },
    ]
    const out = applyOverlay(base, 'complex', 'c1', 'en', COMPLEX_TR_FIELDS, indexTranslations(rows))
    expect(out.yardFeatures).toEqual(['Двор', 'BBQ'])
  })

  it('treats empty overlay value as no-translation (fallback to ru)', () => {
    const rows: TrRow[] = [
      { entityType: 'complex', entityId: 'c1', locale: 'uz', field: 'name', value: '' },
    ]
    const out = applyOverlay(base, 'complex', 'c1', 'uz', COMPLEX_TR_FIELDS, indexTranslations(rows))
    expect(out.name).toBe('Assalom Doʼstlik')
  })

  it('does not leak translations across entity ids', () => {
    const rows: TrRow[] = [
      { entityType: 'apartment', entityId: 'OTHER', locale: 'uz', field: 'offerLabel', value: 'Aksiya' },
    ]
    const apt = { id: 'a1', offerLabel: 'Акция', badges: [], apartmentClass: 'Бизнес', deadline: '1 кв. 2028' } as any
    const out = applyOverlay(apt, 'apartment', 'a1', 'uz', APARTMENT_TR_FIELDS, indexTranslations(rows))
    expect(out.offerLabel).toBe('Акция') // OTHER's translation must not apply
  })
})
