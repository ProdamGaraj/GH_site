/**
 * Поля секций страницы проекта (#about/#hall/#choice/#location), которые
 * раньше были захардкожены в блоках CMS, и производные «условные» массивы
 * (offers/planImages/mapImages) — движок шаблонов не умеет условий, поэтому
 * опциональность выражается длиной массива.
 */
import {
  optionalOne,
  buildLocationLabels,
  buildComplexDetail,
  buildApartmentDTO,
  buildComplexListItem,
  indexTranslations,
  ComplexRow,
  ApartmentRow,
  TrRow,
} from '../services/i18n'

const baseComplex: ComplexRow = {
  id: 'c1', externalId: 4210, slug: 'harizma', order: 0, status: 'active',
  name: 'Harizma', className: 'Комфорт', intro: 'intro',
  about: 'about', aboutTitle: 'О проекте', aboutExtra: 'extra',
  hallTitle: 'Дизайнерские холлы', hallText: 'hall text',
  address: 'г. Ташкент', locationTitle: 'Территория большой жизни',
  locationText: 'location', locationLabels: [{ label: 'Метро', top: '70%', left: '32%' }],
  yardEyebrow: '', yardTitle: '', yardText: '', yardFeatures: [], stats: [],
  logo: '', logoClass: '', media: '', aboutVideo: '',
  mapUrl: '', mapImage: '', panoramaUrl: '',
  heroImages: [], gallery: [], hallGallery: [], yardGallery: [],
}

const baseApartment: ApartmentRow = {
  id: 'a1', houseId: 'h1', order: 0, rooms: 2, areaM2: '60', price: '100',
  oldPrice: null, entrance: 1, apartmentClass: 'Бизнес', badges: ['Акция'],
  floor: '3/9', number: '12', deadline: '1 кв. 2028',
  offerLabel: '', status: 'available', planImage: '',
}

describe('optionalOne', () => {
  it('пустое значение → пустой массив (узел не рендерится)', () => {
    expect(optionalOne('image', '')).toEqual([])
    expect(optionalOne('image', null)).toEqual([])
    expect(optionalOne('image', undefined)).toEqual([])
  })
  it('строка из пробелов считается пустой', () => {
    expect(optionalOne('label', '   ')).toEqual([])
  })
  it('значение → массив из одного элемента с заданным ключом', () => {
    expect(optionalOne('image', '/media/plan.png')).toEqual([{ image: '/media/plan.png' }])
    expect(optionalOne('label', 'Акция')).toEqual([{ label: 'Акция' }])
  })
  it('обрезает пробелы по краям', () => {
    expect(optionalOne('label', '  Акция  ')).toEqual([{ label: 'Акция' }])
  })
})

describe('buildLocationLabels', () => {
  it('accent → готовый CSS-класс, иначе базовый', () => {
    expect(buildLocationLabels([
      { label: 'Golden House', accent: true, top: '46%', left: '58%' },
      { label: 'Парк', top: '31%', left: '17%' },
    ])).toEqual([
      { label: 'Golden House', className: 'map-label accent', top: '46%', left: '58%' },
      { label: 'Парк', className: 'map-label', top: '31%', left: '17%' },
    ])
  })
  it('не-массив и пустой массив → []', () => {
    expect(buildLocationLabels(null)).toEqual([])
    expect(buildLocationLabels('nope')).toEqual([])
    expect(buildLocationLabels([])).toEqual([])
  })
  it('отбрасывает элементы без строкового label', () => {
    expect(buildLocationLabels([{ top: '1%', left: '2%' }, null, { label: 5 }])).toEqual([])
  })
  it('подставляет центр при отсутствии координат', () => {
    expect(buildLocationLabels([{ label: 'Метро' }])).toEqual([
      { label: 'Метро', className: 'map-label', top: '50%', left: '50%' },
    ])
  })
})

