/**
 * Helper'ы для Generic Binding Mapper (Stage 6c).
 *
 * Идея: вместо hardcoded полей heroSlide (image/title/subtitle/...) мы читаем
 * fieldMappings из DataBinding с inputConfig.mode='repeater', привязанного к
 * track-узлу карусели. Каждое отображение даёт нам один UI-инпут:
 *   - kind='media' для targetProperty с .src / backgroundImage
 *   - kind='url'   для targetProperty с .href
 *   - kind='text'  для всего остального (.textContent, .attr.title и т.п.)
 *
 * Public-site runtime уже понимает эту схему — никаких изменений в
 * раннере/HTML делать не нужно.
 */

import type { DataBinding, FieldMapping } from '@/shared/types/dataBinding'

export type MapperFieldKind = 'text' | 'url' | 'media'

export interface MapperField {
  /** Имя поля в объекте slide (то, что лежит в page.variables[<name>][i][sourceField]). */
  sourceField: string
  /** Тип input'а в UI. */
  kind: MapperFieldKind
  /** Сырой targetProperty из binding'а — для tooltip/diagnostics. */
  targetProperty: string
  /** Человеко-читаемая подпись поля. */
  label: string
}

/**
 * Превращаем targetProperty в тип UI-инпута.
 *
 * Допустимые формы targetProperty (см. DataBindingService на public-site):
 *   self.style.backgroundImage     → media
 *   [data-bind=img].attr.src       → media
 *   [data-bind=cta].attr.href      → url
 *   [data-bind=title].textContent  → text
 *   self.attr.title                → text (атрибут title HTML)
 */
export const inferInputKind = (targetProperty: string | null | undefined): MapperFieldKind => {
  if (typeof targetProperty !== 'string') return 'text'
  const tp = targetProperty.toLowerCase()
  if (tp.includes('backgroundimage')) return 'media'
  if (tp.endsWith('.attr.src') || tp.endsWith('.src')) return 'media'
  if (tp.endsWith('.attr.href') || tp.endsWith('.href')) return 'url'
  return 'text'
}

/**
 * camelCase → "Camel Case" с учётом acronyms (CTA → CTA, не "C T A").
 * Используется для подписи UI-полей.
 */
