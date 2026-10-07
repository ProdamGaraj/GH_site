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
  externalHouseId: 1042,
  slug: 'assalom-dostlik',
  order: 0,
  status: 'active',
  name: 'Assalom Doʼstlik',
  className: 'Комфорт+',
  intro: 'ru intro',
  about: 'ru about',
  aboutTitle: 'О проекте',
  aboutExtra: 'ru extra',
  hallTitle: 'Дизайнерские холлы',
  hallText: 'ru hall text',
  address: 'г. Ташкент, квартал Golden House',
  locationTitle: 'Территория большой жизни',
  locationText: 'ru location',
  locationLabels: [
    { label: 'Golden House', accent: true, top: '46%', left: '58%' },
    { label: 'Парк', top: '31%', left: '17%' },
  ],
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
  panoramaUrl: 'https://pano',
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
// Строки базы: цена из CRM в них есть — в ответ для сайта она не попадает.
const apartments = [
  { id: 'a3', houseId: 'h1', order: 2, rooms: 3, areaM2: '65.41', price: '871240268', oldPrice: null, entrance: 3, apartmentClass: 'Бизнес', badges: ['Рассрочка'], floor: '4/16', number: '139', deadline: '1 кв. 2028', offerLabel: 'Последняя планировка', status: 'available', planImage: '' },
  { id: 'a1', houseId: 'h1', order: 0, rooms: 4, areaM2: '114.00', price: '1354320000', oldPrice: '1539000000', entrance: 2, apartmentClass: 'Бизнес', badges: ['Акция'], floor: '8/9', number: '102', deadline: '1 кв. 2028', offerLabel: 'Акция', status: 'available', planImage: '' },
  { id: 'a2', houseId: 'h2', order: 1, rooms: 3, areaM2: '78.81', price: '936748269', oldPrice: '1064486670', entrance: 3, apartmentClass: 'Бизнес', badges: ['Ипотека'], floor: '2/16', number: '116', deadline: '1 кв. 2028', offerLabel: '', status: 'available', planImage: '' },
] as unknown as ApartmentRow[]

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
      slides: [{ url: 'yard1.jpg', image: 'yard1.jpg', video: '', position: '50% 50%', fit: 'cover', theme: '', block: '' }],
    })
    expect(dto.stats).toEqual([{ value: 'Комфорт+', label: 'Класс жилья' }])
  })

  it('sorts houses by order and nests apartments sorted by order', () => {
    expect(dto.houses.map((h) => h.id)).toEqual(['h1', 'h2'])
    expect(dto.houses[0].apartments.map((a) => a.id)).toEqual(['a1', 'a3'])
    expect(dto.houses[1].apartments.map((a) => a.id)).toEqual(['a2'])
  })

  it('derives apartment title/meta', () => {
    const a1 = dto.houses[0].apartments[0]
    expect(a1.title).toBe('4-комн. 114 м²')
    expect(a1.meta).toBe('№ 102 | 8/9 этаж | 2 подъезд | 1 кв. 2028')
    expect(a1.areaM2).toBe(114)
  })

  it('цен нет ни у квартир, ни у групп: на сайте цены не показываются', () => {
    const json = JSON.stringify(dto)
    expect(json).not.toMatch(/"(old)?[pP]rice/)
    expect(json).not.toMatch(/1354320000|1 354 320 000|UZS/)
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
      externalHouseId: 1042,
      name: 'Assalom Doʼstlik',
      className: 'Комфорт+',
      intro: 'ru intro',
      cardImage: 'media.jpg',
      status: 'active',
      order: 0,
      // Поля карточки на главной; у ЖК без них — значения по умолчанию.
      filterClass: 'business',
      tags: [],
      soldOut: [],
      cardClass: '',
    })
  })

  it('falls back cardImage to first hero image when media empty', () => {
    const item = buildComplexListItem({ ...complex, media: '' }, [], 'ru')
    expect(item.cardImage).toBe('h1.jpg')
  })

  it('cardImage skips a hero video — url() on .mp4 renders nothing', () => {
    const item = buildComplexListItem({ ...complex, media: '', heroImages: ['/v.mp4', { url: 'h2.jpg', fit: 'contain' }] }, [], 'ru')
    expect(item.cardImage).toBe('h2.jpg')
  })
})

