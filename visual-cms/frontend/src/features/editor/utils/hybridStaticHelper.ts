/**
 * Helper'ы для hybrid-MVP карусели: статические слайды, живущие
 * рядом с template-узлом в одном `[data-carousel-track]`.
 *
 * Контракт:
 *   - Hybrid-static-слайд = child трека с атрибутом `data-carousel-static="true"`.
 *   - Runtime DataBindingGenerator не трогает таких children (не скрывает).
 *   - CarouselRuntime считает их обычными слайдами (display !== 'none').
 *   - Template = первый non-static child (см. repeatTemplateHelper.getRepeatTemplate).
 *   - Runtime вставляет clones template'а через insertBefore(clone, template.nextSibling),
 *     поэтому визуальный порядок: [static до template] → [clones template'а] → [static после].
 *
 * Hybrid НЕ путать с static-mode карусели (data-carousel-mode="static"):
 *   - static-mode: ВСЯ карусель статична, UI = StaticSlidesPanel, attr на slide = data-carousel-slide
 *   - hybrid: repeat-mode + опциональные static-children, attr = data-carousel-static (+ data-carousel-slide для CarouselRuntime)
 */
import type { BlockNode } from '@/shared/types'
import { isHybridStaticSlide } from './repeatTemplateHelper'

export { isHybridStaticSlide }

/** Все hybrid-static children трека в порядке как в DOM. */
export function getHybridStaticSlides(track: BlockNode | null | undefined): BlockNode[] {
  if (!track || !Array.isArray(track.children)) return []
  return track.children.filter(isHybridStaticSlide)
}

/** Hybrid-static-children, лежащие ДО template'а в DOM-порядке. */
export function getStaticBefore(
  track: BlockNode | null | undefined,
  template: BlockNode | null | undefined
): BlockNode[] {
  if (!track || !Array.isArray(track.children) || !template) return []
  const tplIdx = track.children.findIndex(c => c.id === template.id)
  if (tplIdx === -1) return []
  return track.children.slice(0, tplIdx).filter(isHybridStaticSlide)
}

/** Hybrid-static-children, лежащие ПОСЛЕ template'а в DOM-порядке. */
export function getStaticAfter(
  track: BlockNode | null | undefined,
  template: BlockNode | null | undefined
): BlockNode[] {
  if (!track || !Array.isArray(track.children) || !template) return []
  const tplIdx = track.children.findIndex(c => c.id === template.id)
  if (tplIdx === -1) return []
  return track.children.slice(tplIdx + 1).filter(isHybridStaticSlide)
}

/**
 * Стили template'а, критичные для layout слайда в flex-track.
 *
 * ВАЖНО: НЕ копируем width / min-width / max-width / flex-* — этими свойствами
 * полностью управляет CarouselRuntime.applyTrackLayout (он принудительно ставит
 * каждому слайду flex: 0 0 (100/n)% и width: (100/n)% от track-width = n*100%).
 * Если унаследовать min-width: 100% от template, оно срабатывает ОТ track-width
 * (= N viewports), растягивая static на всю ширину карусели и ломая transform.
 *
 * Копируем только высоту, display, position и выравнивание содержимого —
 * эти свойства не пересекаются с горизонтальным flex-layout трека.
 */
const LAYOUT_STYLE_KEYS = [
  'height',
  'minHeight',
  'maxHeight',
  'display',
  'position',
  'alignItems',
  'justifyContent',
] as const

/** Извлечь layout-стили template'а (только заполненные). */
export function extractTemplateLayoutStyles(
  template: BlockNode | null | undefined
): Record<string, string | number> {
  const out: Record<string, string | number> = {}
  const props = template?.styles?.properties as Record<string, unknown> | undefined
  if (!props) return out
  for (const key of LAYOUT_STYLE_KEYS) {
    const v = props[key]
    if (v !== undefined && v !== null && v !== '') {
      out[key] = v as string | number
    }
  }
  return out
}

/**
 * Подготовить произвольный узел для роли hybrid-static-слайда:
 *  - проставить data-carousel-static="true" (skip в DataBindingGenerator)
 *  - проставить data-carousel-slide="true" (CarouselRuntime фильтрует marked-slides)
 *  - смержить layout-стили template'а (height/display/position/выравнивание) с
 *    собственными стилями узла. width / min-width / flex-* НЕ трогаем — ими
 *    рулит CarouselRuntime.applyTrackLayout. Гарантируем только flex-shrink: 0
 *    как страховку до первого rebuild() runtime'а (избежать FOUC-сжатия).
 */
