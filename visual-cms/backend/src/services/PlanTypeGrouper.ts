/**
 * Сборка типов планировок из ответов MacroCRM.
 *
 * MacroCRM отдаёт планировку по одной квартире (getFlatPlans, один estateId за
 * вызов), но планировки типовые: десятки квартир делят один чертёж. На странице
 * показываются именно типы, а фильтры работают по агрегатам квартир внутри типа.
 *
 * Ключ группировки — planName плюс набор файлов. Одного planName мало: имена
 * вида «К2-54.65-6» уникальны в пределах корпуса, но не гарантированно между
 * домами. Площадь в ключ не входит: число внутри planName ей не равно (у
 * квартиры 5139408 planName «К2-54.65-6» при areaTotal 56.12), а сама площадь
 * внутри одного типа гуляет на сотые доли.
 *
 * ВАЖНО про ссылки. URL файлов планировки подписан и истекает:
 *   /estate/files/tmp/5139395/3707992/<подпись>eyJlIjoxNzg5MTI4MDAwfQ/planirovka.jpg
 * хвост сегмента подписи — base64 от {"e":1789128000}, то есть срок годности.
 * Между прогонами синка подпись меняется. Поэтому в ключ идёт СТАБИЛЬНАЯ часть
 * ссылки — числовой id файла и имя, — а не URL целиком: иначе каждый прогон
 * плодил бы новые типы, upsert перестал бы находить прежние, и переводы,
 * привязанные к id типа, осиротели бы на первом же синке.
 */

import { createHash } from 'crypto'
import type { MacroFlatPlan, MacroPlanFile } from './MacroSellClient'
import type { ApartmentPayload } from './MacroEstateMapper'

export interface PlanTypePayload {
  /** Ключ группировки, стабильный между прогонами. */
  signature: string
  planName: string
  externalHouseId: number
  images: MacroPlanFile[]
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

  /** Внешние id квартир этого типа — по ним проставляется planTypeId. */
  apartmentExternalIds: number[]
}

/** Результат опроса планировки одной квартиры. */
export interface PlanProbe {
  estateId: number
  plan: MacroFlatPlan | null
}

export interface GroupResult {
  planTypes: PlanTypePayload[]
  /** Квартиры, для которых планировки нет: их не опросили или CRM её не знает. */
  unassigned: ApartmentPayload[]
}

/**
 * Стабильная часть ссылки на файл: «<id файла>/<имя>».
 *
 * Путь у Macro выглядит как /estate/files/tmp/<houseId>/<fileId>/<подпись>/<имя>.
 * Меняется только подпись, поэтому берём id файла и имя. Если формат окажется
 * другим — падать нельзя, откатываемся на имя файла, а в крайнем случае на весь
 * URL: тип соберётся хуже, но соберётся.
 */
export function stableFileKey(url: string): string {
  const withoutQuery = url.split('?')[0]
  const segments = withoutQuery.split('/').filter(Boolean)
  const fileName = segments[segments.length - 1] ?? withoutQuery

  // Ищем последний чисто числовой сегмент — это id файла. Числовой houseId
  // идёт раньше, поэтому «последний» и берём.
  let fileId = ''
  for (let i = segments.length - 1; i >= 0; i--) {
    if (/^\d+$/.test(segments[i])) {
      fileId = segments[i]
      break
    }
  }

  if (fileId && fileName) return `${fileId}/${fileName}`
  if (fileName) return fileName
  return withoutQuery
}

/** Ключ набора файлов: отсортированные стабильные ключи, свёрнутые в хеш. */
export function filesKey(files: MacroPlanFile[]): string {
  const keys = files.map((f) => stableFileKey(f.url)).sort()
  if (keys.length === 0) return 'nofiles'
  return createHash('sha1').update(keys.join('|')).digest('hex').slice(0, 16)
}

/** Максимальная длина колонки signature. */
const SIGNATURE_MAX = 200

/**
 * Ключ типа — имя планировки, и только оно.
 *
 * Набор файлов в ключ НЕ входит, хотя это и кажется естественным. На живых
 * данных дома 5139395 внутри одного имени лежат разные наборы файлов, но это
 * один и тот же чертёж, переэкспортированный под каждую площадь:
 *
 *   planirovka_k3-76_64-5-77.96.jpg
 *   planirovka_k3-76_64-5-77.9.jpg
 *   planirovka_k3-76_64-5-77.01.jpg
 *
 * Базовое имя общее, меняется только штамп площади. Включив файлы в ключ, мы
 * получили бы 134 типа вместо 105 — то есть разбили бы обратно ровно то, что
 * собирались склеить.
 *
 * Файлы остаются запасным ключом для планировок без имени: у таких группировать
 * больше не по чему.
 */
export function buildSignature(plan: MacroFlatPlan): string {
  const name = plan.planName.trim()
  const signature = name || `unnamed|${filesKey(plan.files)}`
  return signature.length <= SIGNATURE_MAX ? signature : signature.slice(0, SIGNATURE_MAX)
}

