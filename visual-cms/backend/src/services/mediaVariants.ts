/**
 * Планирование адаптивных вариантов изображения (pure, без sharp/БД).
 *
 * Вынесено отдельно, чтобы:
 *   1) логику выбора ширин можно было юнит-тестировать без MinIO/sharp;
 *   2) переиспользовать в upload и в backfill-скрипте (DRY).
 */

export interface VariantPlanOptions {
  /** Максимум вариантов (защита от взрыва числа файлов/CPU). */
  maxVariants?: number
  /** Минимальная ширина варианта (меньше — игнорируем). */
  minWidth?: number
}

const DEFAULT_MAX_VARIANTS = 6
const DEFAULT_MIN_WIDTH = 16

/**
 * Выбирает `count` ширин из отсортированного по возрастанию списка так, чтобы
 * они покрывали весь диапазон от самой узкой до самой широкой.
 *
 * Шаг — равномерный по отношению ширин (логарифмический), а не по разнице:
 * между 375 и 768 разница в весе файла такая же, как между 1920 и 3840.
 * Крайние ширины берутся всегда, между ними — ближайшие к расчётным точкам.
 *
 * Раньше брали `count` самых широких: у фото шириной 7000px получались только
 * 1512…3840, и телефону нечего было скачать, кроме полноразмерной картинки.
 */
export function spreadWidths(ascending: number[], count: number): number[] {
  if (count <= 0) return []
  if (ascending.length <= count) return [...ascending]
  if (count === 1) return [ascending[ascending.length - 1]]

  const min = ascending[0]
  const max = ascending[ascending.length - 1]
  const picked = new Set<number>([min, max])
  const free = ascending.slice(1, -1)

  for (let i = 1; i < count - 1; i++) {
    const target = min * Math.pow(max / min, i / (count - 1))
    let best = -1
    let bestDistance = Infinity
    free.forEach((w, index) => {
      if (picked.has(w)) return
      const distance = Math.abs(Math.log(w / target))
      if (distance < bestDistance) {
        bestDistance = distance
        best = index
      }
    })
    if (best >= 0) picked.add(free[best])
  }
  return Array.from(picked).sort((a, b) => a - b)
}

/**
 * Строит список ширин вариантов из запрошенных размеров экранов.
 *
 * Правила:
 *   - дедуп + округление до целого;
 *   - отбрасываем ширины >= ширины оригинала (не апскейлим);
 *   - отбрасываем слишком мелкие (< minWidth) и нечисловые;
 *   - если ширин больше maxVariants — берём их равномерно от телефона до
 *     самого широкого экрана (см. spreadWidths);
 *   - результат — по убыванию.
 *
 * @param originalWidth ширина оригинала (px). null/0/неизвестно — лимит не применяется.
 */
export function buildVariantPlan(
  originalWidth: number | null | undefined,
  requestedWidths: number[],
  opts: VariantPlanOptions = {},
): number[] {
  const maxVariants = opts.maxVariants ?? DEFAULT_MAX_VARIANTS
  const minWidth = opts.minWidth ?? DEFAULT_MIN_WIDTH
  const orig = originalWidth && originalWidth > 0 ? originalWidth : Infinity

  const cleaned = (requestedWidths || [])
    .map((w) => Math.round(Number(w)))
    .filter((w) => Number.isFinite(w) && w >= minWidth && w < orig)

  const ascending = Array.from(new Set(cleaned)).sort((a, b) => a - b)
  return spreadWidths(ascending, maxVariants).sort((a, b) => b - a)
}

export interface VariantChanges {
  /** Каких размеров не хватает — создать. */
  create: number[]
  /** Лишние размеры (нет в плане) — удалить. Пусто, пока не просили чистить. */
  remove: number[]
}

/**
 * Что сделать с размерами уже загруженной картинки, чтобы они совпали с планом.
 *
 * Лишние размеры по умолчанию остаются: на них ссылаются уже опубликованные
 * страницы (`srcset`), и удаление до передеплоя дало бы битые картинки.
 * `prune` — убрать их, когда сайт уже передеплоен.
 */
export function planVariantChanges(
  existingWidths: number[],
  plan: number[],
  opts: { prune?: boolean } = {},
): VariantChanges {
  const existing = new Set(existingWidths)
  const wanted = new Set(plan)
  return {
    create: plan.filter((w) => !existing.has(w)),
    remove: opts.prune ? Array.from(existing).filter((w) => !wanted.has(w)).sort((a, b) => b - a) : [],
  }
}

/**
 * Парсит ширины вариантов из тела multipart-запроса.
 * Принимает массив строк/чисел или CSV-строку ("1920,1280,768").
 */
export function parseVariantWidths(raw: unknown): number[] {
  if (raw == null) return []
  const parts: string[] = Array.isArray(raw)
    ? raw.map(String)
    : typeof raw === 'string'
      ? raw.split(',')
      : [String(raw)]
  return parts
    .map((s) => parseInt(String(s).trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0)
}
