import {
  buildComplexDetail,
  buildComplexListItem,
  ComplexRow,
  HouseRow,
  ApartmentRow,
  TrRow,
} from '../services/i18n'

const complex: ComplexRow = {
  id: 'c1',
  slug: 'assalom-dostlik',
  order: 0,
  status: 'active',
  name: 'Assalom Doʼstlik',
  className: 'Комфорт+',
  intro: 'ru intro',
  about: 'ru about',
  aboutExtra: 'ru extra',
  locationText: 'ru location',
  yardEyebrow: 'Двор',
  yardTitle: 'Дворовое пространство',
  yardText: 'ru yard text',
  yardFeatures: ['Площадки', 'BBQ'],
  stats: [{ value: 'Комфорт+', label: 'Класс жилья' }],
  logo: 'logo.png',
  logoClass: 'logo-dostlik',
  media: 'media.jpg',
  aboutVideo: 'about.mp4',
  mapUrl: 'https://map',
  mapImage: '',
  heroImages: ['h1.jpg', 'h2.jpg'],
  gallery: [],
  hallGallery: ['hall1.jpg'],
  yardGallery: ['yard1.jpg'],
}

const houses: HouseRow[] = [
  { id: 'h2', complexId: 'c1', order: 1, name: 'Корпус 2', floors: '16', deadline: '1 кв. 2028', className: 'Комфорт+', entrances: 3 },
  { id: 'h1', complexId: 'c1', order: 0, name: 'Корпус 1', floors: '9', deadline: '1 кв. 2028', className: 'Комфорт+', entrances: 2 },
]

// Глобальный order задаёт порядок в плоском гриде «Выбрать» (a1,a2,a3),
// при этом a2 живёт в другом доме (h2) — грид идёт вперемешку по домам.
const apartments: ApartmentRow[] = [
  { id: 'a3', houseId: 'h1', order: 2, rooms: 3, areaM2: '65.41', price: '871240268', oldPrice: null, entrance: 3, apartmentClass: 'Бизнес', badges: ['Рассрочка'], floor: '4/16', number: '139', deadline: '1 кв. 2028', offerLabel: 'Последняя планировка', status: 'available', planImage: '' },
  { id: 'a1', houseId: 'h1', order: 0, rooms: 4, areaM2: '114.00', price: '1354320000', oldPrice: '1539000000', entrance: 2, apartmentClass: 'Бизнес', badges: ['Акция'], floor: '8/9', number: '102', deadline: '1 кв. 2028', offerLabel: 'Акция', status: 'available', planImage: '' },
  { id: 'a2', houseId: 'h2', order: 1, rooms: 3, areaM2: '78.81', price: '936748269', oldPrice: '1064486670', entrance: 3, apartmentClass: 'Бизнес', badges: ['Ипотека'], floor: '2/16', number: '116', deadline: '1 кв. 2028', offerLabel: '', status: 'available', planImage: '' },
]

describe('buildComplexDetail — structure (ru)', () => {
  const dto = buildComplexDetail(complex, houses, apartments, [], 'ru')

  it('maps complex-level fields and yard object', () => {
    expect(dto.slug).toBe('assalom-dostlik')
    expect(dto.name).toBe('Assalom Doʼstlik')
    expect(dto.yard).toEqual({
      eyebrow: 'Двор',
      title: 'Дворовое пространство',
      text: 'ru yard text',
      features: ['Площадки', 'BBQ'],
      gallery: ['yard1.jpg'],
    })
    expect(dto.stats).toEqual([{ value: 'Комфорт+', label: 'Класс жилья' }])
  })

  it('sorts houses by order and nests apartments sorted by order', () => {
    expect(dto.houses.map((h) => h.id)).toEqual(['h1', 'h2'])
    expect(dto.houses[0].apartments.map((a) => a.id)).toEqual(['a1', 'a3'])
    expect(dto.houses[1].apartments.map((a) => a.id)).toEqual(['a2'])
  })

  it('derives apartment title/price/meta', () => {
    const a1 = dto.houses[0].apartments[0]
    expect(a1.title).toBe('4-комн. 114 м²')
    expect(a1.priceFormatted).toBe('1 354 320 000 UZS')
    expect(a1.oldPriceFormatted).toBe('1 539 000 000 UZS')
    expect(a1.meta).toBe('№ 102 | 8/9 этаж | 2 подъезд | 1 кв. 2028')
    expect(a1.price).toBe(1354320000)
    expect(a1.areaM2).toBe(114)
  })

  it('handles null oldPrice', () => {
    const a3 = dto.houses[0].apartments[1] // a3 lives in h1 at order 2
    expect(a3.id).toBe('a3')
    expect(a3.oldPrice).toBeNull()
    expect(a3.oldPriceFormatted).toBe('')
  })

  it('provides flattened apartments across houses in house/apartment order', () => {
    expect(dto.apartments.map((a) => a.id)).toEqual(['a1', 'a2', 'a3'])
  })
})

describe('buildComplexDetail — overlay (uz) with fallback', () => {
  const translations: TrRow[] = [
    { entityType: 'complex', entityId: 'c1', locale: 'uz', field: 'name', value: 'Assalom Doʼstlik UZ' },
    { entityType: 'apartment', entityId: 'a1', locale: 'uz', field: 'offerLabel', value: 'Aksiya' },
    // house h1 has no uz translation -> fallback to ru
  ]
  const dto = buildComplexDetail(complex, houses, apartments, translations, 'uz')

  it('applies complex + apartment overlays, keeps ru fallback elsewhere', () => {
    expect(dto.name).toBe('Assalom Doʼstlik UZ')
    expect(dto.about).toBe('ru about') // untranslated
    expect(dto.houses[0].name).toBe('Корпус 1') // house fallback
    const a1 = dto.houses[0].apartments[0]
    expect(a1.offerLabel).toBe('Aksiya')
    expect(a1.meta).toBe('№ 102 | 8/9 qavat | 2 kirish | 1 кв. 2028')
  })
})

describe('buildComplexListItem', () => {
  it('builds catalog card, cardImage from media', () => {
    const item = buildComplexListItem(complex, [], 'ru')
    expect(item).toEqual({
      slug: 'assalom-dostlik',
      name: 'Assalom Doʼstlik',
      className: 'Комфорт+',
      intro: 'ru intro',
      cardImage: 'media.jpg',
      status: 'active',
      order: 0,
    })
  })

  it('falls back cardImage to first hero image when media empty', () => {
    const item = buildComplexListItem({ ...complex, media: '' }, [], 'ru')
    expect(item.cardImage).toBe('h1.jpg')
  })
})