/**
 * Какой набор файлов показывать, когда внутри типа их несколько.
 *
 * Берём самый полный: у одних вариантов только основной чертёж, у других есть
 * и план с мебелью, и дополнительный ракурс. Показать три картинки лучше, чем
 * одну. При равенстве — первый по алфавиту, чтобы выбор не плавал между
 * прогонами и импортёр картинок не качал каждый раз новое.
 */
function richestPlan(plans: MacroFlatPlan[]): MacroFlatPlan {
  return [...plans].sort(
    (a, b) => b.files.length - a.files.length || filesKey(a.files).localeCompare(filesKey(b.files))
  )[0]
}

function uniqueSorted(values: number[]): number[] {
  return [...new Set(values)].sort((a, b) => a - b)
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter((v) => v !== ''))].sort()
}

/**
 * Собирает типы из квартир и опрошенных планировок.
 *
 * Агрегаты считаются по тем квартирам, что переданы: фильтрацию «только в
 * продаже» делает вызывающий, чтобы проданные не задирали количество и не
 * занижали цену.
 *
 * Порядок типов — по комнатности, затем по площади. По имени сортировать
 * бессмысленно: «К2-54.65-6» ничего не говорит покупателю о размере.
 */
export function groupPlanTypes(
  apartments: ApartmentPayload[],
  probes: PlanProbe[]
): GroupResult {
  const planByEstateId = new Map<number, MacroFlatPlan>()
  for (const probe of probes) {
    if (probe.plan) planByEstateId.set(probe.estateId, probe.plan)
  }

  const buckets = new Map<string, { plans: MacroFlatPlan[]; items: ApartmentPayload[] }>()
  const unassigned: ApartmentPayload[] = []

  for (const apartment of apartments) {
    const plan = planByEstateId.get(apartment.externalId)
    if (!plan) {
      unassigned.push(apartment)
      continue
    }
    // Дом входит в ключ: одинаковое имя планировки в разных корпусах — это
    // разные чертежи, и уникальный индекс в базе стоит на паре (дом, ключ).
    const key = `${apartment.externalHouseId}::${buildSignature(plan)}`
    const bucket = buckets.get(key)
    if (bucket) {
      bucket.items.push(apartment)
      bucket.plans.push(plan)
    } else {
      buckets.set(key, { plans: [plan], items: [apartment] })
    }
  }

  const planTypes: PlanTypePayload[] = []
  for (const { plans, items } of buckets.values()) {
    const plan = richestPlan(plans)
    const areas = items.map((a) => a.areaM2)
    const prices = items.map((a) => a.price).filter((p) => p > 0)
    const floors = items.map((a) => a.floorNumber).filter((f): f is number => f !== null)
    const entrances = items.map((a) => a.entrance).filter((e): e is number => e !== null)

    planTypes.push({
      signature: buildSignature(plan),
      planName: plan.planName,
      externalHouseId: items[0].externalHouseId,
      images: plan.files,
      // Тур привязан к квартире, а не к типу, и есть примерно у половины.
      // Берём первый попавшийся: показать один тур типовой планировки лучше,
      // чем не показать ни одного.
      panoUrl: items.find((a) => a.panoUrl !== '')?.panoUrl ?? '',

      rooms: items[0].rooms,
      isStudio: items.every((a) => a.isStudio),
      areaMin: Math.min(...areas),
      areaMax: Math.max(...areas),
      priceMin: prices.length ? Math.min(...prices) : 0,
      priceMax: prices.length ? Math.max(...prices) : 0,

      apartmentsCount: items.length,
      floors: uniqueSorted(floors),
      entrances: uniqueSorted(entrances),
      windowViews: uniqueStrings(items.map((a) => a.windowView)),
      order: 0,
      apartmentExternalIds: items.map((a) => a.externalId).sort((a, b) => a - b),
    })
  }

  planTypes.sort((a, b) => a.rooms - b.rooms || a.areaMin - b.areaMin)
  planTypes.forEach((planType, index) => {
    planType.order = index
  })

  return { planTypes, unassigned }
}

/**
 * Какие квартиры надо опросить в этом прогоне.
 *
 * Первый обход дома стоит вызов на квартиру — для наших двух домов это 339
 * запросов, около четырёх минут. Дальше опрашиваются только новые и те, у кого
 * в CRM поменялся dateModified: без этого отбора каждый ночной синк заново
 * съедал бы весь лимит.
 */
export interface KnownProbe {
  externalId: number
  /** dateModified на момент последнего опроса. */
  dateModified: string | null
  /**
   * Когда за планировкой ходили в последний раз. null — не ходили ни разу.
   *
   * Именно отметка об опросе, а не наличие привязки: CRM может честно ответить,
   * что чертежа нет, и по наличию типа такая квартира опрашивалась бы вечно.
   */
  probedAt: string | null
}

export function selectProbeTargets(
  apartments: ApartmentPayload[],
  known: KnownProbe[]
): ApartmentPayload[] {
  const byId = new Map(known.map((k) => [k.externalId, k]))
  return apartments.filter((apartment) => {
    const prev = byId.get(apartment.externalId)
    if (!prev) return true
    if (!prev.probedAt) return true
    return prev.dateModified !== apartment.dateModified
  })
}
