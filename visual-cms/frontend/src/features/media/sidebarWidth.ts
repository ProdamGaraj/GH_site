/**
 * Ширина колонки дерева папок.
 *
 * Пользователь тянет её мышью, значение переживает перезагрузку. Логика здесь,
 * а не в компоненте, потому что границы и разбор сохранённого — это ровно то
 * место, где заводятся «колонка схлопнулась в ноль» и «колонка на весь экран».
 */

/** Уже этого дерево нечитаемо: имена папок обрезаются до пары букв. */
export const SIDEBAR_MIN = 160

/** Шире этого колонка съедает сетку файлов. */
export const SIDEBAR_MAX = 560

/** Совпадает с прежним w-52 — чтобы у тех, кто не тянул, ничего не поехало. */
export const SIDEBAR_DEFAULT = 208

export const SIDEBAR_STORAGE_KEY = 'vcms.media.sidebarWidth'

/**
 * Загоняет ширину в допустимые границы.
 *
 * NaN — это «числа нет» (пустая строка, чужое значение в хранилище), и ему
 * отвечает ширина по умолчанию. Бесконечность — это всё-таки величина, её
 * достаточно прижать к верхней границе.
 */
export function clampSidebarWidth(width: number): number {
  if (Number.isNaN(width)) return SIDEBAR_DEFAULT
  return Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, Math.round(width)))
}

/**
 * Сохранённая ширина.
 *
 * localStorage хранит строки и переживает смену версий приложения, поэтому
 * там может оказаться что угодно — от пустой строки до чужого значения.
 */
export function readSidebarWidth(raw: string | null): number {
  if (raw === null || raw === '') return SIDEBAR_DEFAULT
  return clampSidebarWidth(Number(raw))
}

/**
 * Ширина после перетаскивания.
 *
 * Считается от начальных значений, а не от текущей ширины: так рывок мышью
 * не накапливает ошибку, и возврат курсора в исходную точку возвращает
 * исходную ширину.
 */
export function widthAfterDrag(startWidth: number, startX: number, currentX: number): number {
  return clampSidebarWidth(startWidth + (currentX - startX))
}
