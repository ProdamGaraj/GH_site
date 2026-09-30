/**
 * Ручные данные групп планировок и скрытие с сайта.
 *
 * Админ правит карточку-группу: площадь, этажи, подъезды, бейджи. Цены нет:
 * на сайте цены не показываются (2026-09-29), и правка цены, записанная
 * старой версией, отбрасывается. Ручное главнее CRM, «Подставить значения из
 * CRM» снимает правку. Данные CRM в базе не трогаются — правка накладывается
 * на чтении, поэтому переживает пересинк; группа ищется по «якорной»
 * планировке, поэтому правка переживает и пересборку групп.
 */
import {
  applyOverride,
  badgesFor,
  CRM_OVERRIDE_FIELDS,
  normalizeConfig,
  PlanGroupOverride,
  resolvePlanGroups,
  sitePlanTypes,
} from '../services/planGrouping'
import { previewPlanGrouping } from '../services/planGroupingPreview'
import { buildComplexDetail, ComplexRow, PlanTypeRow } from '../services/i18n'
import { updateComplexSchema } from '../schemas/estate.schema'

/** Строка plan_types, как её отдаёт база: цена из CRM в ней есть. */
function plan(over: Record<string, unknown> = {}): PlanTypeRow {
  const row = {
    id: (over.planName as string) ?? 'p',
    houseId: 'h1',
    signature: 's',
    planName: 'p',
    images: [],
    panoUrl: '',
    rooms: 2,
    isStudio: false,
    areaMin: 55,
    areaMax: 55,
    priceMin: 500_000_000,
    priceMax: 600_000_000,
    apartmentsCount: 3,
    floors: [2, 3],
    entrances: [1],
    windowViews: [],
    order: 0,
    ...over,
  }
  return row as PlanTypeRow
}

/** Правка из базы, как её могла записать старая админка (с ценой). */
const legacy = (o: Record<string, unknown>) => o as PlanGroupOverride

// Две зеркальные планировки 55 м² (склеятся) и отдельная 70 м².
const A = plan({ planName: 'A', order: 0, areaMin: 55, areaMax: 55, floors: [2, 3], entrances: [1] })
const B = plan({ planName: 'B', order: 1, areaMin: 55.2, areaMax: 55.2, floors: [5], entrances: [3] })
const C = plan({ planName: 'C', order: 2, areaMin: 70, areaMax: 70, floors: [7], entrances: [2] })
const ROWS = [A, B, C]
const TOL = { areaTolerance: 0.5 }

describe('normalizeConfig — скрытие и правки', () => {
  it('мусор из базы отбрасывается, пустые правки удаляются', () => {
    const cfg = normalizeConfig({
      hidden: ['A', '', 5 as any],
      overrides: {
        A: { areaMin: 54, floors: [3, 2, 2, 'x' as any], badges: { ru: [' Акция ', 'Акция', ''], uz: [] } },
        B: { foo: 1 } as any,
        '': { areaMin: 1 },
        C: null as any,
      },
    })
    expect(cfg.hidden).toEqual(['A'])
    expect(cfg.overrides).toEqual({ A: { areaMin: 54, floors: [2, 3], badges: { ru: ['Акция'] } } })
  })

  it('цена из старой правки отбрасывается; правка из одной цены — пустая, её нет', () => {
    const cfg = normalizeConfig({
      overrides: {
        A: legacy({ priceMin: 450, priceMax: 700, entrances: [1, 2] }),
        B: legacy({ priceMin: 1 }),
      },
    })
    expect(cfg.overrides).toEqual({ A: { entrances: [1, 2] } })
  })

  it('без полей — пустые', () => {
    expect(normalizeConfig(null)).toMatchObject({ hidden: [], overrides: {} })
  })

  it('«Подставить значения из CRM» — только то, что есть в CRM и правится: без цены', () => {
    expect([...CRM_OVERRIDE_FIELDS]).toEqual(['areaMin', 'areaMax', 'floors', 'entrances'])
  })
})

