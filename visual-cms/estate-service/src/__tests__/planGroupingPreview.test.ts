/**
 * Предпросмотр склейки для админки.
 *
 * Главное требование: админка показывает ровно то, что попадёт на сайт. Поэтому
 * здесь проверяется не только форма ответа, но и совпадение с `mergePlanTypes`,
 * которым пользуется витрина.
 */
import { previewPlanGrouping } from '../services/planGroupingPreview'
import { mergePlanTypes } from '../services/planGrouping'
import { previewPlanGroupsSchema, updateComplexSchema } from '../schemas/estate.schema'
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

const rows = [
  plan({ id: '1', planName: '13', areaMin: 21.08, areaMax: 21.08, order: 0, entrances: [1], floors: [2, 3] }),
  plan({ id: '2', planName: '3_13', areaMin: 21.08, areaMax: 21.08, order: 1, entrances: [3], floors: [4] }),
  plan({ id: '3', planName: '29', areaMin: 42.23, areaMax: 42.24, order: 2, rooms: 2 }),
  plan({ id: '4', planName: '3_29', areaMin: 42.24, areaMax: 42.24, order: 3, rooms: 2 }),
  plan({ id: '5', planName: 'продана', areaMin: 50, areaMax: 50, order: 4, apartmentsCount: 0 }),
]

describe('previewPlanGrouping', () => {
  it('карточки совпадают с витриной при любой настройке', () => {
    for (const config of [null, { areaTolerance: 0.01 }, { groups: [{ plans: ['13', '29'] }] }]) {
      const preview = previewPlanGrouping(rows, config)
      const site = mergePlanTypes(rows.filter((r) => r.apartmentsCount > 0), config)
      expect(preview.cardsCount).toBe(site.length)
      expect(preview.groups.map((g) => [g.areaMin, g.areaMax, g.apartmentsCount])).toEqual(
        site.map((s) => [Number(s.areaMin), Number(s.areaMax), s.apartmentsCount])
      )
    }
  })

  it('типы без квартир не показываются — как и на сайте', () => {
    const preview = previewPlanGrouping(rows, null)
    expect(preview.typesCount).toBe(4)
    expect(preview.groups.flatMap((g) => g.plans.map((p) => p.planName))).not.toContain('продана')
  })

  it('карточка несёт объединённые подъезды, этажи и сумму квартир', () => {
    const [first] = previewPlanGrouping(rows, null).groups
    expect(first.plans.map((p) => p.planName)).toEqual(['13', '3_13'])
    expect(first.entrances).toEqual([1, 3])
    expect(first.floors).toEqual([2, 3, 4])
    expect(first.apartmentsCount).toBe(2)
    expect(first.manual).toBe(false)
  })

  it('допуск из черновика применяется: 0.01 склеивает 29 и 3_29', () => {
    expect(previewPlanGrouping(rows, null).cardsCount).toBe(3)
    expect(previewPlanGrouping(rows, { areaTolerance: 0.01 }).cardsCount).toBe(2)
  })

  it('отдаёт нормализованную настройку, а не присланную как есть', () => {
    const preview = previewPlanGrouping(rows, { areaTolerance: -3, groups: [{ plans: ['13'] }] })
    expect(preview.config).toEqual({ areaTolerance: 0, groups: [], keepSeparate: [] })
  })

  it('миниатюра — thumbUrl, а без него — сам чертёж', () => {
    const withImages = [
      plan({ planName: 'a', images: [{ title: '', url: '/a.webp', thumbUrl: '/a.thumb.webp' }] }),
      plan({ planName: 'b', areaMin: 60, areaMax: 60, images: [{ title: '', url: '/b.webp', thumbUrl: '' }] }),
      plan({ planName: 'c', areaMin: 70, areaMax: 70 }),
    ]
    const plans = previewPlanGrouping(withImages, null).groups.flatMap((g) => g.plans)
    expect(plans.map((p) => [p.thumb, p.image, p.imagesCount])).toEqual([
      ['/a.thumb.webp', '/a.webp', 1],
      ['/b.webp', '/b.webp', 1],
      ['', '', 0],
    ])
  })

  it('подписывает корпус по имени дома', () => {
    const preview = previewPlanGrouping(rows, null, new Map([['h1', 'Корпус 4']]))
    expect(preview.groups[0].plans[0].houseName).toBe('Корпус 4')
  })

  it('отмечает отделённые вручную планировки', () => {
    const preview = previewPlanGrouping(rows, { keepSeparate: ['3_13'] })
    const separated = preview.groups.flatMap((g) => g.plans).filter((p) => p.separated)
    expect(separated.map((p) => p.planName)).toEqual(['3_13'])
  })

  it('ручная группа помечена как ручная', () => {
    const preview = previewPlanGrouping(rows, { groups: [{ plans: ['13', '29'] }] })
    const manual = preview.groups.filter((g) => g.manual)
    expect(manual).toHaveLength(1)
    expect(manual[0].plans.map((p) => p.planName)).toEqual(['13', '29'])
  })

  describe('предупреждения', () => {
    it('имя из настройки, которого нет на витрине, — неизвестное', () => {
      const preview = previewPlanGrouping(rows, {
        groups: [{ plans: ['13', 'пропала'] }],
        keepSeparate: ['продана'],
      })
      expect(preview.warnings.unknownNames).toEqual(['продана', 'пропала'])
    })

    it('одинаковые имена в разных корпусах — ручная правка по ним неоднозначна', () => {
      const twins = [plan({ planName: '5', houseId: 'h1' }), plan({ planName: '5', houseId: 'h2' })]
      expect(previewPlanGrouping(twins, null).warnings.duplicateNames).toEqual(['5'])
    })

    it('без проблем — пустые списки', () => {
      expect(previewPlanGrouping(rows, null).warnings).toEqual({ duplicateNames: [], unknownNames: [] })
    })
  })

  it('пустой ЖК не падает', () => {
    expect(previewPlanGrouping([], null)).toMatchObject({ typesCount: 0, cardsCount: 0, groups: [] })
  })
})

describe('схема настройки склейки', () => {
  it('предпросмотр принимает null — «сбросить к умолчанию»', () => {
    expect(previewPlanGroupsSchema.safeParse({ planGrouping: null }).success).toBe(true)
  })

  it('предпросмотр без поля planGrouping отклоняется: черновик обязателен', () => {
    expect(previewPlanGroupsSchema.safeParse({}).success).toBe(false)
  })

  it('отрицательный допуск и группа из одной планировки отклоняются', () => {
    expect(previewPlanGroupsSchema.safeParse({ planGrouping: { areaTolerance: -1 } }).success).toBe(false)
    expect(
      previewPlanGroupsSchema.safeParse({ planGrouping: { groups: [{ plans: ['a'] }] } }).success
    ).toBe(false)
  })

  it('пустые имена отклоняются', () => {
    expect(previewPlanGroupsSchema.safeParse({ planGrouping: { keepSeparate: [''] } }).success).toBe(false)
  })

  it('обновление ЖК принимает ту же настройку', () => {
    const body = { planGrouping: { areaTolerance: 0.01, groups: [{ plans: ['a', 'b'] }], keepSeparate: ['c'] } }
    const parsed = updateComplexSchema.safeParse(body)
    expect(parsed.success).toBe(true)
    expect(parsed.success && parsed.data.planGrouping).toEqual(body.planGrouping)
  })
})