export const humanizeLabel = (sourceField: string): string => {
  if (typeof sourceField !== 'string' || sourceField.length === 0) return ''
  // ctaHref → cta Href → CTA Href; description → Description.
  const spaced = sourceField.replace(/([a-z])([A-Z])/g, '$1 $2')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

/**
 * Извлекаем mapper-схему из массива fieldMappings binding'а.
 *
 * Дедупликация по sourceField: если несколько mappings ссылаются на одно поле
 * (например, сейчас такого нет, но возможно в будущем), берём ПЕРВЫЙ.
 * Порядок mappings сохраняется → порядок UI-полей предсказуем.
 *
 * Игнорирует:
 *   - элементы без sourceField
 *   - служебные поля, начинающиеся с '_' (зарезервированы под mediaAssetId и т.п.)
 *   - sourceField='alignment' (это per-slide UI-настройка, рендерится отдельно)
 */
export const getMapperSchema = (fieldMappings: FieldMapping[] | null | undefined): MapperField[] => {
  if (!Array.isArray(fieldMappings)) return []
  const seen = new Set<string>()
  const out: MapperField[] = []
  for (const m of fieldMappings) {
    if (!m || typeof m.sourceField !== 'string') continue
    const sf = m.sourceField.trim()
    if (!sf) continue
    if (sf.startsWith('_')) continue
    if (sf === 'alignment') continue
    if (seen.has(sf)) continue
    seen.add(sf)
    out.push({
      sourceField: sf,
      kind: inferInputKind(m.targetProperty),
      targetProperty: typeof m.targetProperty === 'string' ? m.targetProperty : '',
      label: humanizeLabel(sf),
    })
  }
  return out
}

/**
 * Находим активный repeater-binding для конкретного track-узла.
 *
 * Совпадение по blockId обязательно. По pageId — если у binding'а pageId != null,
 * то требуем точного совпадения; глобальные binding'и (pageId==null) разрешены
 * для любой страницы (унаследовано от backend-логики DataBindingController).
 */
export const findRepeaterBinding = (
  bindings: DataBinding[] | null | undefined,
  trackId: string | null | undefined,
  pageId?: string | null
): DataBinding | null => {
  if (!Array.isArray(bindings) || !trackId) return null
  for (const b of bindings) {
    if (!b || b.blockId !== trackId) continue
    if (b.bindingType !== 'input') continue
    if (b.isActive === false) continue
    if (b.config?.inputConfig?.mode !== 'repeater') continue
    if (b.pageId != null && pageId != null && b.pageId !== pageId) continue
    return b
  }
  return null
}

/**
 * Видимость блоков слайда.
 *
 * Каждое поле слайда (sourceField из схемы) можно скрыть на конкретном слайде.
 * Скрытые поля хранятся в служебном массиве slide._hidden = ['ctaText', ...].
 * Отсутствие поля в списке (или отсутствие самого массива) = блок ВИДЕН — поэтому
 * дефолт для всех (в т.ч. старых) слайдов = «отображать» (checked), без миграции.
 *
 * Применение скрытия (Canvas + public-site runtime) зависит от типа targetProperty:
 *   - текст ([data-bind=X].textContent) / ссылка (.attr.href) → прячем сам элемент;
 *   - фон (self.style.backgroundImage)                        → очищаем фон, слайд остаётся.
 */
const HIDDEN_FIELDS_KEY = '_hidden'

/** Виден ли блок поля sourceField на этом слайде (дефолт — да). */
export const isSlideFieldVisible = (
  slide: Record<string, unknown> | null | undefined,
  sourceField: string
): boolean => {
  const h = slide?.[HIDDEN_FIELDS_KEY]
  return !(Array.isArray(h) && h.includes(sourceField))
}

/** Множество скрытых полей слайда (для применения при рендере). */
export const getHiddenSlideFields = (
  slide: Record<string, unknown> | null | undefined
): Set<string> => {
  const h = slide?.[HIDDEN_FIELDS_KEY]
  return new Set(Array.isArray(h) ? h.filter((x): x is string => typeof x === 'string') : [])
}

/**
 * Иммутабельно меняем видимость поля. Возвращает новый объект слайда.
 * Когда список скрытых пуст — удаляем сам ключ, чтобы не плодить мусор в данных.
 */
export const setSlideFieldVisible = (
  slide: Record<string, unknown> | null | undefined,
  sourceField: string,
  visible: boolean
): Record<string, unknown> => {
  const base = slide && typeof slide === 'object' ? { ...(slide as Record<string, unknown>) } : {}
  const cur = Array.isArray(base[HIDDEN_FIELDS_KEY])
    ? (base[HIDDEN_FIELDS_KEY] as unknown[]).filter((x): x is string => typeof x === 'string')
    : []
  const next = visible
    ? cur.filter(x => x !== sourceField)
    : cur.includes(sourceField) ? cur : [...cur, sourceField]
  if (next.length === 0) delete base[HIDDEN_FIELDS_KEY]
  else base[HIDDEN_FIELDS_KEY] = next
  return base
}

/** Безопасно читаем строковое значение поля slide; missing → ''. */
export const readSlideValue = (
  slide: Record<string, unknown> | null | undefined,
  sourceField: string
): string => {
  if (!slide || typeof slide !== 'object') return ''
  const v = (slide as Record<string, unknown>)[sourceField]
  if (typeof v === 'string') return v
  if (v == null) return ''
  return String(v)
}

/**
 * Иммутабельно записываем значение поля.
 * Возвращает новый объект; исходный не мутируем.
 */
export const writeSlideValue = (
  slide: Record<string, unknown> | null | undefined,
  sourceField: string,
  value: string
): Record<string, unknown> => {
  const base = slide && typeof slide === 'object' ? { ...(slide as Record<string, unknown>) } : {}
  base[sourceField] = value
  return base
}
