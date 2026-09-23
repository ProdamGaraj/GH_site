/**
 * Склейка типов планировок для витрины.
 *
 * MacroCRM отдаёт отдельный чертёж на каждое положение квартиры на этаже:
 * зеркальные пары и повороты одной планировки приходят разными файлами. Ключ
 * синхронизации включает хеш набора файлов, поэтому в базе они лежат разными
 * типами — у Doʼstlik до семи штук на одну площадь. В каталоге это выглядело
 * как семь одинаковых карточек: заголовок, класс, площадь и цена совпадают, а
 * разворот в плашке 176 px не разглядеть.
 *
 * Почему правило настраиваемое, а не зашитое. Проекты нумеруются по-разному:
 * у Doʼstlik имена планировок вида «13», «3_13», у ozmakon-business —
 * «К1-39.31-6». Ни то ни другое не даёт надёжного признака «это одна
 * планировка»: у ozmakon проектные площади в именах уникальны, а суффикс не
 * совпадает с подъездом (проверено на всех 49 типах). Единственный общий
 * сигнал — фактическая площадь, но допуск у проектов разный. Поэтому допуск и
 * ручные правки лежат в настройке каждого ЖК, а не в коде.
 *
 * Склейка идёт на ЧТЕНИИ, не в синхронизации: CRM-гранулярность в базе
 * сохраняется, правило меняется без пересинка, чертежи всех вариантов
 * собираются в галерею одной карточки.
 *
 * Чистый модуль без БД.
 */

import { PlanTypeRow } from './i18n'

/** Настройка склейки для одного ЖК. Хранится в `complexes.planGrouping`. */
export interface PlanGroupingConfig {
  /**
   * Допуск по площади, м². Планировки в пределах допуска считаются одной.
   *
   * 0 — склеивать только точные совпадения (безопасный режим по умолчанию).
   * Подобрать значение помогает `preview-plan-groups.ts`.
   */
  areaTolerance?: number
  /** Принудительно объединить перечисленные планировки (по `planName`). */
  groups?: Array<{ plans: string[] }>
  /** Никогда не склеивать эти планировки ни с чем. */
  keepSeparate?: string[]
}

/** Значения по умолчанию: ничего не склеиваем сверх точных совпадений. */
export const DEFAULT_GROUPING: Required<PlanGroupingConfig> = {
  areaTolerance: 0,
  groups: [],
  keepSeparate: [],
}

export function normalizeConfig(config?: PlanGroupingConfig | null): Required<PlanGroupingConfig> {
  const tolerance = Number(config?.areaTolerance)
  return {
    areaTolerance: Number.isFinite(tolerance) && tolerance > 0 ? tolerance : 0,
    groups: Array.isArray(config?.groups)
      ? config!.groups!.filter((g) => Array.isArray(g?.plans) && g.plans.length > 1)
      : [],
    keepSeparate: Array.isArray(config?.keepSeparate) ? config!.keepSeparate!.filter(Boolean) : [],
  }
}

function num(value: string | number): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

/**
 * Ведро, внутри которого планировки вообще сравнимы.
 *
 * Дом входит в ключ: одинаковая площадь в разных корпусах — это разные
 * квартиры, и подъезды у них нумеруются независимо.
 */
function bucketKey(row: PlanTypeRow): string {
  return [row.houseId, row.rooms, row.isStudio ? 's' : ''].join('|')
}

/**
 * Кластеризация по площади одиночной связью.
 *
 * Планировки сортируются по площади; следующая присоединяется к текущему
 * кластеру, если её минимум отстоит от максимума кластера не больше чем на
 * допуск. Одиночная связь выбрана намеренно: цепочка 39.79 → 39.80 → 40.03
 * при допуске 0.25 — это один ряд почти одинаковых квартир, и разрывать его
 * посередине было бы произвольно.
 */
function clusterByArea(rows: PlanTypeRow[], tolerance: number): PlanTypeRow[][] {
  const sorted = [...rows].sort((a, b) => num(a.areaMin) - num(b.areaMin))
  const clusters: PlanTypeRow[][] = []
  let current: PlanTypeRow[] = []
  let currentMax = 0

  for (const row of sorted) {
    if (current.length === 0) {
      current = [row]
      currentMax = num(row.areaMax)
      continue
    }
    if (num(row.areaMin) - currentMax <= tolerance) {
      current.push(row)
      currentMax = Math.max(currentMax, num(row.areaMax))
    } else {
      clusters.push(current)
      current = [row]
      currentMax = num(row.areaMax)
    }
  }
  if (current.length) clusters.push(current)
  return clusters
}

function uniqueSortedNumbers(values: number[]): number[] {
  return [...new Set(values.filter((v) => Number.isFinite(v)))].sort((a, b) => a - b)
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const v of values) {
    const t = (v || '').trim()
    if (!t || seen.has(t)) continue
    seen.add(t)
    out.push(t)
  }
  return out
}

