/**
 * Пересчёт viewport-единиц в пиксели для канваса.
 *
 * Канвас — это div фиксированной ширины внутри окна редактора, поэтому `vh`,
 * `vw` и родственные единицы браузер считает от ОКНА РЕДАКТОРА, а не от
 * выбранного экрана: секция с `min-height: 100svh` на канвасе телефона
 * получала высоту окна редактора и растягивалась на два «экрана». Чтобы вид
 * совпадал с сайтом, все такие единицы переводятся в px от экрана канваса.
 *
 * Единый пересчёт для инлайн-стилей узлов (useComputedStyles) и общего CSS
 * страницы/блоков (Canvas) — раньше у каждого был свой, и они расходились:
 * инлайн не понимал `svh`/`dvh`/`lvh` и терял `vw`, если в значении был `vh`.
 */

export interface CanvasViewport {
  /** Ширина экрана канваса, px. */
  width: number
  /** Видимая высота экрана (за вычетом «хрома» браузера), px. Нет — единицы высоты не трогаем. */
  height?: number
}

/**
 * Число + единица. Перед числом не должно быть буквы, цифры, точки, `#` или
 * дефиса — иначе это часть имени (`--gap-2vw`), цвета или другого числа.
 * Префиксы s/d/l (small/dynamic/large) на канвасе равны обычной единице:
 * панелей браузера, которые их различают, здесь нет.
 */
const VIEWPORT_UNIT = /(^|[^\w.#-])(-?\d*\.?\d+)(?:s|d|l)?(vh|vw|vmin|vmax)\b/gi

const round = (px: number): number => Math.round(px * 1000) / 1000

/** Переводит viewport-единицы в строке (значение стиля или целый CSS) в px. */
export function convertViewportUnits(value: string, viewport: CanvasViewport): string {
  if (typeof value !== 'string' || !/v(h|w|min|max)\b/i.test(value)) return value
  const { width, height } = viewport
  if (!(width > 0)) return value

  return value.replace(VIEWPORT_UNIT, (match, before: string, num: string, unit: string) => {
    const amount = parseFloat(num)
    let base: number | undefined
    switch (unit.toLowerCase()) {
      case 'vw':
        base = width
        break
      case 'vh':
        base = height
        break
      case 'vmin':
        base = height ? Math.min(width, height) : undefined
        break
      case 'vmax':
        base = height ? Math.max(width, height) : undefined
        break
    }
    if (!base || Number.isNaN(amount)) return match
    return `${before}${round((amount / 100) * base)}px`
  })
}
