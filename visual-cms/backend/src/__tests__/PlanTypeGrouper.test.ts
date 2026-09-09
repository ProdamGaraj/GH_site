/**
 * Группировка планировок.
 *
 * Ключевая проверка здесь — устойчивость ключа к смене подписи в URL. Ссылки
 * Macro истекают, и если ключ поедет вместе с ними, каждый прогон синка создаст
 * новые типы вместо обновления прежних: upsert перестанет находить строки,
 * а переводы, привязанные к id типа, осиротеют.
 */
import {
  groupPlanTypes,
  buildSignature,
  stableFileKey,
  filesKey,
  selectProbeTargets,
  type PlanProbe,
} from '../services/PlanTypeGrouper'
import { mapApartments } from '../services/MacroEstateMapper'
import type { MacroFlatPlan } from '../services/MacroSellClient'
import type { ApartmentPayload } from '../services/MacroEstateMapper'

const FIXTURE = require('./fixtures/macro/02-apartments.json')

/** Ссылка из живого ответа: подпись с хвостом-сроком годности. */
const REAL_URL =
  'https://macrocrm.gh.uz/estate/files/tmp/5139395/3707992/xjAwXYqCdzd_YSoimFKalQeyJlIjoxNzg5MTI4MDAwfQ/planirovka_k2-54_65-6-56.12.jpg'
/** Та же картинка после перевыпуска подписи: id файла и имя не изменились. */
const REAL_URL_RESIGNED =
  'https://macrocrm.gh.uz/estate/files/tmp/5139395/3707992/ZZZZZZZZZZZZ_QQQQQQQQQQeyJlIjoxOTk5OTk5OTk5fQ/planirovka_k2-54_65-6-56.12.jpg'

function plan(planName: string, urls: string[]): MacroFlatPlan {
  return {
    estateId: 1,
    planName,
    files: urls.map((url) => ({ title: 'Main image', url, thumbUrl: '' })),
  }
}

function apartment(over: Partial<ApartmentPayload> = {}): ApartmentPayload {
  return {
    externalId: 1,
    externalHouseId: 5139395,
    rooms: 2,
    areaM2: 56.12,
    price: 1153779562,
    oldPrice: null,
    entrance: 1,
    floorNumber: 12,
    floor: '12/15',
    number: '74',
    isStudio: false,
    windowView: 'двор',
    panoUrl: '',
    status: 'available',
    dateModified: '2026-08-19T12:58:58.000Z',
    ...over,
  }
}

describe('стабильный ключ файла', () => {
  it('берёт id файла и имя, отбрасывая подпись', () => {
    expect(stableFileKey(REAL_URL)).toBe('3707992/planirovka_k2-54_65-6-56.12.jpg')
  })

  it('переподписанная ссылка даёт тот же ключ', () => {
    expect(stableFileKey(REAL_URL_RESIGNED)).toBe(stableFileKey(REAL_URL))
  })

  it('query-строка в ключ не входит', () => {
    expect(stableFileKey(REAL_URL + '?v=2')).toBe(stableFileKey(REAL_URL))
  })

  it('незнакомый формат откатывается на имя файла, а не падает', () => {
    expect(stableFileKey('https://cdn.example/plans/abc.jpg')).toBe('abc.jpg')
  })

  it('ссылка без пути не роняет разбор', () => {
    expect(stableFileKey('https://cdn.example')).toBe('cdn.example')
  })

  it('порядок файлов на ключ набора не влияет', () => {
    const files = (urls: string[]) => urls.map((url) => ({ title: '', url, thumbUrl: '' }))
    expect(filesKey(files(['https://a/1/x.jpg', 'https://a/2/y.jpg'])))
      .toBe(filesKey(files(['https://a/2/y.jpg', 'https://a/1/x.jpg'])))
  })

  it('пустой набор файлов имеет свой ключ, а не пустую строку', () => {
    expect(filesKey([])).toBe('nofiles')
  })
})

describe('подпись типа', () => {
  it('переживает перевыпуск ссылок — иначе синк плодил бы новые типы', () => {
    expect(buildSignature(plan('К2-54.65-6', [REAL_URL])))
      .toBe(buildSignature(plan('К2-54.65-6', [REAL_URL_RESIGNED])))
  })

  it('разные наборы файлов при одном имени дают разные подписи', () => {
    const a = buildSignature(plan('К2-54.65-6', ['https://a/1/x.jpg']))
    const b = buildSignature(plan('К2-54.65-6', ['https://a/2/y.jpg']))
    expect(a).not.toBe(b)
  })

  it('разные имена при одном наборе файлов тоже расходятся', () => {
    const a = buildSignature(plan('К2-54.65-6', [REAL_URL]))
    const b = buildSignature(plan('К2-60.00-1', [REAL_URL]))
    expect(a).not.toBe(b)
  })

  it('планировка без имени получает подпись, а не пустую строку', () => {
    expect(buildSignature(plan('', [REAL_URL]))).toMatch(/^unnamed\|/)
  })

  it('подпись не длиннее колонки в базе', () => {
    const long = buildSignature(plan('П'.repeat(500), [REAL_URL]))
    expect(long.length).toBeLessThanOrEqual(200)
  })
})

