/**
 * repeaterMappingHelper — резолвинг targetProperty репитер-привязки в Canvas.
 *
 * Назначение: на Canvas-превью находить ЦЕЛЕВОЙ элемент шаблона по идентичности
 * (data-bind / data-field / metadata.name + синонимы / селектор targetProperty),
 * а не по факту наличия у него непустого CSS-значения. Это устраняет баг
 * «удалил фон у элемента шаблона → пропали фото всех слайдов»: раньше Canvas
 * опирался на присутствие backgroundImage как на якорь, и очистка фона рвала
 * привязку.
 *
 * Логика умышленно повторяет public-site runtime (DataBindingGenerator):
 *   - "self.style.backgroundImage"            → корень клона шаблона
 *   - "[data-bind=hero].style.backgroundImage"→ потомок с data-bind="hero"
 *   - "item.<field>"                          → элемент по data-bind/имени/синонимам
 *
 * Модуль чистый (без React/DOM) — легко тестируется и переиспользуется.
 */
import type { BlockNode } from '@/shared/types'

/**
 * Синонимы: имя поля данных → возможные идентификаторы элемента.
 * Зеркалит fieldSynonyms из DataBindingGenerator (+ background/bg/cover для фонов).
 */
const FIELD_SYNONYMS: Record<string, string[]> = {
  title: ['name', 'title', 'heading', 'header', 'заголовок', 'название'],
  name: ['title', 'name', 'heading', 'header', 'заголовок', 'название'],
  status: ['status', 'badge', 'tag', 'label', 'статус'],
  image: ['image', 'img', 'photo', 'picture', 'картинка', 'изображение', 'container', 'background', 'bg', 'cover'],
  price: ['price', 'cost', 'цена', 'стоимость'],
  location: ['location', 'address', 'place', 'локация', 'адрес', 'место'],
}

const lc = (s: string | null | undefined): string => (s || '').toLowerCase()

/**
 * Нормализуем имя поля из targetProperty:
 *   "item.project-image" → "project-image"
 *   "item.project.-image" → "project-image" (артефакт формата с ".-")
 */
export const normalizeFieldName = (raw: string): string => {
  let f = typeof raw === 'string' ? raw : ''
  if (f.startsWith('item.')) f = f.slice(5)
  while (f.includes('.-')) f = f.split('.-').join('-')
  while (f.includes('-.')) f = f.split('-.').join('-')
  f = f.replace(/^[.\-]+/, '').replace(/[.\-]+$/, '')
  return f
}

/**
 * Безопасно оборачиваем голый URL в `url("...")` для backgroundImage.
 * Уже обёрнутые/функциональные значения (url/gradient/none/var) — пропускаем.
 * Пустая строка → '' (что корректно ОЧИЩАЕТ фон, без невалидного `url()`).
 */