describe('resolvePlanGroups', () => {
  it('без правок: CRM как есть, якорь — главная планировка группы', () => {
    const [ab, c] = resolvePlanGroups(ROWS, TOL)
    expect(ab.anchor).toBe('A')
    expect(ab.merged).toEqual(ab.crm)
    expect(ab.crm).toMatchObject({ areaMin: 55, areaMax: 55.2, floors: [2, 3, 5], entrances: [1, 3] })
    expect(ab.override).toBeNull()
    expect(c.anchor).toBe('C')
  })

  it('ручные значения главнее CRM, остальное из CRM', () => {
    const [ab] = resolvePlanGroups(ROWS, { ...TOL, overrides: { A: { areaMin: 54, entrances: [1, 2, 3] } } })
    expect(ab.merged).toMatchObject({ areaMin: 54, areaMax: 55.2, entrances: [1, 2, 3], floors: [2, 3, 5] })
    expect(ab.crm.areaMin).toBe(55)
    expect(ab.overrideKey).toBe('A')
  })

  it('правка держится за якорь: после пересборки группы идёт за своей планировкой', () => {
    // Правку сохранили, когда B была главной отдельной карточкой; потом A и B склеились.
    const [ab] = resolvePlanGroups(ROWS, { ...TOL, overrides: { B: { areaMin: 1 } } })
    expect(ab.anchor).toBe('A')
    expect(ab.overrideKey).toBe('B')
    expect(ab.merged.areaMin).toBe(1)
  })

  it('две правки в одной группе: действует правка главной, другая — в ignoredOverrides', () => {
    const [ab] = resolvePlanGroups(ROWS, { ...TOL, overrides: { B: { areaMin: 2 }, A: { areaMin: 1 } } })
    expect(ab.overrideKey).toBe('A')
    expect(ab.merged.areaMin).toBe(1)
    expect(ab.ignoredOverrides).toEqual(['B'])
  })

  it('группа скрыта, если в ней есть скрытая планировка', () => {
    const [ab, c] = resolvePlanGroups(ROWS, { ...TOL, hidden: ['B'] })
    expect(ab.hidden).toBe(true)
    expect(c.hidden).toBe(false)
  })
})

describe('sitePlanTypes — что уходит на сайт', () => {
  it('без скрытых групп, с правками и бейджами', () => {
    const out = sitePlanTypes(ROWS, {
      ...TOL,
      hidden: ['C'],
      overrides: { A: { floors: [2, 16], badges: { ru: ['Акция'], uz: ['Aksiya'] } } },
    })
    expect(out.map((r) => r.planName)).toEqual(['A'])
    expect(out[0].floors).toEqual([2, 16])
    expect(out[0].badges).toEqual({ ru: ['Акция'], uz: ['Aksiya'] })
  })

  it('без настройки — как раньше, без бейджей', () => {
    const out = sitePlanTypes(ROWS, TOL)
    expect(out).toHaveLength(2)
    expect(out[0].badges).toBeUndefined()
  })
})

describe('badgesFor / applyOverride', () => {
  it('бейджи на языке страницы, без перевода — ru', () => {
    const badges = { ru: ['Акция'], uz: ['Aksiya'] }
    expect(badgesFor(badges, 'uz')).toEqual(['Aksiya'])
    expect(badgesFor(badges, 'en')).toEqual(['Акция'])
    expect(badgesFor({ ru: ['Акция'], en: [] }, 'en')).toEqual(['Акция'])
    expect(badgesFor(undefined, 'ru')).toEqual([])
  })

  it('без правки — та же строка', () => {
    expect(applyOverride(A, null)).toBe(A)
  })
})

