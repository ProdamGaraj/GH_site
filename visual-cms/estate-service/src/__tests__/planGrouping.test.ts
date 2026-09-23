/**
 * Склейка типов планировок.
 *
 * Зачем она: CRM отдаёт свой чертёж на каждое положение квартиры на этаже, и
 * зеркальные варианты приходили в каталог отдельными карточками — у Doʼstlik
 * до семи штук с одинаковым заголовком, площадью и ценой.
 *
 * Правило настраиваемое, потому что общего признака «одна планировка» в
 * метаданных нет: имена у проектов разные, а допуск по площади у каждого свой.
 */
import {
  planGroups,
  mergePlanTypes,
  mergeGroup,
  normalizeConfig,
  DEFAULT_GROUPING,
} from '../services/planGrouping'
import type { PlanTypeRow } from '../services/i18n'

function plan(over: Partial<PlanTypeRow> = {}): PlanTypeRow {
  return {
    id: 'p',
    houseId: 'h1',
    signature: 's',
    planName: 'p',
    images: [],
    panoUrl: '',
    rooms: 1,
    isStudio: false,
    areaMin: 40,
    areaMax: 40,
    priceMin: 100,
    priceMax: 100,
    apartmentsCount: 1,
    floors: [2],
    entrances: [1],
    windowViews: [],
    order: 0,
    ...over,
  }
}

const names = (rows: PlanTypeRow[]) => rows.map((r) => r.planName)

describe('normalizeConfig', () => {
  it('без настройки склеиваются только точные совпадения', () => {
    expect(normalizeConfig(null)).toEqual(DEFAULT_GROUPING)
    expect(normalizeConfig({}).areaTolerance).toBe(0)
  })

  it('мусор в допуске не включает склейку', () => {
    expect(normalizeConfig({ areaTolerance: -1 }).areaTolerance).toBe(0)
    expect(normalizeConfig({ areaTolerance: NaN }).areaTolerance).toBe(0)
    expect(normalizeConfig({ areaTolerance: 'много' as unknown as number }).areaTolerance).toBe(0)
  })

  it('группа из одного элемента отбрасывается — склеивать не с чем', () => {
    expect(normalizeConfig({ groups: [{ plans: ['a'] }] }).groups).toEqual([])
    expect(normalizeConfig({ groups: [{ plans: ['a', 'b'] }] }).groups).toHaveLength(1)
  })
})

describe('автоматическая склейка по площади', () => {
  const rows = [
    plan({ planName: '13', areaMin: 21.08, areaMax: 21.08, order: 0 }),
    plan({ planName: '14', areaMin: 21.08, areaMax: 21.08, order: 1 }),
    plan({ planName: '3_13', areaMin: 21.08, areaMax: 21.08, order: 2 }),
    plan({ planName: 'другой', areaMin: 36.9, areaMax: 36.9, order: 3 }),
  ]

  it('точные совпадения склеиваются и без допуска', () => {
    const groups = planGroups(rows)
    expect(groups.map((g) => names(g.rows))).toEqual([['13', '14', '3_13'], ['другой']])
  })

  it('разная комнатность не склеивается никогда', () => {
    const mixed = [plan({ planName: 'a', rooms: 1 }), plan({ planName: 'b', rooms: 2 })]
    expect(planGroups(mixed)).toHaveLength(2)
  })

  it('разные корпуса не склеиваются: подъезды там нумеруются независимо', () => {
    const mixed = [plan({ planName: 'a', houseId: 'h1' }), plan({ planName: 'b', houseId: 'h2' })]
    expect(planGroups(mixed)).toHaveLength(2)
  })

  it('студия и не-студия одной площади остаются раздельными', () => {
    const mixed = [plan({ planName: 'a', isStudio: true }), plan({ planName: 'b', isStudio: false })]
    expect(planGroups(mixed)).toHaveLength(2)
  })
})

describe('допуск по площади', () => {
  const rows = [
    plan({ planName: 'a', areaMin: 40.32, areaMax: 40.32, order: 0 }),
    plan({ planName: 'b', areaMin: 40.33, areaMax: 40.33, order: 1 }),
    plan({ planName: 'c', areaMin: 40.74, areaMax: 40.74, order: 2 }),
  ]

  it('без допуска — три отдельные карточки', () => {
    expect(planGroups(rows)).toHaveLength(3)
  })

  it('допуск 0.05 склеивает только близкую пару', () => {
    const groups = planGroups(rows, { areaTolerance: 0.05 })
    expect(groups.map((g) => names(g.rows))).toEqual([['a', 'b'], ['c']])
  })

  it('допуск 0.5 собирает весь ряд', () => {
    expect(planGroups(rows, { areaTolerance: 0.5 })).toHaveLength(1)
  })

  it('одиночная связь тянет цепочку: 39.79–40.03 и 39.80 — один ряд', () => {
    const chain = [
      plan({ planName: 'x', areaMin: 39.79, areaMax: 40.03, order: 0 }),
      plan({ planName: 'y', areaMin: 39.8, areaMax: 39.8, order: 1 }),
    ]
    expect(planGroups(chain, { areaTolerance: 0.05 })).toHaveLength(1)
  })

  it('разрыв больше допуска не склеивается', () => {
    const far = [
      plan({ planName: 'x', areaMin: 34.87, areaMax: 34.87 }),
      plan({ planName: 'y', areaMin: 43.72, areaMax: 43.87 }),
    ]
    expect(planGroups(far, { areaTolerance: 0.5 })).toHaveLength(2)
  })
})