function dedupeImages(images: PlanTypeRow['images']): PlanTypeRow['images'] {
  const seen = new Set<string>()
  const out: PlanTypeRow['images'] = []
  for (const img of images) {
    const url = (img?.url || '').trim()
    if (!url || seen.has(url)) continue
    seen.add(url)
    out.push(img)
  }
  return out
}

/**
 * Сливает группу в один тип.
 *
 * Представитель — первый по `order`: от него наследуются id, подпись и имя,
 * чтобы ссылки и переводы указывали на стабильную строку. Остальное
 * объединяется: покупатель видит суммарное число квартир, полный диапазон
 * площадей и этажей и все подъезды, где планировка встречается.
 */
export function mergeGroup(rows: PlanTypeRow[]): PlanTypeRow {
  const ordered = [...rows].sort((a, b) => a.order - b.order)
  const [first] = ordered
  if (ordered.length === 1) return first

  const minPrices = ordered.map((r) => num(r.priceMin)).filter((p) => p > 0)
  const maxPrices = ordered.map((r) => num(r.priceMax)).filter((p) => p > 0)

  return {
    ...first,
    areaMin: Math.min(...ordered.map((r) => num(r.areaMin))),
    areaMax: Math.max(...ordered.map((r) => num(r.areaMax))),
    priceMin: minPrices.length ? Math.min(...minPrices) : 0,
    priceMax: maxPrices.length ? Math.max(...maxPrices) : 0,
    apartmentsCount: ordered.reduce((sum, r) => sum + (r.apartmentsCount || 0), 0),
    floors: uniqueSortedNumbers(ordered.flatMap((r) => (Array.isArray(r.floors) ? r.floors : []))),
    entrances: uniqueSortedNumbers(
      ordered.flatMap((r) => (Array.isArray(r.entrances) ? r.entrances : []))
    ),
    windowViews: uniqueStrings(
      ordered.flatMap((r) => (Array.isArray(r.windowViews) ? r.windowViews : []))
    ),
    // Чертежи всех вариантов идут в галерею карточки: зеркальные развороты
    // никуда не деваются, покупатель листает их внутри одной планировки.
    images: dedupeImages(ordered.flatMap((r) => (Array.isArray(r.images) ? r.images : []))),
    panoUrl: ordered.find((r) => (r.panoUrl || '').trim())?.panoUrl || '',
  }
}

/** Группа до слияния — то, что показывает предпросмотр. */
export interface PlanGroup {
  rows: PlanTypeRow[]
  /** Склеена вручную из настройки, а не автоматически по площади. */
  manual: boolean
}

/**
 * Разбивает типы на группы, не сливая их.
 *
 * Отдельно от `mergePlanTypes`, чтобы предпросмотр мог показать состав групп
 * до применения и подобрать допуск по факту, а не на глаз.
 */
export function planGroups(rows: PlanTypeRow[], config?: PlanGroupingConfig | null): PlanGroup[] {
  const cfg = normalizeConfig(config)
  const separate = new Set(cfg.keepSeparate)

  // Ручные группы разбираются первыми и выводятся из автоматического разбора.
  const byName = new Map<string, PlanTypeRow>()
  for (const row of rows) if (!byName.has(row.planName)) byName.set(row.planName, row)

  const taken = new Set<PlanTypeRow>()
  const manualGroups: PlanGroup[] = []
  for (const group of cfg.groups) {
    const picked = group.plans
      .map((name) => byName.get(name))
      .filter((r): r is PlanTypeRow => !!r && !taken.has(r))
    if (picked.length < 2) continue
    picked.forEach((r) => taken.add(r))
    manualGroups.push({ rows: picked, manual: true })
  }

  const rest = rows.filter((r) => !taken.has(r))
  const auto: PlanGroup[] = []
  const buckets = new Map<string, PlanTypeRow[]>()
  for (const row of rest) {
    // Выведенные из склейки идут отдельными группами сразу.
    if (separate.has(row.planName)) {
      auto.push({ rows: [row], manual: false })
      continue
    }
    const key = bucketKey(row)
    const bucket = buckets.get(key)
    if (bucket) bucket.push(row)
    else buckets.set(key, [row])
  }
  for (const bucket of buckets.values()) {
    for (const cluster of clusterByArea(bucket, cfg.areaTolerance)) {
      auto.push({ rows: cluster, manual: false })
    }
  }

  // Порядок карточек на странице задаёт `order`: сортируем по представителю.
  return [...manualGroups, ...auto].sort(
    (a, b) => Math.min(...a.rows.map((r) => r.order)) - Math.min(...b.rows.map((r) => r.order))
  )
}

/** Склеивает типы планировок по настройке ЖК. */
export function mergePlanTypes(
  rows: PlanTypeRow[],
  config?: PlanGroupingConfig | null
): PlanTypeRow[] {
  return planGroups(rows, config).map((g) => mergeGroup(g.rows))
}
