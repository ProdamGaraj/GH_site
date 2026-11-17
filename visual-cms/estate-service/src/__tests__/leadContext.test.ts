/**
 * Контекст заявки: проект по адресу страницы, планировка по id карточки.
 *
 * Важное: данные берутся из каталога, а не из браузера; карточка — склеенная
 * группа, поэтому дома и квартиры собираются по всем типам группы.
 */
import {
  buildLeadContext,
  buildPlanContext,
  complexForPath,
  pathSegments,
  EMPTY_LEAD_CONTEXT,
  type LeadApartmentRow,
  type LeadComplexRow,
  type LeadHouseRow,
} from '../services/leadContext'
import type { PlanTypeRow } from '../services/i18n'

function plan(over: Partial<PlanTypeRow> = {}): PlanTypeRow {
  return {
    id: 'p1',
    houseId: 'h1',
    signature: 's',
    planName: '13',
    images: [],
    panoUrl: '',
    rooms: 2,
    isStudio: false,
    areaMin: 54.6,
    areaMax: 54.6,
    apartmentsCount: 1,
    floors: [2, 3],
    entrances: [1],
    windowViews: [],
    order: 0,
    ...over,
  }
}

function apt(over: Partial<LeadApartmentRow> = {}): LeadApartmentRow {
  return { houseId: 'h1', planTypeId: 'p1', externalId: 501, status: 'available', price: '700000000', ...over }
}

const dostlik: LeadComplexRow = { id: 'c1', slug: 'assalom-dostlik', name: "Assalom Do'stlik", planGrouping: null }
const houses: LeadHouseRow[] = [
  { id: 'h1', complexId: 'c1', externalId: 11 },
  { id: 'h2', complexId: 'c1', externalId: 12 },
  { id: 'h3', complexId: 'c1', externalId: null },
  { id: 'hx', complexId: 'other', externalId: 99 },
]

describe('pathSegments / complexForPath', () => {
  it('разбирает путь без языка, .html, query и регистра', () => {
    expect(pathSegments('/ru/Complex/assalom-dostlik/index.html?utm=1#lead')).toEqual([
      'ru', 'complex', 'assalom-dostlik', 'index',
    ])
  })

  it('находит проект по сегменту пути, а не по подстроке', () => {
    const list = [{ slug: 'ozmakon' }, { slug: 'ozmakon-business' }]
    expect(complexForPath('/uz/complex/ozmakon-business/', list)?.slug).toBe('ozmakon-business')
    expect(complexForPath('/complex/ozmakon/', list)?.slug).toBe('ozmakon')
    expect(complexForPath('/ozmakon-businessx/', list)).toBeNull()
  })

  it('главная и прочие страницы — без проекта', () => {
    expect(complexForPath('/', [dostlik])).toBeNull()
    expect(complexForPath('', [dostlik])).toBeNull()
    expect(complexForPath('/ru/contacts/', [dostlik])).toBeNull()
  })
})

describe('buildLeadContext', () => {
  it('без проекта — пустой контекст', () => {
    expect(buildLeadContext(null, houses, [], [])).toEqual(EMPTY_LEAD_CONTEXT)
  })

  it('проект: только его дома с id CRM, без пустых и чужих, по возрастанию', () => {
    const ctx = buildLeadContext(dostlik, houses, [], [])
    expect(ctx.complex).toEqual({ slug: 'assalom-dostlik', name: "Assalom Do'stlik" })
    expect(ctx.houseExternalIds).toEqual([11, 12])
    expect(ctx.plan).toBeNull()
  })

  it('неизвестная карточка — проект есть, планировки нет', () => {
    const ctx = buildLeadContext(dostlik, houses, [plan()], [apt()], 'nope')
    expect(ctx.houseExternalIds).toEqual([11, 12])
    expect(ctx.plan).toBeNull()
  })

  it('чужая планировка (другой проект) не находится', () => {
    const foreign = plan({ id: 'px', houseId: 'hx' })
    expect(buildLeadContext(dostlik, houses, [foreign], [], 'px').plan).toBeNull()
  })
})

describe('buildPlanContext', () => {
  it('одна планировка: комнаты, площадь, этажи, цена и объекты в продаже', () => {
    const ctx = buildPlanContext('p1', dostlik, houses, [plan()], [
      apt({ externalId: 501, price: 700000000 }),
      apt({ externalId: 502, price: '650000000' }),
      apt({ externalId: 503, status: 'reserved', price: 1 }),
    ])
    expect(ctx).toEqual({
      id: 'p1',
      planName: '13',
      rooms: 2,
      isStudio: false,
      area: { min: 54.6, max: 54.6 },
      price: { min: 650000000, max: 700000000 },
      floors: [2, 3],
      houseExternalIds: [11],
      onSaleExternalIds: [501, 502],
    })
  })

  it('склеенная группа: дома и квартиры всех типов, id — главного типа', () => {
    const rows = [
      plan({ id: 'p1', houseId: 'h1', planName: '13', order: 0, areaMin: 54.6, areaMax: 54.6 }),
      plan({ id: 'p2', houseId: 'h2', planName: '3_13', order: 1, areaMin: 54.62, areaMax: 54.62, floors: [7] }),
    ]
    // Ручная склейка через дома: карточка одна, домов у неё два.
    const grouped: LeadComplexRow = { ...dostlik, planGrouping: { groups: [{ plans: ['13', '3_13'] }] } }
    const ctx = buildPlanContext('p2', grouped, houses, rows, [
      apt({ planTypeId: 'p1', houseId: 'h1', externalId: 501 }),
      apt({ planTypeId: 'p2', houseId: 'h2', externalId: 601, price: 800000000 }),
    ])
    expect(ctx?.id).toBe('p1')
    expect(ctx?.houseExternalIds).toEqual([11, 12])
    expect(ctx?.onSaleExternalIds).toEqual([501, 601])
    expect(ctx?.area).toEqual({ min: 54.6, max: 54.62 })
    expect(ctx?.floors).toEqual([2, 3, 7])
  })

  it('нет свободных квартир или цен — цена null, объектов нет', () => {
    const ctx = buildPlanContext('p1', dostlik, houses, [plan()], [
      apt({ status: 'sold' }),
      apt({ price: 0, externalId: null }),
    ])
    expect(ctx?.price).toBeNull()
    expect(ctx?.onSaleExternalIds).toEqual([])
  })

  it('нулевая площадь — null, а не диапазон 0–0', () => {
    expect(buildPlanContext('p1', dostlik, houses, [plan({ areaMin: 0, areaMax: '0' })], [])?.area).toBeNull()
  })

  it('пустой id — null', () => {
    expect(buildPlanContext('', dostlik, houses, [plan()], [])).toBeNull()
  })
})
