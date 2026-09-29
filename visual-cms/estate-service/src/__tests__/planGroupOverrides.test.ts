/**
 * Ручные данные групп планировок и скрытие с сайта.
 *
 * Админ правит карточку-группу: цену, площадь, этажи, подъезды, бейджи.
 * Ручное главнее CRM, «Подставить значения из CRM» снимает правку. Данные CRM
 * в базе не трогаются — правка накладывается на чтении, поэтому переживает
 * пересинк; группа ищется по «якорной» планировке, поэтому правка переживает
 * и пересборку групп.
 */
import {
  applyOverride,
  badgesFor,
  normalizeConfig,
  resolvePlanGroups,
  sitePlanTypes,
} from '../services/planGrouping'
import { previewPlanGrouping } from '../services/planGroupingPreview'
import { buildComplexDetail, ComplexRow, PlanTypeRow } from '../services/i18n'
import { updateComplexSchema } from '../schemas/estate.schema'

function plan(over: Partial<PlanTypeRow> = {}): PlanTypeRow {
  return {
    id: over.planName ?? 'p',
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
}

// Две зеркальные планировки 55 м² (склеятся) и отдельная 70 м².
const A = plan({ planName: 'A', order: 0, areaMin: 55, areaMax: 55, priceMin: 500, priceMax: 550, floors: [2, 3], entrances: [1] })
const B = plan({ planName: 'B', order: 1, areaMin: 55.2, areaMax: 55.2, priceMin: 480, priceMax: 700, floors: [5], entrances: [3] })
const C = plan({ planName: 'C', order: 2, areaMin: 70, areaMax: 70, priceMin: 900, priceMax: 900, floors: [7], entrances: [2] })
const ROWS = [A, B, C]
const TOL = { areaTolerance: 0.5 }

describe('normalizeConfig — скрытие и правки', () => {
  it('мусор из базы отбрасывается, пустые правки удаляются', () => {
    const cfg = normalizeConfig({
      hidden: ['A', '', 5 as any],
      overrides: {
        A: { priceMin: 1, floors: [3, 2, 2, 'x' as any], badges: { ru: [' Акция ', 'Акция', ''], uz: [] } },
        B: { foo: 1 } as any,
        '': { priceMin: 1 },
        C: null as any,
      },
    })
    expect(cfg.hidden).toEqual(['A'])
    expect(cfg.overrides).toEqual({ A: { priceMin: 1, floors: [2, 3], badges: { ru: ['Акция'] } } })
  })

  it('без полей — пустые', () => {
    expect(normalizeConfig(null)).toMatchObject({ hidden: [], overrides: {} })
  })
})

describe('resolvePlanGroups', () => {
  it('без правок: CRM как есть, якорь — главная планировка группы', () => {
    const [ab, c] = resolvePlanGroups(ROWS, TOL)
    expect(ab.anchor).toBe('A')
    expect(ab.merged).toEqual(ab.crm)
    expect(ab.crm).toMatchObject({ priceMin: 480, priceMax: 700, areaMin: 55, areaMax: 55.2, floors: [2, 3, 5], entrances: [1, 3] })
    expect(ab.override).toBeNull()
    expect(c.anchor).toBe('C')
  })

  it('ручные значения главнее CRM, остальное из CRM', () => {
    const [ab] = resolvePlanGroups(ROWS, { ...TOL, overrides: { A: { priceMin: 450, entrances: [1, 2, 3] } } })
    expect(ab.merged).toMatchObject({ priceMin: 450, priceMax: 700, entrances: [1, 2, 3], floors: [2, 3, 5] })
    expect(ab.crm.priceMin).toBe(480)
    expect(ab.overrideKey).toBe('A')
  })

  it('правка держится за якорь: после пересборки группы идёт за своей планировкой', () => {
    // Правку сохранили, когда B была главной отдельной карточкой; потом A и B склеились.
    const [ab] = resolvePlanGroups(ROWS, { ...TOL, overrides: { B: { priceMin: 1 } } })
    expect(ab.anchor).toBe('A')
    expect(ab.overrideKey).toBe('B')
    expect(ab.merged.priceMin).toBe(1)
  })

  it('две правки в одной группе: действует правка главной, другая — в ignoredOverrides', () => {
    const [ab] = resolvePlanGroups(ROWS, { ...TOL, overrides: { B: { priceMin: 2 }, A: { priceMin: 1 } } })
    expect(ab.overrideKey).toBe('A')
    expect(ab.merged.priceMin).toBe(1)
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
      overrides: { A: { priceMin: 450, badges: { ru: ['Акция'], uz: ['Aksiya'] } } },
    })
    expect(out.map((r) => r.planName)).toEqual(['A'])
    expect(out[0].priceMin).toBe(450)
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
      overrides: { A: { priceMin: 450_000_000, floors: [2, 16], badges: { ru: ['Акция'], uz: ['Aksiya'] } } },
    },
  } as unknown as ComplexRow
  const rows = [
    { ...A, priceMin: 480_000_000, priceMax: 700_000_000 },
    { ...B, priceMin: 480_000_000, priceMax: 700_000_000 },
    C,
  ]

  it('скрытой группы нет ни в карточках, ни в чипсах; правка и бейджи — на карточке', () => {
    const dto = buildComplexDetail(complex, [], [], [], 'uz', rows)
    expect(dto.planTypes).toHaveLength(1)
    const card = dto.planTypes[0]
    expect(card.priceMin).toBe(450_000_000)
    expect(card.priceMax).toBe(700_000_000)
    expect(card.floorsAttr).toBe('2,16')
    expect(card.badges).toEqual(['Aksiya'])
    // Чипсы комнатности — из видимых карточек (строками, как всегда).
    expect(dto.planRooms).toEqual(['2'])
  })

  it('распроданный проект: скрытие работает, цен нет даже ручных', () => {
    const dto = buildComplexDetail({ ...complex, status: 'sold_out' } as ComplexRow, [], [], [], 'ru', rows)
    expect(dto.planTypes).toHaveLength(1)
    expect(dto.planTypes[0].priceMin).toBe(0)
    expect(dto.planTypes[0].priceLabel).toBe('')
    expect(dto.planTypes[0].badges).toEqual(['Акция'])
  })
})