describe('группировка', () => {
  const PLAN_A = plan('К2-54.65-6', [REAL_URL])
  const PLAN_B = plan('К1-40.00-2', ['https://a/999/other.jpg'])

  it('квартиры с одной планировкой собираются в один тип', () => {
    const flats = [
      apartment({ externalId: 1, floorNumber: 3 }),
      apartment({ externalId: 2, floorNumber: 7 }),
      apartment({ externalId: 3, floorNumber: 11 }),
    ]
    const probes: PlanProbe[] = flats.map((f) => ({ estateId: f.externalId, plan: PLAN_A }))
    const { planTypes, unassigned } = groupPlanTypes(flats, probes)

    expect(planTypes).toHaveLength(1)
    expect(planTypes[0].apartmentsCount).toBe(3)
    expect(planTypes[0].floors).toEqual([3, 7, 11])
    expect(unassigned).toHaveLength(0)
  })

  it('площадь становится диапазоном, а не одним числом', () => {
    const flats = [
      apartment({ externalId: 1, areaM2: 55.64 }),
      apartment({ externalId: 2, areaM2: 56.12 }),
    ]
    const { planTypes } = groupPlanTypes(
      flats,
      flats.map((f) => ({ estateId: f.externalId, plan: PLAN_A }))
    )
    expect(planTypes[0].areaMin).toBe(55.64)
    expect(planTypes[0].areaMax).toBe(56.12)
  })

  it('цены сводятся в диапазон, нулевые в него не попадают', () => {
    const flats = [
      apartment({ externalId: 1, price: 1000 }),
      apartment({ externalId: 2, price: 3000 }),
      apartment({ externalId: 3, price: 0 }),
    ]
    const { planTypes } = groupPlanTypes(
      flats,
      flats.map((f) => ({ estateId: f.externalId, plan: PLAN_A }))
    )
    expect(planTypes[0].priceMin).toBe(1000)
    expect(planTypes[0].priceMax).toBe(3000)
  })

  it('один и тот же planName в разных домах — разные типы', () => {
    const flats = [
      apartment({ externalId: 1, externalHouseId: 5139395 }),
      apartment({ externalId: 2, externalHouseId: 5622025 }),
    ]
    const { planTypes } = groupPlanTypes(
      flats,
      flats.map((f) => ({ estateId: f.externalId, plan: PLAN_A }))
    )
    expect(planTypes).toHaveLength(2)
  })

  it('квартиры без планировки уходят в unassigned, а не теряются', () => {
    const flats = [apartment({ externalId: 1 }), apartment({ externalId: 2 })]
    const { planTypes, unassigned } = groupPlanTypes(flats, [
      { estateId: 1, plan: PLAN_A },
      { estateId: 2, plan: null },
    ])
    expect(planTypes).toHaveLength(1)
    expect(unassigned.map((a) => a.externalId)).toEqual([2])
  })

  it('тур берётся у той квартиры, где он есть', () => {
    const flats = [
      apartment({ externalId: 1, panoUrl: '' }),
      apartment({ externalId: 2, panoUrl: 'https://tour/x' }),
    ]
    const { planTypes } = groupPlanTypes(
      flats,
      flats.map((f) => ({ estateId: f.externalId, plan: PLAN_A }))
    )
    expect(planTypes[0].panoUrl).toBe('https://tour/x')
  })

  it('виды из окон собираются без повторов и без пустых', () => {
    const flats = [
      apartment({ externalId: 1, windowView: 'двор' }),
      apartment({ externalId: 2, windowView: 'двор' }),
      apartment({ externalId: 3, windowView: 'бульвар' }),
      apartment({ externalId: 4, windowView: '' }),
    ]
    const { planTypes } = groupPlanTypes(
      flats,
      flats.map((f) => ({ estateId: f.externalId, plan: PLAN_A }))
    )
    expect(planTypes[0].windowViews).toEqual(['бульвар', 'двор'])
  })

  it('порядок — по комнатности, затем по площади, а не по имени', () => {
    const flats = [
      apartment({ externalId: 1, rooms: 3, areaM2: 80 }),
      apartment({ externalId: 2, rooms: 1, areaM2: 40 }),
      apartment({ externalId: 3, rooms: 2, areaM2: 56 }),
    ]
    const probes: PlanProbe[] = [
      { estateId: 1, plan: plan('Я-последняя', ['https://a/1/a.jpg']) },
      { estateId: 2, plan: plan('А-первая', ['https://a/2/b.jpg']) },
      { estateId: 3, plan: plan('Б-вторая', ['https://a/3/c.jpg']) },
    ]
    const { planTypes } = groupPlanTypes(flats, probes)
    expect(planTypes.map((p) => p.rooms)).toEqual([1, 2, 3])
    expect(planTypes.map((p) => p.order)).toEqual([0, 1, 2])
  })

  it('пустой вход даёт пустой результат, а не падение', () => {
    expect(groupPlanTypes([], [])).toEqual({ planTypes: [], unassigned: [] })
  })

  it('id квартир типа возвращаются — по ним проставляется planTypeId', () => {
    const flats = [apartment({ externalId: 7 }), apartment({ externalId: 3 })]
    const { planTypes } = groupPlanTypes(
      flats,
      flats.map((f) => ({ estateId: f.externalId, plan: PLAN_A }))
    )
    expect(planTypes[0].apartmentExternalIds).toEqual([3, 7])
  })

  it('две разные планировки не сливаются', () => {
    const flats = [apartment({ externalId: 1 }), apartment({ externalId: 2 })]
    const { planTypes } = groupPlanTypes(flats, [
      { estateId: 1, plan: PLAN_A },
      { estateId: 2, plan: PLAN_B },
    ])
    expect(planTypes).toHaveLength(2)
  })
})

