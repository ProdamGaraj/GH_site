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
 * Строит список ширин вариантов из запрошенных размеров экранов.
 *
 * Правила:
 *   - дедуп + округление до целого;
 *   - отбрасываем ширины >= ширины оригинала (не апскейлим);
 *   - отбрасываем слишком мелкие (< minWidth) и нечисловые;
 *   - сортируем по убыванию и режем до maxVariants.
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

  const uniq = Array.from(new Set(cleaned)).sort((a, b) => b - a)
  return uniq.slice(0, maxVariants)
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