describe('previewPlanGrouping — админка', () => {
  it('итог и CRM рядом, правка, якорь и скрытие', () => {
    const preview = previewPlanGrouping(ROWS, {
      ...TOL,
      hidden: ['C'],
      overrides: { A: { priceMin: 450 } },
    })
    const [ab, c] = preview.groups
    expect(ab).toMatchObject({ anchor: 'A', hidden: false, overrideKey: 'A', priceMin: 450, priceMax: 700 })
    expect(ab.crm).toMatchObject({ priceMin: 480, priceMax: 700, floors: [2, 3, 5] })
    expect(c).toMatchObject({ anchor: 'C', hidden: true, override: null })
  })

  it('якоря правок и скрытия, которых нет на витрине, — в unknownNames', () => {
    const preview = previewPlanGrouping(ROWS, { hidden: ['GONE'], overrides: { OLD: { priceMin: 1 } } })
    expect(preview.warnings.unknownNames).toEqual(['GONE', 'OLD'])
  })

  it('распроданный проект: в предпросмотре типы без квартир, как на сайте', () => {
    const empty = [plan({ planName: 'Z', apartmentsCount: 0 })]
    expect(previewPlanGrouping(empty, null).groups).toHaveLength(0)
    expect(previewPlanGrouping(empty, null, new Map(), { soldOut: true }).groups).toHaveLength(1)
  })
})

describe('updateComplexSchema.planGrouping — проверки', () => {
  const ok = (planGrouping: unknown) => updateComplexSchema.safeParse({ planGrouping }).success

  it('корректная настройка', () => {
    expect(
      ok({
        hidden: ['A'],
        overrides: { A: { priceMin: 1, priceMax: 2, areaMin: 40, areaMax: 41, floors: [-1, 2], entrances: [0, 3], badges: { ru: ['Акция'] } } },
      })
    ).toBe(true)
  })

  it('«от» больше «до», дробный этаж, отрицательная цена, длинный бейдж — отказ', () => {
    expect(ok({ overrides: { A: { priceMin: 3, priceMax: 2 } } })).toBe(false)
    expect(ok({ overrides: { A: { areaMin: 50, areaMax: 40 } } })).toBe(false)
    expect(ok({ overrides: { A: { floors: [2.5] } } })).toBe(false)
    expect(ok({ overrides: { A: { priceMin: -1 } } })).toBe(false)
    expect(ok({ overrides: { A: { badges: { ru: ['x'.repeat(41)] } } } })).toBe(false)
    expect(ok({ overrides: { A: { badges: { ru: Array(11).fill('a') } } } })).toBe(false)
  })
})
