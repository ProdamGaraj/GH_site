/**
 * Дом — единица MacroCRM, проект — объединение домов.
 *
 *  - срок сдачи дома: ручной главнее, иначе из CRM на языке страницы;
 *  - каталог на главной: проект одной карточкой (как было) или карточками
 *    своих домов — своё поле дома главнее, пустое берётся из проекта;
 *  - схемы: ID дома из CRM, карточка дома, режим каталога проекта.
 */
import {
  buildCatalogItems,
  buildComplexDetail,
  ComplexRow,
  formatServiceDate,
  houseDeadline,
  HouseRow,
  TrRow,
} from '../services/i18n'
import { createHouseSchema, updateComplexSchema } from '../schemas/estate.schema'
import { syncHouseSchema } from '../schemas/sync.schema'

const complex = {
  id: 'c1',
  slug: 'assalom-dostlik',
  order: 1,
  status: 'active',
  name: 'Assalom Doʼstlik',
  className: 'Комфорт+',
  intro: 'Проект: общий текст',
  media: '/media/about.jpg',
  heroImages: [],
  filterClass: 'comfort',
  cardImage: '/media/project-card.jpg',
  cardTags: ['Рассрочка'],
  catalogMode: 'houses',
} as unknown as ComplexRow

function house(over: Partial<HouseRow> = {}): HouseRow {
  return {
    id: 'h1',
    complexId: 'c1',
    order: 0,
    name: '',
    floors: '16',
    deadline: '',
    className: '',
    showOnSite: true,
    status: 'active',
    intro: '',
    cardImage: '',
    cardTags: [],
    filterClass: '',
    ...over,
  }
}

describe('formatServiceDate — срок из CRM на языке страницы', () => {
  it('квартал по месяцу', () => {
    expect(formatServiceDate(2028, 5, 'ru')).toBe('2 кв. 2028')
    expect(formatServiceDate(2028, 5, 'uz')).toBe('2028-yil 2-chorak')
    expect(formatServiceDate(2028, 5, 'en')).toBe('Q2 2028')
    expect(formatServiceDate(2028, 12, 'ru')).toBe('4 кв. 2028')
    expect(formatServiceDate(2028, 1, 'ru')).toBe('1 кв. 2028')
  })

  it('без месяца — только год; без года — пусто', () => {
    expect(formatServiceDate(2029, null, 'ru')).toBe('2029')
    expect(formatServiceDate(2029, null, 'uz')).toBe('2029-yil')
    expect(formatServiceDate(null, 5, 'ru')).toBe('')
    expect(formatServiceDate(2029, 13, 'en')).toBe('2029')
  })

  it('ручной срок главнее срока из CRM', () => {
    const crm = { crmServiceYear: 2028, crmServiceMonth: 5 }
    expect(houseDeadline({ deadline: 'Сдан' }, crm, 'ru')).toBe('Сдан')
    expect(houseDeadline({ deadline: '  ' }, crm, 'uz')).toBe('2028-yil 2-chorak')
    expect(houseDeadline({}, {}, 'ru')).toBe('')
  })
})

describe('buildComplexDetail — срок дома доходит до карточек планировок', () => {
  const plan = {
    id: 'p1', houseId: 'h1', signature: 's', planName: 'A', images: [], panoUrl: '', rooms: 2, isStudio: false,
    areaMin: 55, areaMax: 55, priceMin: 1, priceMax: 2, apartmentsCount: 1, floors: [2], entrances: [1],
    windowViews: [], order: 0,
  }

  it('из CRM на языке страницы, в карточке и в чипсах фильтра', () => {
    const dto = buildComplexDetail(complex, [house({ crmServiceYear: 2028, crmServiceMonth: 5 })], [], [], 'uz', [plan])
    expect(dto.houses[0].deadline).toBe('2028-yil 2-chorak')
    expect(dto.planTypes[0].deadline).toBe('2028-yil 2-chorak')
    expect(dto.deadlines).toEqual(['2028-yil 2-chorak'])
  })

  it('ручной — главнее, с переводом', () => {
    const tr: TrRow[] = [{ entityType: 'house', entityId: 'h1', locale: 'uz', field: 'deadline', value: 'Topshirilgan' }]
    const h = house({ deadline: 'Сдан', crmServiceYear: 2028, crmServiceMonth: 5 })
    expect(buildComplexDetail(complex, [h], [], tr, 'uz', [plan]).planTypes[0].deadline).toBe('Topshirilgan')
    expect(buildComplexDetail(complex, [h], [], [], 'ru', [plan]).planTypes[0].deadline).toBe('Сдан')
  })
})

