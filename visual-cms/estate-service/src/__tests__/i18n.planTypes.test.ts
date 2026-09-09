/**
 * Типы планировок в DTO страницы проекта.
 *
 * Карточка показывает планировку, а фильтруется по данным квартир этого типа.
 * Отсюда два набора полей, и оба проверяются здесь: подписи для показа и
 * строки-множества для data-атрибутов. Собрать эти строки в шаблоне нечем —
 * движок не умеет ни join, ни условий.
 */
import {
  buildPlanTypeDTO,
  buildComplexDetail,
  formatAreaRange,
  formatPriceFrom,
  formatApartmentsCount,
  formatFloorsRange,
  indexTranslations,
  PLANTYPE_TR_FIELDS,
  type PlanTypeRow,
  type ComplexRow,
  type TrRow,
} from '../services/i18n'

const EMPTY = new Map<string, string>()

function planType(over: Partial<PlanTypeRow> = {}): PlanTypeRow {
  return {
    id: 'plan-1',
    signature: 'К2-54.65-6|abc123',
    planName: 'К2-54.65-6',
    images: [
      { title: 'Main image', url: 'https://cms/media/a.jpg', thumbUrl: 'https://cms/media/a.thumb.webp' },
      { title: 'Additional layout', url: 'https://cms/media/b.jpg', thumbUrl: '' },
    ],
    panoUrl: '',
    rooms: 2,
    isStudio: false,
    areaMin: '55.64',
    areaMax: '56.12',
    priceMin: '1153779562',
    priceMax: '1300000000',
    apartmentsCount: 12,
    floors: [3, 4, 7, 12, 16],
    entrances: [1, 2],
    windowViews: ['бульвар', 'двор'],
    order: 0,
    ...over,
  }
}

const baseComplex: ComplexRow = {
  id: 'c1',
  externalHouseId: 5139395,
  slug: 'ozmakon-business',
  order: 0,
  status: 'active',
  name: "O'zMakon Business",
  className: 'Бизнес',
  intro: '',
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
  media: '',
  heroImages: [],
  gallery: [],
  hallGallery: [],
  yardEyebrow: '',
  yardTitle: '',
  yardText: '',
  yardFeatures: [],
  yardGallery: [],
  stats: [],
} as unknown as ComplexRow

describe('форматирование диапазонов', () => {
  it('площадь показывается диапазоном', () => {
    expect(formatAreaRange('55.64', '56.12', 'ru')).toBe('55.64 – 56.12 м²')
  })

  it('совпавшие границы схлопываются в одно число', () => {
    expect(formatAreaRange('56.12', '56.12', 'ru')).toBe('56.12 м²')
  })

  it('единица измерения меняется по языку', () => {
    expect(formatAreaRange('40', '40', 'en')).toBe('40 m²')
  })

  it('цена подписывается как «от»', () => {
    expect(formatPriceFrom(1153779562, 'ru')).toBe('от 1 153 779 562 UZS')
  })

  it('нулевая цена не даёт плашку «от 0»', () => {
    expect(formatPriceFrom(0, 'ru')).toBe('')
    expect(formatPriceFrom(null, 'ru')).toBe('')
  })

  it('число квартир склоняется', () => {
    expect(formatApartmentsCount(1, 'ru')).toBe('1 квартира')
    expect(formatApartmentsCount(3, 'ru')).toBe('3 квартиры')
    expect(formatApartmentsCount(12, 'ru')).toBe('12 квартир')
    expect(formatApartmentsCount(21, 'ru')).toBe('21 квартира')
    expect(formatApartmentsCount(14, 'ru')).toBe('14 квартир')
  })

  it('ноль квартир подписи не даёт', () => {
    expect(formatApartmentsCount(0, 'ru')).toBe('')
  })

  it('этажи показываются границами, а не перечислением', () => {
    expect(formatFloorsRange([3, 4, 7, 12, 16], 'ru')).toBe('этажи 3–16')
  })

  it('единственный этаж пишется как этаж, а не диапазон', () => {
    expect(formatFloorsRange([5], 'ru')).toBe('5 этаж')
  })

  it('пустой список этажей подписи не даёт', () => {
    expect(formatFloorsRange([], 'ru')).toBe('')
  })
})