export const wrapBackgroundValue = (value: string): string => {
  if (!value) return ''
  // Голые CSS-ключевые слова (none / inherit / ...) — валидны как есть.
  if (/^(none|inherit|initial|unset|revert)$/i.test(value.trim())) return value
  // Функциональные формы (url(), градиенты, var(), image-set()) — не оборачиваем.
  if (/^\s*(url|linear-gradient|radial-gradient|conic-gradient|repeating-linear-gradient|repeating-radial-gradient|image-set|var)\(/i.test(value)) {
    return value
  }
  return `url("${value.replace(/"/g, '\\"')}")`
}

/** Похоже ли значение на путь к картинке (для эвристики item.<field>). */
export const looksLikeImageValue = (value: unknown, fieldName?: string): boolean => {
  if (typeof value !== 'string' || value.length === 0) return false
  if (/\.(jpg|jpeg|png|gif|svg|webp|avif)(\?|$)/i.test(value)) return true
  if (value.startsWith('data:image/')) return true
  if (/images\.unsplash\.com/i.test(value)) return true
  const fieldIsImage = !!fieldName && /image|img|photo|picture|bg|background|cover/i.test(fieldName)
  if (/^https?:\/\//i.test(value) && fieldIsImage) return true
  if (value.startsWith('/') && fieldIsImage) return true
  return false
}

const dataBindOf = (b: BlockNode): string => lc(b.attributes?.['data-bind'])
const dataFieldOf = (b: BlockNode): string => lc(b.attributes?.['data-field'])
const nameOf = (b: BlockNode): string => lc(b.metadata?.name).replace(/\s+/g, '-')

/**
 * Соответствует ли блок полю данных item.<field>.
 * Порядок проверок повторяет runtime: data-bind → data-field → metadata.name (+ синонимы).
 */
export const blockMatchesField = (block: BlockNode, rawField: string): boolean => {
  const field = normalizeFieldName(rawField).toLowerCase()
  if (!field) return false
  const lastSeg = field.split('-').pop() || field

  const db = dataBindOf(block)
  if (db) {
    if (db === field || db.includes(field) || field.includes(db.split('-').pop() || db)) return true
  }

  const df = dataFieldOf(block)
  if (df) {
    if (df === field || df.includes(field) || field.includes(df)) return true
  }

  const name = nameOf(block)
  if (name) {
    if (name === field || name.includes(field) || field.includes(name)) return true
    const synonyms = FIELD_SYNONYMS[field] || FIELD_SYNONYMS[lastSeg] || [field]
    const nameLast = name.split('-').pop() || name
    for (const syn of synonyms) {
      if (name.includes(syn) || syn.includes(nameLast)) return true
    }
  }

  return false
}

/** Является ли поле «медийным» (картинка). */
export const isImageField = (
  mapping: { sourceField?: string; targetProperty?: string }
): boolean => {
  const field = normalizeFieldName(mapping.targetProperty || '')
  if (/image|img|photo|picture|bg|background|cover/i.test(field)) return true
  if (/image|img|photo|picture/i.test(mapping.sourceField || '')) return true
  if (/backgroundimage/i.test(mapping.targetProperty || '')) return true
  return false
}

/** Есть ли среди потомков <img>, привязанный к тому же полю (тогда фон контейнеру не ставим). */
export const hasBoundDescendantImg = (block: BlockNode, rawField: string): boolean => {
  const walk = (n: BlockNode): boolean => {
    for (const child of n.children || []) {
      if (lc(child.tagName) === 'img' && blockMatchesField(child, rawField)) return true
      if (walk(child)) return true
    }
    return false
  }
  return walk(block)
}

export interface StyleTarget {
  /** CSS-свойство, например 'backgroundImage'. */
  cssKey: string
  /** true → значение надо обернуть как url("...") (фон). */
  isBackground: boolean
}

const CSS_KEY_BACKGROUND = new Set(['backgroundimage', 'background'])

/**
 * Определяет, должен ли ДАННЫЙ блок получить стиль от данного маппинга, и какое CSS-свойство.
 * Возвращает null, если маппинг не относится к стилю этого блока.
 *
 * @param isRoot — является ли block корнем клона шаблона (для формы self.*).
 */
export const resolveStyleTarget = (
  block: BlockNode,
  mapping: { sourceField?: string; targetProperty?: string },
  isRoot: boolean
): StyleTarget | null => {
  const tp = mapping.targetProperty || ''
  if (!tp) return null

  const makeTarget = (cssKey: string): StyleTarget => ({
    cssKey,
    isBackground: CSS_KEY_BACKGROUND.has(cssKey.toLowerCase()),
  })

  // self.style.X — только корень клона шаблона.
  if (tp.startsWith('self.')) {
    const prop = tp.slice(5)
    if (isRoot && prop.startsWith('style.')) return makeTarget(prop.slice(6))
    return null
  }

  // [data-bind=X].style.Y — потомок (или корень) с соответствующим data-bind.
  const selectorMatch = tp.match(/^\[data-bind=(['"]?)([^\]'"]+)\1\]\.(.+)$/)
  if (selectorMatch) {
    const bindKey = lc(selectorMatch[2])
    const prop = selectorMatch[3]
    if (dataBindOf(block) === bindKey && prop.startsWith('style.')) return makeTarget(prop.slice(6))
    return null
  }

  // item.<field> — медийное поле кладём как backgroundImage на подходящий КОНТЕЙНЕР.
  // <img>/<a> обслуживаются attribute-путём (src/href), потому исключаем их здесь.
  if (tp.startsWith('item.')) {
    const tag = lc(block.tagName)
    if (tag === 'img' || tag === 'a') return null
    if (!isImageField(mapping)) return null
    if (!blockMatchesField(block, tp)) return null
    if (hasBoundDescendantImg(block, tp)) return null
    return makeTarget('backgroundImage')
  }

  return null
}
