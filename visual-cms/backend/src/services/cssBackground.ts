/**
 * Хелперы многослойных CSS-фонов (background shorthand / стек background-image).
 *
 * Импортированные страницы часто хранят фон как
 * `background: linear-gradient(...), url("...") center / cover` — url-слой нужно
 * находить и заменять, не разрушая градиенты (затемнение) и позиционирование.
 * Зеркало фронтовых утилит responsiveMediaMatrix.utils (код не шарится).
 */

/** Первый url(...) в произвольном CSS-значении (не только одиночном). */
export function firstCssUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const m =
    value.match(/url\(\s*"([^"]*)"\s*\)/i) ||
    value.match(/url\(\s*'([^']*)'\s*\)/i) ||
    value.match(/url\(\s*([^'")]+?)\s*\)/i)
  return m?.[1]?.trim() || null
}

/** Разбивает CSS-значение по запятым верхнего уровня (скобки учитываются). */
export function splitCssLayers(value: string): string[] {
  const layers: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of value) {
    if (ch === '(') depth++
    else if (ch === ')') depth--
    if (ch === ',' && depth === 0) {
      layers.push(cur.trim())
      cur = ''
    } else {
      cur += ch
    }
  }
  if (cur.trim()) layers.push(cur.trim())
  return layers
}

/** Заменяет ПЕРВОЕ вхождение url(...) на url("newUrl"), остальное значение нетронуто. */
export function replaceCssUrl(value: string, newUrl: string): string {
  const wrapped = `url("${newUrl.replace(/"/g, '%22')}")`
  return value.replace(/url\(\s*(?:"[^"]*"|'[^']*'|[^'")]*?)\s*\)/i, wrapped)
}

/** Удаляет слои с url(...) из значения; вернёт '' если других слоёв нет. */
export function removeUrlLayers(value: string): string {
  return splitCssLayers(value)
    .filter((l) => !/url\(/i.test(l))
    .join(', ')
}

interface BgProps {
  background?: string
  backgroundImage?: string
  [key: string]: unknown
}

/**
 * URL картинки фона узла: из backgroundImage (одиночного или стека) либо
 * из background shorthand. null — фона-картинки нет.
 */
export function extractBgUrl(props: BgProps | undefined | null): string | null {
  if (!props) return null
  return firstCssUrl(props.backgroundImage) ?? firstCssUrl(props.background)
}

/**
 * Патч стилей для установки/очистки картинки фона с сохранением градиентов.
 * Пишет в то свойство, где фон реально живёт. Пустое значение в патче
 * означает «удалить свойство».
 */
export function bgUrlPatch(props: BgProps | undefined | null, url: string): Record<string, string> {
  const bi = typeof props?.backgroundImage === 'string' ? props.backgroundImage : ''
  const bg = typeof props?.background === 'string' ? props.background : ''

  if (/url\(/i.test(bi)) {
    return { backgroundImage: url ? replaceCssUrl(bi, url) : removeUrlLayers(bi) }
  }
  if (/url\(/i.test(bg)) {
    return { background: url ? replaceCssUrl(bg, url) : removeUrlLayers(bg) }
  }
  if (!url) return { backgroundImage: '' }
  if (bi.trim()) return { backgroundImage: `${bi}, url("${url.replace(/"/g, '%22')}")` }
  return { backgroundImage: `url("${url.replace(/"/g, '%22')}")` }
}

/**
 * Полный стек background-image для override/перевода: градиентные слои базы +
 * новый url на месте базового url-слоя (сохраняет затемнение при подмене фона
 * под экран/язык). Без градиентов — просто url("…").
 */
export function composeBgStack(props: BgProps | undefined | null, url: string): string {
  const wrapped = `url("${url.replace(/"/g, '%22')}")`
  const bi = typeof props?.backgroundImage === 'string' ? props.backgroundImage : ''
  const bg = typeof props?.background === 'string' ? props.background : ''
  const source = /url\(/i.test(bi) ? bi : /url\(/i.test(bg) ? bg : ''
  if (!source) return wrapped

  const layers = splitCssLayers(source)
  const stack: string[] = []
  let replaced = false
  for (const layer of layers) {
    if (/url\(/i.test(layer)) {
      // Слой с url: берём только картинку (позиция/размер shorthand-слоя
      // в background-image недопустимы).
      if (!replaced) {
        stack.push(wrapped)
        replaced = true
      }
    } else if (/gradient\(/i.test(layer)) {
      stack.push(layer)
    }
  }
  if (!replaced) stack.push(wrapped)
  return stack.join(', ')
}
