/**
 * Дом — единица MacroCRM, проект — объединение домов.
 *
 *  - срок сдачи дома: ручной главнее, иначе из CRM на языке страницы;
 *  - дом полей проекта не меняет: страница и карточка на главной — только у
 *    проекта, у дома нет ни полей карточки, ни своих переводов карточки;
 *  - схемы: ID дома из CRM, срок из CRM в синхронизации.
 */
import {
  buildComplexDetail,
  ComplexRow,
  formatServiceDate,
  HOUSE_TR_FIELDS,
  houseDeadline,
  HouseRow,
  TrRow,
} from '../services/i18n'
import { createHouseSchema, updateComplexSchema, updateHouseSchema } from '../schemas/estate.schema'
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

  it('тексты страницы — всегда проекта, даже если у дома есть переводы', () => {
    const tr: TrRow[] = [
      { entityType: 'house', entityId: 'h1', locale: 'uz', field: 'intro', value: 'Uy matni' },
      { entityType: 'complex', entityId: 'c1', locale: 'uz', field: 'intro', value: 'Loyiha matni' },
    ]
    expect(buildComplexDetail(complex, [house()], [], tr, 'uz', [plan]).intro).toBe('Loyiha matni')
  })
})

describe('дом не меняет полей проекта', () => {
  it('переводимые поля дома — только его собственные', () => {
    expect(Object.keys(HOUSE_TR_FIELDS).sort()).toEqual(['className', 'deadline', 'floors', 'name'])
  })

  it('поля карточки дома схема отбрасывает — сохранить их нельзя', () => {
    const card = {
      showOnSite: false,
      status: 'sold_out',
      intro: 'x',
      cardImage: '/media/a.jpg',
      cardTags: ['Акция'],
      filterClass: 'premium',
      slug: 'dom-4',
      content: { about: 'x' },
    }
    const created = createHouseSchema.parse({ externalId: 5622025, name: 'Дустлик-4', ...card })
    expect(created).toEqual({ externalId: 5622025, name: 'Дустлик-4' })
    expect(updateHouseSchema.parse(card)).toEqual({})
  })

  it('режима «на главной домами» у проекта нет', () => {
    expect(updateComplexSchema.parse({ catalogMode: 'houses' })).toEqual({})
  })
})

describe('схемы', () => {
  it('дом: ID из CRM — положительное целое или null', () => {
    expect(createHouseSchema.safeParse({ externalId: 5622025, name: 'Дустлик-4' }).success).toBe(true)
    expect(createHouseSchema.safeParse({ externalId: null }).success).toBe(true)
    expect(createHouseSchema.safeParse({ externalId: -1 }).success).toBe(false)
    expect(createHouseSchema.safeParse({ externalId: 1.5 }).success).toBe(false)
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
