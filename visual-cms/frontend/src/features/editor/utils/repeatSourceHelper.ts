/**
 * Helpers для repeat-источника карусели — page-variable, на которую ссылается
 * атрибут `data-carousel-variable` carousel-root.
 *
 * Концепция:
 *   - Источник = page.variables[type='array']. Имя переменной = string-ID
 *     в data-carousel-variable.
 *   - DataBindings с repeater-mode тоже работают, но они привязаны по blockId,
 *     а не по name → относятся к другой механике и в этот picker НЕ попадают.
 *
 * Чистые pure-функции — легко тестируются и переиспользуются.
 */
import type { PageVariable, PageVariablesEnvelope } from '@/shared/api'
import type { BlockNode } from '@/shared/types'

export const CAROUSEL_VARIABLE_ATTR = 'data-carousel-variable'

/** Текущее имя источника на carousel-root (или null если атрибут пуст). */
export function getCarouselVariableName(node: BlockNode | null | undefined): string | null {
  const v = node?.attributes?.[CAROUSEL_VARIABLE_ATTR]
  return typeof v === 'string' && v.length > 0 ? v : null
}

/**
 * Иммутабельно сменить data-carousel-variable на узле. Сохраняет все остальные
 * атрибуты. Если name пустая/null — атрибут УДАЛЯЕТСЯ (carousel переходит на
 * fallback 'heroSlides' через DEFAULT_VARIABLE_NAME в SlidesPanel).
 */
export function setCarouselVariableAttr(
  attributes: Record<string, string> | undefined,
  name: string | null
): Record<string, string> {
  const next = { ...(attributes || {}) }
  const trimmed = (name || '').trim()
  if (trimmed.length === 0) {
    delete next[CAROUSEL_VARIABLE_ATTR]
  } else {
    next[CAROUSEL_VARIABLE_ATTR] = trimmed
  }
  return next
}

/**
 * Кандидаты на источник: только переменные с type='array'.
 * Карусель не имеет смысла привязывать к scalar или object.
 */
export function listArrayVariables(
  envelope: PageVariablesEnvelope | null | undefined
): PageVariable[] {
  const vars = envelope?.variables
  if (!Array.isArray(vars)) return []
  return vars.filter(v => v.type === 'array')
}

/**
 * Статус текущего источника:
 *   - 'ok'      — переменная с таким именем существует и тип array
 *   - 'orphan'  — атрибут указывает на имя, которого нет в variables
 *   - 'wrong-type' — переменная есть, но не array (нельзя репитить)
 *   - 'unset'   — атрибут отсутствует/пустой
 */
export type CarouselSourceStatus = 'ok' | 'orphan' | 'wrong-type' | 'unset'

export function getCarouselSourceStatus(
  carouselRoot: BlockNode | null | undefined,
  envelope: PageVariablesEnvelope | null | undefined
): CarouselSourceStatus {
  const name = getCarouselVariableName(carouselRoot)
  if (!name) return 'unset'
  const vars = envelope?.variables
  if (!Array.isArray(vars)) return 'orphan'
  const v = vars.find(x => x.name === name)
  if (!v) return 'orphan'
  return v.type === 'array' ? 'ok' : 'wrong-type'
}

/**
 * Пустая array-переменная с уникальным name на основе предложенного.
 * Если предложенное имя уже занято — добавляется суффикс _2, _3, ...
 *
 * caller сам сохранит её через pageDataSettingsApi.updateVariables.
 */
export function makeNewArrayVariable(
  envelope: PageVariablesEnvelope | null | undefined,
  preferredName: string,
  generateId: () => string
): PageVariable {
  const taken = new Set((envelope?.variables || []).map(v => v.name))
  let name = preferredName.trim() || 'newCarouselSource'
  if (taken.has(name)) {
    let i = 2
    while (taken.has(`${name}_${i}`)) i++
    name = `${name}_${i}`
  }
  return {
    id: generateId(),
    name,
    type: 'array',
    defaultValue: [],
  }
}