describe('карточка типа', () => {
  it('собирает подписи для показа', () => {
    const dto = buildPlanTypeDTO(planType(), 'ru', EMPTY)
    expect(dto.title).toBe('2-комн. 56.12 м²')
    expect(dto.areaLabel).toBe('55.64 – 56.12 м²')
    expect(dto.priceLabel).toBe('от 1 153 779 562 UZS')
    expect(dto.countLabel).toBe('12 квартир')
    expect(dto.floorsLabel).toBe('этажи 3–16')
  })

  it('первая картинка идёт на карточку, все — в атрибут модалки', () => {
    const dto = buildPlanTypeDTO(planType(), 'ru', EMPTY)
    expect(dto.image).toBe('https://cms/media/a.jpg')
    expect(dto.imagesAttr).toBe('https://cms/media/a.jpg|https://cms/media/b.jpg')
  })

  it('тип без картинок не ломает карточку', () => {
    const dto = buildPlanTypeDTO(planType({ images: [] }), 'ru', EMPTY)
    expect(dto.image).toBe('')
    expect(dto.imagesAttr).toBe('')
  })

  it('3D-тур приходит массивом 0..1 — условий в движке шаблонов нет', () => {
    expect(buildPlanTypeDTO(planType(), 'ru', EMPTY).panorama).toEqual([])
    expect(
      buildPlanTypeDTO(planType({ panoUrl: 'https://tour/x' }), 'ru', EMPTY).panorama
    ).toEqual([{ url: 'https://tour/x' }])
  })

  it('множества для фильтра приходят готовыми строками', () => {
    const dto = buildPlanTypeDTO(planType(), 'ru', EMPTY)
    expect(dto.floorsAttr).toBe('3,4,7,12,16')
    expect(dto.entrancesAttr).toBe('1,2')
    expect(dto.windowViewsAttr).toBe('бульвар|двор')
  })

  it('числа для фильтра приходят числами, а не строками из numeric', () => {
    const dto = buildPlanTypeDTO(planType(), 'ru', EMPTY)
    expect(dto.areaMin).toBe(55.64)
    expect(dto.areaMax).toBe(56.12)
    expect(dto.priceMin).toBe(1153779562)
    expect(typeof dto.priceMax).toBe('number')
  })

  it('пустые массивы из базы не роняют сборку', () => {
    const dto = buildPlanTypeDTO(
      planType({ floors: [], entrances: [], windowViews: [], images: [] }),
      'ru',
      EMPTY
    )
    expect(dto.floorsAttr).toBe('')
    expect(dto.windowViewsAttr).toBe('')
  })

  it('имя планировки переводится оверлеем', () => {
    const rows: TrRow[] = [
      { entityType: 'planType', entityId: 'plan-1', locale: 'uz', field: 'planName', value: 'K2 rejasi' } as TrRow,
    ]
    const dto = buildPlanTypeDTO(planType(), 'uz', indexTranslations(rows))
    expect(dto.planName).toBe('K2 rejasi')
  })

  it('переводимое поле объявлено в реестре — иначе оверлей его не наложит', () => {
    expect(PLANTYPE_TR_FIELDS.planName).toBe('string')
  })
})

