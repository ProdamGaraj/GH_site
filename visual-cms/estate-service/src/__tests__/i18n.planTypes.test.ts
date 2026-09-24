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
  formatEntrances,
  indexTranslations,
  PLANTYPE_TR_FIELDS,
  translateViews,
  type PlanTypeRow,
  type ComplexRow,
  type TrRow,
} from '../services/i18n'

const EMPTY = new Map<string, string>()

function planType(over: Partial<PlanTypeRow> = {}): PlanTypeRow {
  return {
    id: 'plan-1',
    houseId: 'h1',
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
    expect(dto.title).toBe('2-комн. от 55.64 м²')
    expect(dto.areaLabel).toBe('55.64 – 56.12 м²')
    expect(dto.priceLabel).toBe('от 1 153 779 562 UZS')
    expect(dto.countLabel).toBe('12 квартир')
    expect(dto.floorsLabel).toBe('этажи 3–16')
  })

  it('заголовок: одна площадь — как есть, диапазон — «от» меньшей', () => {
    const single = planType({ areaMin: '42.24', areaMax: '42.24' })
    expect(buildPlanTypeDTO(single, 'ru', EMPTY).title).toBe('2-комн. 42.24 м²')
    // Склеенная карточка 36.76–37.87: максимум в заголовке обещал бы площадь,
    // которой у большинства вариантов нет.
    const merged = planType({ rooms: 1, areaMin: 36.76, areaMax: 37.87 })
    expect(buildPlanTypeDTO(merged, 'ru', EMPTY).title).toBe('1-комн. от 36.76 м²')
    expect(buildPlanTypeDTO(merged, 'uz', EMPTY).title).toBe('1 xonali 36.76 m² dan')
    expect(buildPlanTypeDTO(merged, 'en', EMPTY).title).toBe('1-room from 36.76 m²')
  })

  it('заголовок: разница меньше сотой диапазоном не считается', () => {
    const almost = planType({ areaMin: '42.240', areaMax: '42.24' })
    expect(buildPlanTypeDTO(almost, 'ru', EMPTY).title).toBe('2-комн. 42.24 м²')
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

describe('formatEntrances — подпись, различающая зеркальные варианты', () => {
  // У одной площади бывает семь типов: CRM отдаёт свой чертёж на каждое
  // положение квартиры на этаже. Заголовок, площадь, цена и этажи у них
  // совпадают, и в каталоге карточки выглядели неразличимо.
  it('один подъезд — единственное число', () => {
    expect(formatEntrances([1], 'ru')).toBe('подъезд 1')
    expect(formatEntrances([3], 'uz')).toBe('kirish 3')
    expect(formatEntrances([2], 'en')).toBe('entrance 2')
  })

  it('несколько подъездов — множественное и по возрастанию', () => {
    expect(formatEntrances([3, 1], 'ru')).toBe('подъезды 1, 3')
    expect(formatEntrances([2, 1], 'uz')).toBe('kirishlar 1, 2')
  })

  it('повторы схлопываются', () => {
    expect(formatEntrances([1, 1, 3], 'ru')).toBe('подъезды 1, 3')
  })

  it('пусто — пустая строка, узел в шаблоне не рисуется', () => {
    expect(formatEntrances([], 'ru')).toBe('')
    expect(formatEntrances(undefined as unknown as number[], 'ru')).toBe('')
  })

  it('попадает в DTO типа планировки', () => {
    const dto = buildPlanTypeDTO(planType({ entrances: [1, 3] }), 'ru', EMPTY)
    expect(dto.entranceLabel).toBe('подъезды 1, 3')
  })
})

describe('виды из окна: словарь ЖК', () => {
  // CRM отдаёт виды по-русски; на узбекской странице чипсы и карточки
  // показывали «двор» и «бульвар» кириллицей.
  const UZ_LABELS = { двор: 'hovli', бульвар: 'bulvar', 'двор блока-1': 'hovli' }
  const tr = (value: unknown): TrRow => ({
    entityType: 'complex',
    entityId: 'c1',
    locale: 'uz',
    field: 'windowViewLabels',
    value: JSON.stringify(value),
  })
  const plans = [
    planType({ id: 'a', windowViews: ['двор', 'бульвар'], order: 0 }),
    planType({ id: 'b', windowViews: ['двор блока-1', 'ТРЦ Альфраганус'], areaMin: 70, areaMax: 70, order: 1 }),
  ]

  it('translateViews: перевод по словарю, без перевода — как есть', () => {
    expect(translateViews(['двор', 'ТРЦ'], UZ_LABELS)).toEqual(['hovli', 'ТРЦ'])
  })

  it('translateViews: одинаковые переводы не дублируются', () => {
    expect(translateViews(['двор', 'двор блока-1'], UZ_LABELS)).toEqual(['hovli'])
  })

  it('translateViews: пустой перевод и не-строка — фолбэк на ru', () => {
    expect(translateViews(['двор'], { двор: '  ' })).toEqual(['двор'])
    expect(translateViews(['двор'], { двор: 5 })).toEqual(['двор'])
    expect(translateViews(['двор'], null)).toEqual(['двор'])
  })

  it('на uz карточки и чипсы переводятся одним словарём — фильтр находит карточки', () => {
    const dto = buildComplexDetail(baseComplex, [], [], [tr(UZ_LABELS)], 'uz', plans)
    expect(dto.planTypes[0].windowViews).toEqual(['hovli', 'bulvar'])
    expect(dto.planTypes[0].windowViewsAttr).toBe('hovli|bulvar')
    expect(dto.planTypes[1].windowViewsAttr).toBe('hovli|ТРЦ Альфраганус')
    expect(dto.planViews).toEqual(['hovli', 'bulvar', 'ТРЦ Альфраганус'])
    for (const chip of dto.planViews) {
      expect(dto.planTypes.some((p) => p.windowViews.includes(chip))).toBe(true)
    }
  })

  it('на ru словарь не применяется', () => {
    const dto = buildComplexDetail(baseComplex, [], [], [tr(UZ_LABELS)], 'ru', plans)
    expect(dto.planViews).toEqual(['двор', 'бульвар', 'двор блока-1', 'ТРЦ Альфраганус'])
  })

  it('перевод конкретного типа важнее словаря ЖК', () => {
    const own: TrRow = {
      entityType: 'planType',
      entityId: 'a',
      locale: 'uz',
      field: 'windowViews',
      value: JSON.stringify(['ichki hovli']),
    }
    const dto = buildComplexDetail(baseComplex, [], [], [tr(UZ_LABELS), own], 'uz', plans)
    expect(dto.planTypes[0].windowViews).toEqual(['ichki hovli'])
  })

  it('битый JSON словаря не роняет страницу', () => {
    const broken: TrRow = { ...tr({}), value: '{не json' }
    const dto = buildComplexDetail(baseComplex, [], [], [broken], 'uz', plans)
    expect(dto.planTypes[0].windowViews).toEqual(['двор', 'бульвар'])
  })
})
