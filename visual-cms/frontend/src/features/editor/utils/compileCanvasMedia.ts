/**
 * «Компиляция» @media под ширину экрана канваса.
 *
 * Проблема: канвас вставляет общий CSS обычным <style> в DOM редактора, а
 * «экран» рисуется фиксированным <div> + transform:scale. Поэтому `@media
 * (max-width: …)` считается от ОКНА РЕДАКТОРА, а не от выбранного брейкпоинта —
 * адаптив (сборка меню в бургер и т.п.) в канвасе не срабатывает. Для vw/vh уже
 * делается аналогичный пересчёт; здесь — то же для @media.
 *
 * Что делаем: чисто размерные запросы (`max-width`/`min-width` в px, возможно
 * через `and`, с префиксом media-type `screen`/`all`/`only`) вычисляем против
 * ширины брейкпоинта:
 *   - подходит  → разворачиваем внутренние правила (без обёртки @media);
 *   - не подходит → выкидываем блок.
 * Всё, что не можем вычислить (prefers-reduced-motion, orientation, hover,
 * единицы em/rem, диапазонный синтаксис `width <= …`) — оставляем как есть.
 *
 * Ограничение (как в parseStylesheet): фигурные скобки внутри строк/комментариев
 * (`content: "{"`) не поддерживаются — редкий кейс.
 */

type Decision = 'match' | 'no-match' | 'keep'

function evalWidthConditions(conditions: string, width: number): Decision {
  const parts = conditions.split(/\band\b/i).map(s => s.trim()).filter(Boolean)
  let sawWidth = false
  let matches = true

  for (const rawPart of parts) {
    const part = rawPart.replace(/^only\s+/i, '').trim()
    // media-type без размера — игнорируем (screen/all/print/…)
    if (/^[a-z-]+$/i.test(part)) continue

    const mMax = part.match(/^\(\s*max-width\s*:\s*(\d*\.?\d+)px\s*\)$/i)
    const mMin = part.match(/^\(\s*min-width\s*:\s*(\d*\.?\d+)px\s*\)$/i)

    if (mMax) {
      sawWidth = true
      if (!(width <= parseFloat(mMax[1]))) matches = false
    } else if (mMin) {
      sawWidth = true
      if (!(width >= parseFloat(mMin[1]))) matches = false
    } else {
      // Неизвестное/невычислимое условие — не трогаем весь запрос.
      return 'keep'
    }
  }

  if (!sawWidth) return 'keep'
  return matches ? 'match' : 'no-match'
}

export function compileMediaForWidth(css: string, width: number): string {
  if (!css || !css.includes('@media') || !(width > 0)) return css

  let out = ''
  let i = 0
  const n = css.length

  while (i < n) {
    const at = css.indexOf('@media', i)
    if (at === -1) {
      out += css.slice(i)
      break
    }
    out += css.slice(i, at)

    const braceStart = css.indexOf('{', at)
    if (braceStart === -1) {
      // Малформед — отдаём остаток как есть.
      out += css.slice(at)
      break
    }

    const conditions = css.slice(at + '@media'.length, braceStart).trim()

    // Балансируем скобки тела (для вложенных правил).
    let depth = 1
    let j = braceStart + 1
    for (; j < n; j++) {
      const ch = css[j]
      if (ch === '{') depth++
      else if (ch === '}' && --depth === 0) break
    }
    const inner = css.slice(braceStart + 1, j)
    i = j + 1

    const decision = evalWidthConditions(conditions, width)
    if (decision === 'match') {
      out += `\n${inner}\n`
    } else if (decision === 'keep') {
      out += `@media ${conditions} {${inner}}`
    }
    // 'no-match' — блок выкидываем.
  }

  return out
}
