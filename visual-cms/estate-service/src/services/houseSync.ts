/**
 * Решения синхронизации дома: что создать, что обновить, что пометить проданным.
 *
 * Логика вынесена из транзакции чистыми функциями по одной причине — её надо
 * проверять тестами, а тесты у сервиса без базы. Транзакция (SyncController)
 * остаётся тонкой: применить то, что здесь посчитано.
 *
 * Главное правило: НИЧЕГО НЕ УДАЛЯЕМ. Переводы в estate_translations привязаны
 * к id сущности, поэтому пересоздание строки — а именно так работает сид —
 * осиротило бы все переводы на первом же ночном синке. Ушедшая из выдачи
 * квартира получает статус, а не delete; тип планировки без квартир остаётся
 * с нулевым счётчиком.
 */

/** Квартира из CRM в форме, которую присылает синк. */
export interface ApartmentInput {
  externalId: number
  rooms: number
  areaM2: number
  price: number
  oldPrice: number | null
  entrance: number | null
  floorNumber: number | null
  floor: string
  number: string
  isStudio: boolean
  windowView: string
  status: string
  dateModified: string | null
  /** Подпись типа планировки; null — планировки в CRM нет. */
  planSignature: string | null
  /**
   * Синк ходил за планировкой этой квартиры в текущем прогоне.
   *
   * Отличается от «планировка есть»: CRM может честно ответить, что чертежа
   * нет. Без этого признака такие квартиры опрашивались бы каждый прогон,
   * потому что привязки у них так и не появится.
   */
  planProbed: boolean
}

/** Тип планировки из CRM с уже перенесёнными в медиатеку картинками. */
export interface PlanTypeInput {
  signature: string
  planName: string
  images: Array<{ title: string; url: string; thumbUrl: string }>
  panoUrl: string
  rooms: number
  isStudio: boolean
  areaMin: number
  areaMax: number
  priceMin: number
  priceMax: number
  apartmentsCount: number
  floors: number[]
  entrances: number[]
  windowViews: string[]
  order: number
}

export interface ExistingRow {
  id: string
  /** Ключ, по которому строка узнаётся между прогонами. */
  key: string | number | null
}

export interface Diff<TInput> {
  /** Новые строки. */
  create: TInput[]
  /** Существующие: id и что в них записать. */
  update: Array<{ id: string; input: TInput }>
  /** Строки, которых больше нет во входных данных. Удалению НЕ подлежат. */
  missing: ExistingRow[]
}

/**
 * Сопоставляет присланное с тем, что уже в базе.
 *
 * Ключ существующей строки может быть null: так выглядят квартиры, заведённые
 * руками до подключения CRM. Они не имеют отношения к синку и в missing не
 * попадают — иначе первый же прогон пометил бы весь ручной сид проданным.
 */
export function diffByKey<TInput>(
  existing: ExistingRow[],
  incoming: TInput[],
  keyOf: (input: TInput) => string | number
): Diff<TInput> {
  const byKey = new Map<string | number, ExistingRow>()
  for (const row of existing) {
    if (row.key === null || row.key === undefined) continue
    byKey.set(row.key, row)
  }

  const create: TInput[] = []
  const update: Array<{ id: string; input: TInput }> = []
  const seen = new Set<string | number>()

  for (const input of incoming) {
    const key = keyOf(input)
    seen.add(key)
    const row = byKey.get(key)
    if (row) update.push({ id: row.id, input })
    else create.push(input)
  }

  const missing = existing.filter(
    (row) => row.key !== null && row.key !== undefined && !seen.has(row.key)
  )

  return { create, update, missing }
}

export function diffApartments(
  existing: ExistingRow[],
  incoming: ApartmentInput[]
): Diff<ApartmentInput> {
  return diffByKey(existing, incoming, (a) => a.externalId)
}

export function diffPlanTypes(
  existing: ExistingRow[],
  incoming: PlanTypeInput[]
): Diff<PlanTypeInput> {
  return diffByKey(existing, incoming, (p) => p.signature)
}

/**
 * Статус для квартиры, пропавшей из выдачи CRM.
 *
 * Мы запрашиваем только свободные, поэтому исчезновение означает «больше не
 * продаётся»: продана, забронирована или снята. Различить нельзя, и «продана» —
 * безопасное предположение: показать проданную как свободную хуже, чем наоборот.
 */
export const STATUS_GONE = 'sold'

export interface SyncSummary {
  apartmentsCreated: number
  apartmentsUpdated: number
  apartmentsGone: number
  planTypesCreated: number
  planTypesUpdated: number
  planTypesEmpty: number
}

export function summarize(
  apartments: Diff<ApartmentInput>,
  planTypes: Diff<PlanTypeInput>
): SyncSummary {
  return {
    apartmentsCreated: apartments.create.length,
    apartmentsUpdated: apartments.update.length,
    apartmentsGone: apartments.missing.length,
    planTypesCreated: planTypes.create.length,
    planTypesUpdated: planTypes.update.length,
    planTypesEmpty: planTypes.missing.length,
  }
}

/**
 * Проверяет, что каждая квартира ссылается на присланный тип.
 *
 * Ссылка на подпись, которой нет в planTypes, означала бы рассинхрон на стороне
 * синка. Молча обнулять такую привязку нельзя: квартира тихо потеряла бы
 * планировку, и понять почему было бы не по чему.
 */
export function findDanglingSignatures(
  apartments: ApartmentInput[],
  planTypes: PlanTypeInput[]
): string[] {
  const known = new Set(planTypes.map((p) => p.signature))
  const dangling = new Set<string>()
  for (const apartment of apartments) {
    if (apartment.planSignature && !known.has(apartment.planSignature)) {
      dangling.add(apartment.planSignature)
    }
  }
  return [...dangling].sort()
}