describe('на живой выдаче', () => {
  it('сто квартир с одной планировкой на площадь дают ожидаемое число типов', () => {
    const { apartments } = mapApartments(FIXTURE, { floorsCount: 15 })
    // Худший случай: каждая уникальная пара (комнатность, площадь) — свой тип.
    const probes: PlanProbe[] = apartments.map((a) => ({
      estateId: a.externalId,
      plan: plan(`План-${a.rooms}-${a.areaM2}`, [`https://a/${a.rooms}${a.areaM2}/p.jpg`]),
    }))
    const { planTypes, unassigned } = groupPlanTypes(apartments, probes)

    expect(unassigned).toHaveLength(0)
    expect(planTypes.length).toBe(57)
    // Ни одна квартира не потерялась при группировке.
    const total = planTypes.reduce((sum, p) => sum + p.apartmentsCount, 0)
    expect(total).toBe(100)
  })

  it('когда planName группирует крупнее, типов становится меньше квартир', () => {
    const { apartments } = mapApartments(FIXTURE, { floorsCount: 15 })
    // Оптимистичный случай: планировка одна на комнатность.
    const probes: PlanProbe[] = apartments.map((a) => ({
      estateId: a.externalId,
      plan: plan(`План-${a.rooms}к`, [`https://a/${a.rooms}/p.jpg`]),
    }))
    const { planTypes } = groupPlanTypes(apartments, probes)

    expect(planTypes.length).toBe(new Set(apartments.map((a) => a.rooms)).size)
    for (const planType of planTypes) {
      expect(planType.areaMax).toBeGreaterThanOrEqual(planType.areaMin)
      expect(planType.floors.length).toBeGreaterThan(0)
    }
  })
})

describe('отбор квартир на опрос', () => {
  const flats = [
    apartment({ externalId: 1, dateModified: '2026-08-19T12:58:58.000Z' }),
    apartment({ externalId: 2, dateModified: '2026-08-19T12:58:58.000Z' }),
  ]

  it('первый прогон опрашивает всех', () => {
    expect(selectProbeTargets(flats, [])).toHaveLength(2)
  })

  it('второй прогон без изменений не стоит ни одного вызова', () => {
    const known = flats.map((f) => ({
      externalId: f.externalId,
      dateModified: f.dateModified,
      probedAt: '2026-09-01T00:00:00.000Z',
    }))
    expect(selectProbeTargets(flats, known)).toHaveLength(0)
  })

  it('изменившаяся в CRM квартира опрашивается заново', () => {
    const known = [
      { externalId: 1, dateModified: '2026-01-01T00:00:00.000Z', probedAt: '2026-09-01T00:00:00.000Z' },
      { externalId: 2, dateModified: flats[1].dateModified, probedAt: '2026-09-01T00:00:00.000Z' },
    ]
    expect(selectProbeTargets(flats, known).map((a) => a.externalId)).toEqual([1])
  })

  it('ни разу не опрошенная квартира опрашивается, даже если дата не менялась', () => {
    const known = [
      { externalId: 1, dateModified: flats[0].dateModified, probedAt: null },
      { externalId: 2, dateModified: flats[1].dateModified, probedAt: '2026-09-01T00:00:00.000Z' },
    ]
    expect(selectProbeTargets(flats, known).map((a) => a.externalId)).toEqual([1])
  })

  it('новая квартира опрашивается', () => {
    const known = [{ externalId: 1, dateModified: flats[0].dateModified, probedAt: '2026-09-01T00:00:00.000Z' }]
    expect(selectProbeTargets(flats, known).map((a) => a.externalId)).toEqual([2])
  })
})
