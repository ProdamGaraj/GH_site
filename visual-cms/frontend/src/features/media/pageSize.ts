/**
 * Размер страницы медиатеки: сколько файлов показывать за раз.
 *
 * Настройка пользовательская и сохраняемая, поэтому разбор хранилища и
 * пересчёт номера страницы живут здесь, а не в компоненте: именно в этих двух
 * местах заводятся «страница 7 из 3» и «после смены размера выкинуло в начало».
 */

/** Варианты в выпадающем списке. Кратны сетке, чтобы ряды не рвались. */
export const PAGE_SIZE_OPTIONS = [12, 24, 48, 96] as const

export const PAGE_SIZE_DEFAULT = 12

export const PAGE_SIZE_STORAGE_KEY = 'vcms.media.pageSize'

/**
 * Сохранённый размер страницы.
 *
 * Принимаем только значения из списка: произвольное число из хранилища
 * (чужая версия, ручная правка) рассыпало бы раскладку сетки.
 */
export function readPageSize(raw: string | null): number {
  const value = Number(raw)
  return (PAGE_SIZE_OPTIONS as readonly number[]).includes(value) ? value : PAGE_SIZE_DEFAULT
}

/** Сколько всего страниц. Пустая выдача — это одна пустая страница, а не ноль. */
export function countPages(total: number, pageSize: number): number {
  if (!Number.isFinite(total) || total <= 0) return 1
  if (!Number.isFinite(pageSize) || pageSize <= 0) return 1
  return Math.max(1, Math.ceil(total / pageSize))
}

/** Держит номер страницы в пределах: после смены фильтра он может оказаться за концом. */
export function clampPage(page: number, totalPages: number): number {
  if (!Number.isFinite(page)) return 1
  return Math.min(Math.max(1, Math.round(page)), Math.max(1, totalPages))
}

/**
 * Номер страницы после смены её размера.
 *
 * Считаем по позиции первого файла на экране: человек смотрел на определённое
 * место выдачи, и выкидывать его в начало при переключении «показывать по 48»
 * — потеря контекста. При 12 на странице третья страница начинается с 25-го
 * файла; при 48 тот же файл лежит на первой.
 */
export function pageAfterSizeChange(page: number, oldSize: number, newSize: number): number {
  if (!Number.isFinite(newSize) || newSize <= 0) return 1
  const firstIndex = Math.max(0, (clampPage(page, Number.MAX_SAFE_INTEGER) - 1) * oldSize)
  return Math.floor(firstIndex / newSize) + 1
}
