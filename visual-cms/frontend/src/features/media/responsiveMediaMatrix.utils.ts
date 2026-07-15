/**
 * Чистые хелперы матрицы адаптивного медиа (для юнит-тестов).
 */
import type { BlockNode } from '@/shared/types'

export type MediaSlot = 'src' | 'bg'

/** Голый URL из CSS background-image: url("…"). null для градиентов/сложных значений. */
export function parseCssUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const v = value.trim()
  const m =
    v.match(/^url\(\s*"([^"]*)"\s*\)$/i) ||
    v.match(/^url\(\s*'([^']*)'\s*\)$/i) ||
    v.match(/^url\(\s*([^'")]+?)\s*\)$/i)
  return m?.[1]?.trim() || null
}

// ── Многослойные фоны (background shorthand / стек background-image) ────────
// Импортированные страницы часто хранят фон как
// `background: linear-gradient(...), url("...") center / cover` — url-слой
// нужно уметь находить и заменять, не разрушая градиенты и позиционирование.

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
 * Пишет в то свойство, где фон реально живёт:
 *  - url-слой в `background` shorthand → замена/удаление слоя внутри shorthand;
 *  - `backgroundImage` (в т.ч. стек с градиентами) → замена url / удаление url-слоёв;
 *  - фона нет → новый `backgroundImage: url("…")`.
 * Пустое значение в патче означает «удалить свойство» (семантика updateNodeStyles).
 */
export function bgUrlPatch(props: BgProps | undefined | null, url: string): Record<string, string> {
  const bi = props?.backgroundImage || ''
  const bg = props?.background || ''

  if (/url\(/i.test(bi)) {
    return { backgroundImage: url ? replaceCssUrl(bi, url) : removeUrlLayers(bi) }
  }
  if (/url\(/i.test(bg)) {
    return { background: url ? replaceCssUrl(bg, url) : removeUrlLayers(bg) }
  }
  if (!url) return { backgroundImage: '' }
  // Фона-картинки не было: если backgroundImage — чистые градиенты, дописываем слой.
  if (bi.trim()) return { backgroundImage: `${bi}, url("${url.replace(/"/g, '%22')}")` }
  return { backgroundImage: `url("${url.replace(/"/g, '%22')}")` }
}

/**
 * Полный стек background-image для override/перевода: градиентные слои базы +
 * новый url на месте базового url-слоя. Сохраняет затемнение (linear-gradient)
 * при подмене фона под экран/язык. Без градиентов — просто url("…").
 */
export function composeBgStack(props: BgProps | undefined | null, url: string): string {
  const wrapped = `url("${url.replace(/"/g, '%22')}")`
  const source = /url\(/i.test(props?.backgroundImage || '')
    ? props?.backgroundImage || ''
    : /url\(/i.test(props?.background || '')
      ? props?.background || ''
      : ''
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
    // Прочие слои shorthand (цвет, позиция без картинки) — не image-слои, пропускаем.
  }
  if (!replaced) stack.push(wrapped)
  return stack.join(', ')
}

/**
 * Поле перевода для слота (+ суффикс брейкпоинта):
 *   src → 'src' | 'src@<bp>'; bg → 'bg:image' | 'bg:image@<bp>'.
 */
export function translationField(slot: MediaSlot, bpId: string | null): string {
  const base = slot === 'src' ? 'src' : 'bg:image'
  return bpId ? `${base}@${bpId}` : base
}

/** Экранный оверрайд узла на брейкпоинте: ищем inheritedOverrides по всему дереву. */
export function findOverride(
  root: BlockNode | null,
  nodeId: string,
  bpId: string,
): { attributes?: Record<string, string>; styles?: Record<string, string> } | null {
  if (!root) return null
  let found: { attributes?: Record<string, string>; styles?: Record<string, string> } | null = null
  const walk = (n: BlockNode): void => {
    if (found) return
    const ov = n.variations?.[bpId]?.inheritedOverrides?.[nodeId]
    if (ov) {
      found = ov as { attributes?: Record<string, string>; styles?: Record<string, string> }
      return
    }
    for (const c of n.children || []) walk(c)
    if (n.variations) {
      for (const v of Object.values(n.variations)) {
        for (const sc of v.specificChildren || []) walk(sc)
      }
    }
  }
  walk(root)
  return found
}
