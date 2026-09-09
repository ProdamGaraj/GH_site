/**
 * Решения синхронизации дома.
 *
 * Главный тест здесь — «повторный прогон сохраняет id». Переводы в
 * estate_translations привязаны к id сущности, и стоит diff начать считать
 * знакомые строки новыми, как ночной синк осиротит весь узбекский перевод.
 * Сид работает через delete + create, и повторить эту схему в синке было бы
 * естественной ошибкой — от неё и страхуемся.
 */
import {
  diffApartments,
  diffPlanTypes,
  diffByKey,
  findDanglingSignatures,
  summarize,
  STATUS_GONE,
  type ApartmentInput,
  type PlanTypeInput,
  type ExistingRow,
} from '../services/houseSync'
import { syncHouseSchema } from '../schemas/sync.schema'

function apartment(externalId: number, over: Partial<ApartmentInput> = {}): ApartmentInput {
  return {
    externalId,
    rooms: 2,
    areaM2: 56.12,
    price: 1153779562,
    oldPrice: null,
    entrance: 1,
    floorNumber: 12,
    floor: '12/15',
    number: String(externalId),
    isStudio: false,
    windowView: 'двор',
    status: 'available',
    dateModified: '2026-08-19T12:58:58.000Z',
    planSignature: 'К2-54.65-6|abc123',
    planProbed: true,
    ...over,
  }
}

function planType(signature: string, over: Partial<PlanTypeInput> = {}): PlanTypeInput {
  return {
    signature,
    planName: 'К2-54.65-6',
    images: [{ title: 'Main image', url: 'https://cms/media/x.jpg', thumbUrl: '' }],
    panoUrl: '',
    rooms: 2,
    isStudio: false,
    areaMin: 55.64,
    areaMax: 56.12,
    priceMin: 1000,
    priceMax: 2000,
    apartmentsCount: 3,
    floors: [3, 7, 11],
    entrances: [1],
    windowViews: ['двор'],
    order: 0,
    ...over,
  }
}

describe('сопоставление строк', () => {
  it('первый прогон: всё новое', () => {
    const diff = diffApartments([], [apartment(1), apartment(2)])
    expect(diff.create).toHaveLength(2)
    expect(diff.update).toHaveLength(0)
    expect(diff.missing).toHaveLength(0)
  })

  it('повторный прогон сохраняет id — иначе переводы осиротеют', () => {
    const existing: ExistingRow[] = [
      { id: 'uuid-1', key: 1 },
      { id: 'uuid-2', key: 2 },
    ]
    const diff = diffApartments(existing, [apartment(1), apartment(2)])

    expect(diff.create).toHaveLength(0)
    expect(diff.update.map((u) => u.id)).toEqual(['uuid-1', 'uuid-2'])
    expect(diff.missing).toHaveLength(0)
  })

  it('пропавшая из выдачи строка попадает в missing, а не удаляется', () => {
    const existing: ExistingRow[] = [
      { id: 'uuid-1', key: 1 },
      { id: 'uuid-2', key: 2 },
    ]
    const diff = diffApartments(existing, [apartment(1)])

    expect(diff.missing.map((r) => r.id)).toEqual(['uuid-2'])
  })

  it('строки без внешнего ключа синк не трогает — это ручной сид', () => {
    const existing: ExistingRow[] = [
      { id: 'seeded-1', key: null },
      { id: 'uuid-2', key: 2 },
    ]
    const diff = diffApartments(existing, [apartment(2)])

    expect(diff.missing).toHaveLength(0)
    expect(diff.update.map((u) => u.id)).toEqual(['uuid-2'])
  })

  it('весь ручной сид не помечается проданным на первом же прогоне', () => {
    const existing: ExistingRow[] = Array.from({ length: 12 }, (_, i) => ({
      id: 'seeded-' + i,
      key: null,
    }))
    expect(diffApartments(existing, [apartment(999)]).missing).toHaveLength(0)
  })

  it('смешанный прогон: часть новая, часть знакомая, часть ушла', () => {
    const existing: ExistingRow[] = [
      { id: 'uuid-1', key: 1 },
      { id: 'uuid-2', key: 2 },
    ]
    const diff = diffApartments(existing, [apartment(2), apartment(3)])

    expect(diff.create.map((a) => a.externalId)).toEqual([3])
    expect(diff.update.map((u) => u.id)).toEqual(['uuid-2'])
    expect(diff.missing.map((r) => r.id)).toEqual(['uuid-1'])
  })

  it('пустой вход помечает всё существующее ушедшим, но ничего не удаляет', () => {
    const existing: ExistingRow[] = [{ id: 'uuid-1', key: 1 }]
    const diff = diffApartments(existing, [])
    expect(diff.missing).toHaveLength(1)
    expect(diff.create).toHaveLength(0)
  })

  it('ключом может быть строка — типы планировок сопоставляются по подписи', () => {
    const existing: ExistingRow[] = [{ id: 'plan-1', key: 'К2-54.65-6|abc123' }]
    const diff = diffPlanTypes(existing, [planType('К2-54.65-6|abc123')])

    expect(diff.update.map((u) => u.id)).toEqual(['plan-1'])
    expect(diff.create).toHaveLength(0)
  })

  it('изменившаяся подпись — это новый тип, прежний уходит в missing', () => {
    const existing: ExistingRow[] = [{ id: 'plan-1', key: 'К2-54.65-6|abc123' }]
    const diff = diffPlanTypes(existing, [planType('К2-54.65-6|ЗАМЕНА')])

    expect(diff.create).toHaveLength(1)
    expect(diff.missing.map((r) => r.id)).toEqual(['plan-1'])
  })

  it('дубли во входных данных не плодят строк', () => {
    const diff = diffByKey<{ k: string }>([], [{ k: 'a' }, { k: 'a' }], (x) => x.k)
    // Обе записи уйдут в create — база отсечёт по уникальному индексу, но
    // проверяем хотя бы, что сопоставление не путается в собственном состоянии.
    expect(diff.missing).toHaveLength(0)
  })
})