describe('buildComplexDetail — поля секций', () => {
  it('пробрасывает тексты секций в DTO', () => {
    const dto = buildComplexDetail(baseComplex, [], [], [], 'ru')
    expect(dto.aboutTitle).toBe('О проекте')
    expect(dto.hallTitle).toBe('Дизайнерские холлы')
    expect(dto.hallText).toBe('hall text')
    expect(dto.address).toBe('г. Ташкент')
    expect(dto.locationTitle).toBe('Территория большой жизни')
    expect(dto.panoramaUrl).toBe('')
  })
  it('locationLabels собираются с className', () => {
    const dto = buildComplexDetail(baseComplex, [], [], [], 'ru')
    expect(dto.locationLabels).toEqual([
      { label: 'Метро', className: 'map-label', top: '70%', left: '32%' },
    ])
  })
  it('пустой mapImage → mapImages пуст (CSS-заглушка карты остаётся)', () => {
    expect(buildComplexDetail(baseComplex, [], [], [], 'ru').mapImages).toEqual([])
  })
  it('заданный mapImage → оверлей из одного элемента', () => {
    const dto = buildComplexDetail({ ...baseComplex, mapImage: '/media/map.jpg' }, [], [], [], 'ru')
    expect(dto.mapImages).toEqual([{ image: '/media/map.jpg' }])
  })
})

describe('buildApartmentDTO — условные плашка и планировка', () => {
  const idx = indexTranslations([])
  it('пустые offerLabel/planImage → пустые массивы', () => {
    const dto = buildApartmentDTO(baseApartment, 'ru', idx)
    expect(dto.offers).toEqual([])
    expect(dto.planImages).toEqual([])
  })
  it('заполненные → массивы на один элемент', () => {
    const dto = buildApartmentDTO(
      { ...baseApartment, offerLabel: 'Последняя планировка', planImage: '/media/p.png' },
      'ru', idx
    )
    expect(dto.offers).toEqual([{ label: 'Последняя планировка' }])
    expect(dto.planImages).toEqual([{ image: '/media/p.png' }])
  })
})

describe('overlay новых переводимых полей', () => {
  const tr: TrRow[] = [
    { entityType: 'complex', entityId: 'c1', locale: 'en', field: 'hallTitle', value: 'Designer lobbies' },
    { entityType: 'complex', entityId: 'c1', locale: 'en', field: 'address', value: 'Tashkent' },
    { entityType: 'complex', entityId: 'c1', locale: 'en', field: 'locationLabels',
      value: JSON.stringify([{ label: 'Metro', accent: true, top: '70%', left: '32%' }]) },
  ]
  it('строковые поля секций переводятся', () => {
    const dto = buildComplexDetail(baseComplex, [], [], tr, 'en')
    expect(dto.hallTitle).toBe('Designer lobbies')
    expect(dto.address).toBe('Tashkent')
  })
  it('json-поле locationLabels переводится и пересобирает className', () => {
    const dto = buildComplexDetail(baseComplex, [], [], tr, 'en')
    expect(dto.locationLabels).toEqual([
      { label: 'Metro', className: 'map-label accent', top: '70%', left: '32%' },
    ])
  })
  it('без перевода — фолбэк на ru', () => {
    const dto = buildComplexDetail(baseComplex, [], [], tr, 'en')
    expect(dto.aboutTitle).toBe('О проекте')
  })
})

describe('offerLabel остаётся в DTO для обратной совместимости', () => {
  it('offers дублирует offerLabel, не заменяет', () => {
    const dto = buildApartmentDTO({ ...baseApartment, offerLabel: 'Акция' }, 'ru', indexTranslations([]))
    expect(dto.offerLabel).toBe('Акция')
    expect(dto.offers).toEqual([{ label: 'Акция' }])
  })
})

describe('externalId в DTO', () => {
  it('проходит в детальный DTO — плейсхолдер {{item.externalId}} получает значение', () => {
    expect(buildComplexDetail({ ...baseComplex, externalId: 4210 }, [], [], [], 'ru').externalId).toBe(4210)
  })
  it('не сопоставленный проект отдаёт null, а не 0 или пустую строку', () => {
    expect(buildComplexDetail({ ...baseComplex, externalId: null }, [], [], [], 'ru').externalId).toBeNull()
  })
  it('присутствует и в списочном DTO — лёгкий источник каталога не теряет ключ', () => {
    expect(buildComplexListItem({ ...baseComplex, externalId: 7 }, [], 'ru').externalId).toBe(7)
  })
})