describe('buildComplexDetail — карточки планировок на сайте', () => {
  const complex = {
    id: 'c1',
    slug: 'x',
    status: 'active',
    planGrouping: {
      ...TOL,
      hidden: ['C'],
      overrides: { A: legacy({ priceMin: 450_000_000, floors: [2, 16], badges: { ru: ['Акция'], uz: ['Aksiya'] } }) },
    },
  } as unknown as ComplexRow

  it('скрытой группы нет ни в карточках, ни в чипсах; правка и бейджи — на карточке', () => {
    const dto = buildComplexDetail(complex, [], [], [], 'uz', ROWS)
    expect(dto.planTypes).toHaveLength(1)
    const card = dto.planTypes[0]
    expect(card.floorsAttr).toBe('2,16')
    expect(card.badges).toEqual(['Aksiya'])
    // Чипсы комнатности — из видимых карточек (строками, как всегда).
    expect(dto.planRooms).toEqual(['2'])
  })

  it('цены нет ни из CRM, ни из старой ручной правки', () => {
    const json = JSON.stringify(buildComplexDetail(complex, [], [], [], 'ru', ROWS))
    expect(json).not.toMatch(/[pP]rice|450000000|500000000|UZS/)
  })

  it('распроданный проект: скрытие работает, бейджи на месте', () => {
    const dto = buildComplexDetail({ ...complex, status: 'sold_out' } as ComplexRow, [], [], [], 'ru', ROWS)
    expect(dto.planTypes).toHaveLength(1)
    expect(dto.planTypes[0].badges).toEqual(['Акция'])
  })
})

describe('previewPlanGrouping — админка', () => {
  it('итог и CRM рядом, правка, якорь и скрытие', () => {
    const preview = previewPlanGrouping(ROWS, {
      ...TOL,
      hidden: ['C'],
      overrides: { A: { areaMin: 54 } },
    })
    const [ab, c] = preview.groups
    expect(ab).toMatchObject({ anchor: 'A', hidden: false, overrideKey: 'A', areaMin: 54, areaMax: 55.2 })
    expect(ab.crm).toMatchObject({ areaMin: 55, areaMax: 55.2, floors: [2, 3, 5] })
    expect(c).toMatchObject({ anchor: 'C', hidden: true, override: null })
  })

  it('цены в предпросмотре нет ни в итоге, ни в CRM, ни в правке', () => {
    const preview = previewPlanGrouping(ROWS, { ...TOL, overrides: { A: legacy({ priceMin: 1, areaMin: 54 }) } })
    const [ab] = preview.groups
    for (const values of [ab, ab.crm, ab.override]) {
      expect(values).not.toHaveProperty('priceMin')
      expect(values).not.toHaveProperty('priceMax')
    }
  })

  it('якоря правок и скрытия, которых нет на витрине, — в unknownNames', () => {
    const preview = previewPlanGrouping(ROWS, { hidden: ['GONE'], overrides: { OLD: { areaMin: 1 } } })
    expect(preview.warnings.unknownNames).toEqual(['GONE', 'OLD'])
  })

  it('распроданный проект: в предпросмотре типы без квартир, как на сайте', () => {
    const empty = [plan({ planName: 'Z', apartmentsCount: 0 })]
    expect(previewPlanGrouping(empty, null).groups).toHaveLength(0)
    expect(previewPlanGrouping(empty, null, new Map(), { soldOut: true }).groups).toHaveLength(1)
  })
})

describe('updateComplexSchema.planGrouping — проверки', () => {
  const parse = (planGrouping: unknown) => updateComplexSchema.safeParse({ planGrouping })
  const ok = (planGrouping: unknown) => parse(planGrouping).success

  it('корректная настройка', () => {
    expect(
      ok({
        hidden: ['A'],
        overrides: { A: { areaMin: 40, areaMax: 41, floors: [-1, 2], entrances: [0, 3], badges: { ru: ['Акция'] } } },
      })
    ).toBe(true)
  })

  it('цена от старой админки не ломает сохранение — молча отбрасывается', () => {
    const result = parse({ overrides: { A: { priceMin: 3, priceMax: 2, areaMin: 40 } } })
    expect(result.success).toBe(true)
    expect((result as any).data.planGrouping.overrides.A).toEqual({ areaMin: 40 })
  })

  it('«от» больше «до», дробный этаж, длинный бейдж — отказ', () => {
    expect(ok({ overrides: { A: { areaMin: 50, areaMax: 40 } } })).toBe(false)
    expect(ok({ overrides: { A: { floors: [2.5] } } })).toBe(false)
    expect(ok({ overrides: { A: { areaMin: -1 } } })).toBe(false)
    expect(ok({ overrides: { A: { badges: { ru: ['x'.repeat(41)] } } } })).toBe(false)
    expect(ok({ overrides: { A: { badges: { ru: Array(11).fill('a') } } } })).toBe(false)
  })
})