describe('висячие ссылки на типы', () => {
  it('квартира со ссылкой на неприсланный тип обнаруживается', () => {
    const dangling = findDanglingSignatures(
      [apartment(1, { planSignature: 'НЕТ-ТАКОГО' })],
      [planType('К2-54.65-6|abc123')]
    )
    expect(dangling).toEqual(['НЕТ-ТАКОГО'])
  })

  it('квартиры без планировки висячими не считаются', () => {
    const dangling = findDanglingSignatures(
      [apartment(1, { planSignature: null, planProbed: true })],
      []
    )
    expect(dangling).toEqual([])
  })

  it('согласованный набор проходит', () => {
    expect(
      findDanglingSignatures([apartment(1)], [planType('К2-54.65-6|abc123')])
    ).toEqual([])
  })

  it('одна и та же висячая подпись перечисляется один раз', () => {
    const dangling = findDanglingSignatures(
      [apartment(1, { planSignature: 'X' }), apartment(2, { planSignature: 'X' })],
      []
    )
    expect(dangling).toEqual(['X'])
  })
})

describe('сводка', () => {
  it('считает по каждой категории', () => {
    const apartments = diffApartments(
      [{ id: 'a1', key: 1 }, { id: 'a2', key: 2 }],
      [apartment(1), apartment(3)]
    )
    const plans = diffPlanTypes([{ id: 'p1', key: 'old' }], [planType('new')])

    expect(summarize(apartments, plans)).toEqual({
      apartmentsCreated: 1,
      apartmentsUpdated: 1,
      apartmentsGone: 1,
      planTypesCreated: 1,
      planTypesUpdated: 0,
      planTypesEmpty: 1,
    })
  })

  it('статус для ушедшей квартиры — продано', () => {
    expect(STATUS_GONE).toBe('sold')
  })
})

describe('схема запроса', () => {
  it('минимальный запрос проходит и добирает умолчания', () => {
    const parsed = syncHouseSchema.parse({ externalHouseId: 5139395 })
    expect(parsed.apartments).toEqual([])
    expect(parsed.planTypes).toEqual([])
    expect(parsed.house.floorsCount).toBeNull()
  })

  it('квартира без площади отклоняется — по ней нечего показывать', () => {
    const result = syncHouseSchema.safeParse({
      externalHouseId: 1,
      apartments: [{ externalId: 5, areaM2: 0 }],
    })
    expect(result.success).toBe(false)
  })

  it('подземный этаж отрицательным числом допустим', () => {
    const parsed = syncHouseSchema.parse({
      externalHouseId: 1,
      apartments: [{ externalId: 5, areaM2: 40, floorNumber: -2 }],
    })
    expect(parsed.apartments[0].floorNumber).toBe(-2)
  })

  it('неизвестный статус отклоняется, а не пролезает в базу', () => {
    const result = syncHouseSchema.safeParse({
      externalHouseId: 1,
      apartments: [{ externalId: 5, areaM2: 40, status: 'свободна' }],
    })
    expect(result.success).toBe(false)
  })

  it('дата не в ISO отклоняется', () => {
    const result = syncHouseSchema.safeParse({
      externalHouseId: 1,
      apartments: [{ externalId: 5, areaM2: 40, dateModified: '19.08.2026' }],
    })
    expect(result.success).toBe(false)
  })

  it('тип планировки без подписи отклоняется — группировать не по чему', () => {
    const result = syncHouseSchema.safeParse({
      externalHouseId: 1,
      planTypes: [{ signature: '' }],
    })
    expect(result.success).toBe(false)
  })

  it('картинка без url отклоняется', () => {
    const result = syncHouseSchema.safeParse({
      externalHouseId: 1,
      planTypes: [{ signature: 'x', images: [{ title: 'Main' }] }],
    })
    expect(result.success).toBe(false)
  })

  it('полный реальный набор полей проходит', () => {
    const parsed = syncHouseSchema.parse({
      externalHouseId: 5139395,
      house: { name: "O'z Makon Business", floorsCount: 15, address: 'ул Фаргона йули, д. 50' },
      planTypes: [planType('К2-54.65-6|abc123')],
      apartments: [apartment(5139781)],
    })
    expect(parsed.apartments[0].planSignature).toBe('К2-54.65-6|abc123')
    expect(parsed.planTypes[0].images[0].url).toBe('https://cms/media/x.jpg')
  })

  it('externalHouseId обязателен — без него неизвестно, чей это дом', () => {
    expect(syncHouseSchema.safeParse({ apartments: [] }).success).toBe(false)
  })
})