describe('buildCatalogItems — проект или его дома на главной', () => {
  const houses = [
    house({ id: 'h2', order: 1, name: 'Дустлик-4', externalId: 5622025, intro: 'Свой текст', cardTags: ['Акция'] }),
    house({ id: 'h1', order: 0, name: 'Дустлик-1', externalId: 5000001, status: 'sold_out' }),
    house({ id: 'h3', order: 2, name: 'Дустлик-5', showOnSite: false }),
  ]

  it('режим «проектом» — одна карточка проекта, как было', () => {
    const items = buildCatalogItems({ ...complex, catalogMode: 'project' } as ComplexRow, houses, [], 'ru')
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ kind: 'project', houseId: null, name: 'Assalom Doʼstlik' })
  })

  it('без режима (старые данные) — тоже проектом', () => {
    const items = buildCatalogItems({ ...complex, catalogMode: undefined } as ComplexRow, houses, [], 'ru')
    expect(items.map((i) => i.kind)).toEqual(['project'])
  })

  it('режим «домами» — по карточке на дом с галочкой, по порядку домов', () => {
    const items = buildCatalogItems(complex, houses, [], 'ru')
    expect(items.map((i) => [i.kind, i.houseId, i.name])).toEqual([
      ['house', 'h1', 'Дустлик-1'],
      ['house', 'h2', 'Дустлик-4'],
    ])
    // Ссылка — на страницу проекта.
    expect(items.every((i) => i.slug === 'assalom-dostlik')).toBe(true)
    expect(items[1].externalHouseId).toBe(5622025)
  })

  it('своё поле дома главнее, пустое — из проекта', () => {
    const [first, second] = buildCatalogItems(complex, houses, [], 'ru')
    expect(second).toMatchObject({ intro: 'Свой текст', tags: ['Акция'] })
    expect(first).toMatchObject({
      intro: 'Проект: общий текст',
      tags: ['Рассрочка'],
      cardImage: '/media/project-card.jpg',
      filterClass: 'comfort',
      className: 'Комфорт+',
    })
  })

  it('распроданный дом — «Распродано» только у него', () => {
    const [sold, selling] = buildCatalogItems(complex, houses, [], 'uz')
    expect(sold).toMatchObject({ status: 'sold_out', soldOut: [{ label: 'Sotilgan' }], cardClass: 'is-sold-visible' })
    expect(selling).toMatchObject({ soldOut: [], cardClass: '' })
  })

  it('распродан проект — распроданы все его дома', () => {
    const items = buildCatalogItems({ ...complex, status: 'sold_out' } as ComplexRow, houses, [], 'ru')
    expect(items.every((i) => i.soldOut.length === 1)).toBe(true)
  })

  it('тексты дома переводятся; нет перевода — ru дома, потом проект', () => {
    const tr: TrRow[] = [
      { entityType: 'house', entityId: 'h2', locale: 'uz', field: 'name', value: 'Doʼstlik-4' },
      { entityType: 'house', entityId: 'h2', locale: 'uz', field: 'cardTags', value: '["Aksiya"]' },
      { entityType: 'complex', entityId: 'c1', locale: 'uz', field: 'intro', value: 'Loyiha matni' },
    ]
    const [first, second] = buildCatalogItems(complex, houses, tr, 'uz')
    expect(second).toMatchObject({ name: 'Doʼstlik-4', tags: ['Aksiya'], intro: 'Свой текст' })
    expect(first).toMatchObject({ name: 'Дустлик-1', intro: 'Loyiha matni' })
  })

  it('ни одного дома на сайте — карточек нет', () => {
    expect(buildCatalogItems(complex, [house({ showOnSite: false })], [], 'ru')).toEqual([])
  })

  it('дома чужого проекта не попадают', () => {
    expect(buildCatalogItems(complex, [house({ complexId: 'other' })], [], 'ru')).toEqual([])
  })
})

describe('схемы', () => {
  it('дом: ID из CRM, карточка, класс фильтра «как у проекта»', () => {
    expect(
      createHouseSchema.safeParse({
        externalId: 5622025,
        name: 'Дустлик-4',
        showOnSite: true,
        status: 'sold_out',
        intro: 'x',
        cardImage: '/media/a.jpg',
        cardTags: ['Акция'],
        filterClass: '',
      }).success
    ).toBe(true)
    expect(createHouseSchema.safeParse({ externalId: -1 }).success).toBe(false)
    expect(createHouseSchema.safeParse({ status: 'gone' }).success).toBe(false)
    expect(createHouseSchema.safeParse({ filterClass: 'lux' }).success).toBe(false)
  })

  it('проект: режим каталога', () => {
    expect(updateComplexSchema.safeParse({ catalogMode: 'houses' }).success).toBe(true)
    expect(updateComplexSchema.safeParse({ catalogMode: 'rooms' }).success).toBe(false)
  })

  it('синхронизация: срок из CRM — есть, null или не спрашивали', () => {
    const base = { externalHouseId: 1, planTypes: [], apartments: [] }
    const withDate = syncHouseSchema.parse({ ...base, house: { inServiceYear: 2028, inServiceMonth: 5 } })
    expect(withDate.house).toMatchObject({ inServiceYear: 2028, inServiceMonth: 5 })
    expect(syncHouseSchema.parse({ ...base, house: { inServiceYear: null } }).house.inServiceYear).toBeNull()
    expect(syncHouseSchema.parse(base).house.inServiceYear).toBeUndefined()
    expect(syncHouseSchema.safeParse({ ...base, house: { inServiceMonth: 13 } }).success).toBe(false)
  })
})