describe('ручные правки', () => {
  const rows = [
    plan({ planName: 'a', areaMin: 30, areaMax: 30, order: 0 }),
    plan({ planName: 'b', areaMin: 50, areaMax: 50, order: 1 }),
    plan({ planName: 'c', areaMin: 50, areaMax: 50, order: 2 }),
  ]

  it('groups склеивает то, что по площади не сходится', () => {
    const groups = planGroups(rows, { groups: [{ plans: ['a', 'b'] }] })
    const merged = groups.find((g) => g.manual)!
    expect(names(merged.rows).sort()).toEqual(['a', 'b'])
    expect(groups).toHaveLength(2)
  })

  it('keepSeparate вынимает планировку из автоматической группы', () => {
    const groups = planGroups(rows, { keepSeparate: ['c'] })
    expect(groups.map((g) => names(g.rows))).toEqual([['a'], ['b'], ['c']])
  })

  it('ручная группа побеждает автоматическую', () => {
    const groups = planGroups(rows, { groups: [{ plans: ['a', 'b'] }] })
    // b ушла в ручную группу, значит c осталась одна
    expect(groups.some((g) => names(g.rows).join() === 'c')).toBe(true)
  })

  it('несуществующее имя в настройке не роняет разбор', () => {
    expect(() => planGroups(rows, { groups: [{ plans: ['нет', 'тоже нет'] }] })).not.toThrow()
    // Разрешилось одно имя из двух — склеивать не с чем, группа отбрасывается,
    // и «a» возвращается в автоматический разбор.
    const groups = planGroups(rows, { groups: [{ plans: ['нет', 'a'] }] })
    expect(groups.map((g) => names(g.rows))).toEqual([['a'], ['b', 'c']])
  })

  it('планировка не попадает в две ручные группы сразу', () => {
    const groups = planGroups(rows, {
      groups: [{ plans: ['a', 'b'] }, { plans: ['b', 'c'] }],
    })
    const all = groups.flatMap((g) => names(g.rows))
    expect(all).toHaveLength(3)
    expect(new Set(all).size).toBe(3)
  })
})

describe('слияние группы', () => {
  const rows = [
    plan({
      planName: 'a', order: 1, id: 'id-a', areaMin: 39.79, areaMax: 40.03,
      priceMin: 500, priceMax: 700, apartmentsCount: 4,
      floors: [3, 4], entrances: [5], windowViews: ['двор'],
      images: [{ title: 'm', url: '/a.webp', thumbUrl: '' }],
    }),
    plan({
      planName: 'b', order: 0, id: 'id-b', areaMin: 39.8, areaMax: 39.8,
      priceMin: 400, priceMax: 600, apartmentsCount: 2,
      floors: [4, 5], entrances: [1], windowViews: ['бульвар', 'двор'],
      images: [{ title: 'm', url: '/b.webp', thumbUrl: '' }, { title: 'm', url: '/a.webp', thumbUrl: '' }],
      panoUrl: 'https://tour',
    }),
  ]
  const merged = mergeGroup(rows)

  it('представитель — первый по order, чтобы ссылки не скакали', () => {
    expect(merged.id).toBe('id-b')
    expect(merged.planName).toBe('b')
  })

  it('площадь и цена показываются полным диапазоном', () => {
    expect(merged.areaMin).toBe(39.79)
    expect(merged.areaMax).toBe(40.03)
    expect(merged.priceMin).toBe(400)
    expect(merged.priceMax).toBe(700)
  })

  it('квартиры суммируются — покупатель видит реальное предложение', () => {
    expect(merged.apartmentsCount).toBe(6)
  })

  it('этажи, подъезды и виды объединяются без повторов', () => {
    expect(merged.floors).toEqual([3, 4, 5])
    expect(merged.entrances).toEqual([1, 5])
    expect(merged.windowViews).toEqual(['бульвар', 'двор'])
  })

  it('чертежи всех вариантов идут в галерею, дубли по url убираются', () => {
    expect(merged.images.map((i) => i.url)).toEqual(['/b.webp', '/a.webp'])
  })

  it('3D-тур берётся у того, у кого он есть', () => {
    expect(merged.panoUrl).toBe('https://tour')
  })

  it('группа из одного элемента возвращается как есть', () => {
    const single = plan({ planName: 'solo' })
    expect(mergeGroup([single])).toBe(single)
  })

  it('нулевые цены не занижают диапазон до нуля', () => {
    const withZero = [plan({ planName: 'a', priceMin: 0, priceMax: 0 }), plan({ planName: 'b', priceMin: 900, priceMax: 950 })]
    const m = mergeGroup(withZero)
    expect(m.priceMin).toBe(900)
    expect(m.priceMax).toBe(950)
  })
})

describe('mergePlanTypes', () => {
  it('порядок карточек сохраняется по order представителя', () => {
    const rows = [
      plan({ planName: 'поздняя', areaMin: 20, areaMax: 20, order: 5 }),
      plan({ planName: 'ранняя', areaMin: 30, areaMax: 30, order: 1 }),
    ]
    expect(names(mergePlanTypes(rows))).toEqual(['ранняя', 'поздняя'])
  })

  it('пустой вход — пустой выход', () => {
    expect(mergePlanTypes([])).toEqual([])
  })

  it('без настройки поведение прежнее: склейка только точных совпадений', () => {
    const rows = [
      plan({ planName: 'a', areaMin: 40.1, areaMax: 40.1 }),
      plan({ planName: 'b', areaMin: 40.2, areaMax: 40.2 }),
    ]
    expect(mergePlanTypes(rows)).toHaveLength(2)
  })
})
