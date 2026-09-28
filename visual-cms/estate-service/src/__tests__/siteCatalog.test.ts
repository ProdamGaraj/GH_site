/**
 * Проекты на сайте: карточка каталога на главной и распроданный проект.
 *
 * Распроданный (status = sold_out) выставляется на сайт целиком: карточка с
 * тегом «Распродано», страница проекта с тем же тегом, планировки — все, но без
 * цен и «N квартир» (цена из CRM у распроданного типа устаревшая).
 */
import {
  buildComplexDetail,
  buildComplexListItem,
  isSoldOut,
  soldOutTags,
  type ComplexRow,
  type PlanTypeRow,
  type TrRow,
} from '../services/i18n'

const complex = (over: Partial<ComplexRow> = {}): ComplexRow =>
  ({
    id: 'c1',
    externalHouseId: 5139395,
    slug: 'ozmakon',
    order: 5,
    status: 'active',
    name: "O'zMakon",
    className: 'Бизнес',
    intro: 'Городской проект',
    about: '',
    aboutTitle: '',
    aboutExtra: '',
    aboutVideo: '',
    hallTitle: '',
    hallText: '',
    address: '',
    locationTitle: '',
    locationText: '',
    locationLabels: [],
    mapUrl: '',
    mapImage: '',
    panoramaUrl: '',
    logo: '',
    logoClass: '',
    media: '/media/about.jpg',
    heroImages: ['/media/hero.jpg'],
    gallery: [],
    hallGallery: [],
    yardEyebrow: '',
    yardTitle: '',
    yardText: '',
    yardFeatures: [],
    yardGallery: [],
    stats: [],
    filterClass: 'business',
    cardImage: '/media/card.jpg',
    cardTags: ['Рассрочка', 'Ипотека'],
    ...over,
  }) as unknown as ComplexRow

const planType = (id: string, over: Partial<PlanTypeRow> = {}): PlanTypeRow => ({
  id,
  houseId: 'h1',
  signature: `${id}|sig`,
  planName: id,
  images: [{ title: 'Main', url: `/media/${id}.jpg`, thumbUrl: '' }],
  panoUrl: '',
  rooms: 2,
  isStudio: false,
  areaMin: '55',
  areaMax: '56',
  priceMin: '1000000000',
  priceMax: '1200000000',
  apartmentsCount: 3,
  floors: [3, 5],
  entrances: [1],
  windowViews: ['двор'],
  order: 0,
  ...over,
})

const tr = (field: string, value: unknown, locale = 'uz'): TrRow => ({
  entityType: 'complex',
  entityId: 'c1',
  locale,
  field,
  value: typeof value === 'string' ? value : JSON.stringify(value),
})

describe('распроданный проект', () => {
  it('признак — status sold_out', () => {
    expect(isSoldOut({ status: 'sold_out' })).toBe(true)
    expect(isSoldOut({ status: 'active' })).toBe(false)
  })

  it('тег «Распродано» на трёх языках — массивом 0..1', () => {
    expect(soldOutTags({ status: 'sold_out' }, 'ru')).toEqual([{ label: 'Распродано' }])
    expect(soldOutTags({ status: 'sold_out' }, 'uz')).toEqual([{ label: 'Sotilgan' }])
    expect(soldOutTags({ status: 'sold_out' }, 'en')).toEqual([{ label: 'Sold out' }])
    expect(soldOutTags({ status: 'active' }, 'ru')).toEqual([])
  })
})

describe('карточка каталога на главной', () => {
  it('поля карточки: картинка, класс для фильтра, теги', () => {
    const card = buildComplexListItem(complex(), [], 'ru')
    expect(card).toMatchObject({
      slug: 'ozmakon',
      name: "O'zMakon",
      className: 'Бизнес',
      intro: 'Городской проект',
      cardImage: '/media/card.jpg',
      filterClass: 'business',
      tags: ['Рассрочка', 'Ипотека'],
      soldOut: [],
      cardClass: '',
    })
  })

  it('без своей картинки — About-медиа, без неё — первый hero', () => {
    expect(buildComplexListItem(complex({ cardImage: '' }), [], 'ru').cardImage).toBe('/media/about.jpg')
    expect(buildComplexListItem(complex({ cardImage: '', media: '' }), [], 'ru').cardImage).toBe('/media/hero.jpg')
  })

  it('распроданная: тег «Распродано» и класс карточки без подсветки и цены', () => {
    const card = buildComplexListItem(complex({ status: 'sold_out' }), [], 'uz')
    expect(card.soldOut).toEqual([{ label: 'Sotilgan' }])
    expect(card.cardClass).toBe('is-sold-visible')
  })

  it('теги переводятся списком; пустые и пробельные отбрасываются', () => {
    const uz = buildComplexListItem(complex(), [tr('cardTags', ['Muddatli to‘lov', ' ', 'Ipoteka'])], 'uz')
    expect(uz.tags).toEqual(['Muddatli to‘lov', 'Ipoteka'])
    expect(buildComplexListItem(complex(), [tr('cardTags', ['X'])], 'ru').tags).toEqual(['Рассрочка', 'Ипотека'])
  })

  it('старый ЖК без новых полей — пустые теги и класс business', () => {
    const card = buildComplexListItem(complex({ filterClass: undefined, cardTags: undefined }), [], 'ru')
    expect(card.filterClass).toBe('business')
    expect(card.tags).toEqual([])
  })
})

describe('страница распроданного проекта', () => {
  const types = [planType('A', { apartmentsCount: 0 }), planType('B', { apartmentsCount: 0, order: 1 })]

  it('показываются все планировки — без цены и «N квартир»', () => {
    const dto = buildComplexDetail(complex({ status: 'sold_out' }), [], [], [], 'ru', types)
    expect(dto.planTypes.map((p) => p.planName)).toEqual(['A', 'B'])
    for (const p of dto.planTypes) {
      expect(p).toMatchObject({ priceLabel: '', countLabel: '', priceMin: 0, priceMax: 0 })
      expect(p.cover).toEqual([{ image: `/media/${p.planName}.jpg` }])
    }
    expect(dto.planSections).toHaveLength(1)
  })

  it('тег «Распродано» и класс страницы для вёрстки', () => {
    const dto = buildComplexDetail(complex({ status: 'sold_out' }), [], [], [], 'en', types)
    expect(dto.soldOut).toEqual([{ label: 'Sold out' }])
    expect(dto.saleStateClass).toBe('is-sold-out')
  })

  it('активный проект — как раньше: типы без квартир скрыты, цены на месте', () => {
    const dto = buildComplexDetail(complex(), [], [], [], 'ru', [planType('A', { apartmentsCount: 0 }), planType('C')])
    expect(dto.planTypes.map((p) => p.planName)).toEqual(['C'])
    expect(dto.planTypes[0].priceLabel).not.toBe('')
    expect(dto.planTypes[0].priceMin).toBe(1000000000)
    expect(dto.soldOut).toEqual([])
    expect(dto.saleStateClass).toBe('')
  })

  it('распроданный без данных о планировках (нет CRM) — раздела нет', () => {
    const dto = buildComplexDetail(complex({ status: 'sold_out', externalHouseId: null }), [], [], [], 'ru', [])
    expect(dto.planTypes).toEqual([])
    expect(dto.planSections).toEqual([])
  })
})