describe('типы в детали проекта', () => {
  it('попадают в DTO и отсортированы по order', () => {
    const dto = buildComplexDetail(baseComplex, [], [], [], 'ru', [
      planType({ id: 'p2', signature: 'b', order: 1, rooms: 3 }),
      planType({ id: 'p1', signature: 'a', order: 0, rooms: 1 }),
    ])
    expect(dto.planTypes.map((p) => p.id)).toEqual(['p1', 'p2'])
  })

  it('типы без квартир не показываются — строка живёт ради переводов', () => {
    const dto = buildComplexDetail(baseComplex, [], [], [], 'ru', [
      planType({ id: 'p1', signature: 'a', apartmentsCount: 0 }),
      planType({ id: 'p2', signature: 'b', apartmentsCount: 5 }),
    ])
    expect(dto.planTypes.map((p) => p.id)).toEqual(['p2'])
  })

  it('проект без планировок отдаёт пустой массив, а не падает', () => {
    expect(buildComplexDetail(baseComplex, [], [], [], 'ru').planTypes).toEqual([])
  })

  it('комнатности для чипсов собираются из планировок по возрастанию', () => {
    const dto = buildComplexDetail(baseComplex, [], [], [], 'ru', [
      planType({ id: 'p1', signature: 'a', rooms: 3 }),
      planType({ id: 'p2', signature: 'b', rooms: 1 }),
      planType({ id: 'p3', signature: 'c', rooms: 3 }),
    ])
    expect(dto.planRooms).toEqual(['1', '3'])
  })

  it('виды из окон для чипсов собираются без повторов', () => {
    const dto = buildComplexDetail(baseComplex, [], [], [], 'ru', [
      planType({ id: 'p1', signature: 'a', windowViews: ['двор'] }),
      planType({ id: 'p2', signature: 'b', windowViews: ['двор', 'бульвар'] }),
    ])
    expect(dto.planViews).toEqual(['двор', 'бульвар'])
  })

  it('чипсы не собираются из типов без квартир', () => {
    const dto = buildComplexDetail(baseComplex, [], [], [], 'ru', [
      planType({ id: 'p1', signature: 'a', rooms: 9, apartmentsCount: 0, windowViews: ['парковка'] }),
      planType({ id: 'p2', signature: 'b', rooms: 2, apartmentsCount: 3, windowViews: ['двор'] }),
    ])
    expect(dto.planRooms).toEqual(['2'])
    expect(dto.planViews).toEqual(['двор'])
  })
})

describe('условная секция', () => {
  it('проект с планировками получает секцию', () => {
    const dto = buildComplexDetail(baseComplex, [], [], [], 'ru', [planType()])
    expect(dto.planSections).toEqual([{ title: 'Планировки' }])
  })

  it('проект без планировок секции не получает — пустая панель фильтра не нужна', () => {
    expect(buildComplexDetail(baseComplex, [], [], [], 'ru').planSections).toEqual([])
  })

  it('типы без квартир секцию не создают', () => {
    const dto = buildComplexDetail(baseComplex, [], [], [], 'ru', [
      planType({ apartmentsCount: 0 }),
    ])
    expect(dto.planSections).toEqual([])
  })

  it('заголовок переводится', () => {
    const dto = buildComplexDetail(baseComplex, [], [], [], 'uz', [planType()])
    expect(dto.planSections[0].title).toBe('Rejalar')
  })
})

describe('обложка и границы этажей', () => {
  it('обложка приходит массивом 0..1 — пустой url() затёр бы заглушку', () => {
    expect(buildPlanTypeDTO(planType(), 'ru', EMPTY).cover).toEqual([
      { image: 'https://cms/media/a.jpg' },
    ])
    expect(buildPlanTypeDTO(planType({ images: [] }), 'ru', EMPTY).cover).toEqual([])
  })

  it('границы этажей считаются по списку — этаж фильтруется диапазоном', () => {
    const dto = buildPlanTypeDTO(planType(), 'ru', EMPTY)
    expect(dto.floorMin).toBe(3)
    expect(dto.floorMax).toBe(16)
  })

  it('без этажей границы пустые, а не нули', () => {
    const dto = buildPlanTypeDTO(planType({ floors: [] }), 'ru', EMPTY)
    expect(dto.floorMin).toBeNull()
    expect(dto.floorMax).toBeNull()
  })
})