describe('buildComplexDetail — hero slides (photo and video)', () => {
  const withHero = (heroImages: unknown[], media = 'media.jpg') =>
    buildComplexDetail({ ...complex, media, heroImages } as typeof complex, houses, apartments, [], 'ru')

  it('photo-only hero keeps the old fields and gains slides', () => {
    const dto = withHero(['h1.jpg', 'h2.jpg'])
    expect(dto.heroImages).toEqual(['h1.jpg', 'h2.jpg'])
    expect(dto.heroPoster).toBe('h1.jpg')
    expect(dto.heroSlides.map((s) => [s.image, s.video])).toEqual([['h1.jpg', ''], ['h2.jpg', '']])
  })

  it('video first: slide plays it over the first photo, poster is that photo', () => {
    const dto = withHero(['/v.mp4', 'h2.jpg'])
    expect(dto.heroImages).toEqual(['/v.mp4', 'h2.jpg'])
    expect(dto.heroPoster).toBe('h2.jpg')
    expect(dto.heroSlides[0]).toMatchObject({ url: '/v.mp4', image: 'h2.jpg', video: '/v.mp4' })
  })

  it('video only: poster falls back to media', () => {
    const dto = withHero(['/v.mp4'])
    expect(dto.heroPoster).toBe('media.jpg')
    expect(dto.heroSlides[0]).toMatchObject({ image: 'media.jpg', video: '/v.mp4' })
  })

  it('slide settings (focus/fit) reach the slide; urls stay plain strings', () => {
    const dto = withHero([{ url: 'h1.jpg', focus: { x: 20, y: 80 }, fit: 'cover' }])
    expect(dto.heroImages).toEqual(['h1.jpg'])
    expect(dto.heroSlides[0]).toMatchObject({ position: '20% 80%', fit: 'cover' })
  })

  it('empty hero: no slides, poster from media', () => {
    const dto = withHero([])
    expect(dto.heroSlides).toEqual([])
    expect(dto.heroPoster).toBe('media.jpg')
  })
})

describe('buildComplexDetail — только продающиеся квартиры на витрине', () => {
  // Проданная и забронированная в том же доме, что и a1/a3: если фильтр
  // отвалится, они попадут и в дом, и в плоский грид, и в чипсы фильтра.
  const sold = {
    id: 'aSold', houseId: 'h1', order: 3, rooms: 2, areaM2: '42.26', price: '680799327',
    oldPrice: null, entrance: 1, apartmentClass: 'Эконом', badges: [], floor: '2/16',
    number: '16', deadline: '2 кв. 2029', offerLabel: '', status: 'sold', planImage: '',
  } as ApartmentRow
  const reserved: ApartmentRow = { ...sold, id: 'aReserved', order: 4, number: '17', status: 'reserved' }
  const hidden: ApartmentRow = { ...sold, id: 'aHidden', order: 5, number: '18', status: 'hidden' }
  const withGone = [...apartments, sold, reserved, hidden]
  const dto = buildComplexDetail(complex, houses, withGone, [], 'ru')

  it('не отдаёт проданные, забронированные и скрытые в плоском списке', () => {
    expect(dto.apartments.map((a) => a.id)).toEqual(['a1', 'a2', 'a3'])
  })

  it('не отдаёт их и во вложенных списках домов', () => {
    expect(dto.houses[0].apartments.map((a) => a.id)).toEqual(['a1', 'a3'])
    expect(dto.houses[1].apartments.map((a) => a.id)).toEqual(['a2'])
  })

  it('не тянет их значения в чипсы фильтра', () => {
    // «2 кв. 2029» и «Эконом» есть только у снятых с продажи
    expect(dto.deadlines).not.toContain('2 кв. 2029')
    expect(dto.apartmentClasses).not.toContain('Эконом')
  })

  it('статус, которого нет в справочнике, тоже не показывается', () => {
    const weird = buildComplexDetail(complex, houses, [{ ...sold, id: 'aWeird', status: 'нечто' }], [], 'ru')
    expect(weird.apartments).toEqual([])
  })

  it('пустой вход не ломает сборку', () => {
    const empty = buildComplexDetail(complex, houses, [], [], 'ru')
    expect(empty.apartments).toEqual([])
    expect(empty.deadlines).toEqual([])
    expect(empty.houses.every((h) => h.apartments.length === 0)).toBe(true)
  })
})