export function prepareHybridStaticNode(
  node: BlockNode,
  template: BlockNode | null | undefined
): BlockNode {
  const layout = extractTemplateLayoutStyles(template)
  const fallback: Record<string, string | number> = {
    flexShrink: 0,
  }
  const ownProps = (node.styles?.properties || {}) as Record<string, unknown>
  // Приоритет: template layout (wins) → собственные стили узла → fallback.
  const mergedProps = {
    ...fallback,
    ...ownProps,
    ...layout,
  }
  return {
    ...node,
    attributes: {
      ...(node.attributes || {}),
      'data-carousel-static': 'true',
      'data-carousel-slide': 'true',
    },
    styles: {
      ...(node.styles || { properties: {} }),
      properties: mergedProps as Record<string, string | number | undefined>,
    } as BlockNode['styles'],
  }
}

/** Пометить узел как hybrid-static (immutable copy). Не трогает стили. */
export function markAsHybridStatic(node: BlockNode): BlockNode {
  return {
    ...node,
    attributes: {
      ...(node.attributes || {}),
      'data-carousel-static': 'true',
    },
  }
}

/**
 * Атрибут-якорь позиции hybrid-static-слайда среди шаблонных (data) слайдов:
 * "после скольких data-слайдов показать этот static". Позволяет вставлять
 * статик/фото МЕЖДУ сгенерированными слайдами (а не только до/после блока).
 */
export const STATIC_AFTER_ATTR = 'data-carousel-after'

/**
 * Эффективный якорь static-слайда — сколько data-слайдов идёт ПЕРЕД ним:
 *   - явный data-carousel-after (clamp в [0, dataCount]);
 *   - иначе backward-compat по физической позиции: ДО template → 0, ПОСЛЕ → dataCount.
 */
export function getStaticAfterIndex(
  node: BlockNode,
  opts: { isBeforeTemplate: boolean; dataCount: number }
): number {
  const raw = node.attributes?.[STATIC_AFTER_ATTR]
  const n = raw === undefined || raw === '' ? NaN : Number(raw)
  if (!Number.isNaN(n)) return Math.max(0, Math.min(opts.dataCount, Math.floor(n)))
  return opts.isBeforeTemplate ? 0 : opts.dataCount
}

/** Записать якорь позиции в атрибуты узла (immutable). */
export function withStaticAfter(node: BlockNode, afterIndex: number): BlockNode {
  return {
    ...node,
    attributes: {
      ...(node.attributes || {}),
      [STATIC_AFTER_ATTR]: String(Math.max(0, Math.floor(afterIndex))),
    },
  }
}

/** Есть ли среди детей трека хотя бы один static с явным якорем (гейт интерливинга). */
export function hasAnchoredStatic(track: BlockNode | null | undefined): boolean {
  if (!track || !Array.isArray(track.children)) return false
  return track.children.some(
    c => isHybridStaticSlide(c) && c.attributes?.[STATIC_AFTER_ATTR] !== undefined
  )
}

export interface OrderedDataSlide {
  kind: 'data'
  index: number
}
export interface OrderedStaticSlide {
  kind: 'static'
  node: BlockNode
}
export type OrderedSlide = OrderedDataSlide | OrderedStaticSlide

/**
 * Интерливит шаблонные (data) слайды со static-слайдами по их якорям.
 * Для i в [0..dataCount]: сначала статики с anchor==i (в порядке трека), затем data-слайд i.
 * При отсутствии якорей даёт прежний порядок: static-before → все data → static-after.
 */
export function computeSlideOrder(
  track: BlockNode | null | undefined,
  template: BlockNode | null | undefined,
  dataCount: number
): OrderedSlide[] {
  if (!track || !Array.isArray(track.children)) return []
  const children = track.children
  const tplIdx = template ? children.findIndex(c => c.id === template.id) : -1
  const statics: { node: BlockNode; anchor: number }[] = []
  children.forEach((c, idx) => {
    if (!isHybridStaticSlide(c)) return
    const isBeforeTemplate = tplIdx !== -1 && idx < tplIdx
    statics.push({ node: c, anchor: getStaticAfterIndex(c, { isBeforeTemplate, dataCount }) })
  })
  const result: OrderedSlide[] = []
  for (let i = 0; i <= dataCount; i++) {
    for (const s of statics) if (s.anchor === i) result.push({ kind: 'static', node: s.node })
    if (i < dataCount) result.push({ kind: 'data', index: i })
  }
  return result
}

/** Снять hybrid-static маркер (immutable copy). */
export function unmarkAsHybridStatic(node: BlockNode): BlockNode {
  const attrs = { ...(node.attributes || {}) }
  delete attrs['data-carousel-static']
  return {
    ...node,
    attributes: attrs,
  }
}

/**
 * Имя слайда для UI-карточки.
 * Приоритет: metadata.name → tag.
 * Префикс «Слайд N» добавляется в компоненте (потому что index — UI-понятие).
 */
export function getHybridStaticDisplayName(node: BlockNode): string {
  const name = typeof node.metadata?.name === 'string' ? node.metadata.name.trim() : ''
  if (name) return name
  return (node.tagName || node.tag || 'div').toLowerCase()
}
