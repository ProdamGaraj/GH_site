import type { BlockNode } from '@/shared/types'

/**
 * Свайп карусели (читает CarouselRuntime):
 *   data-carousel-swipe="mobile,tablet" — экраны страницы (id брейкпоинтов), где
 *   слайды листаются жестом: пальцем, пером, на компьютере — перетаскиванием мышью.
 * Пустое значение или нет атрибута — жестом не листается. «Выключено» пишем
 * явно пустым значением: миграция свайпа (backend scripts/carouselSwipe.ts)
 * дописывает экраны только каруселям без атрибута и не должна включить свайп
 * там, где его выключили в редакторе.
 * При одном слайде рантайм жест не перехватывает, что бы ни стояло.
 */
export const SWIPE_ATTR = 'data-carousel-swipe'

/**
 * Экраны уже этого (телефоны, планшеты) — где свайп включается по умолчанию.
 * Та же граница — в миграции бэкенда (scripts/carouselSwipe.ts).
 */
export const DEFAULT_SWIPE_MAX_WIDTH = 1024

interface Screen {
  id: string
  width: number
}

/** Экраны, на которых свайп включён. */
export function readSwipeScreens(node: { attributes?: BlockNode['attributes'] }): string[] {
  return (node.attributes?.[SWIPE_ATTR] || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

/** Экраны по умолчанию: уже 1024 px; если таких у страницы нет — все. */
export function defaultSwipeScreens(breakpoints: Screen[]): string[] {
  const narrow = breakpoints.filter((bp) => bp.width < DEFAULT_SWIPE_MAX_WIDTH)
  return (narrow.length > 0 ? narrow : breakpoints).map((bp) => bp.id)
}

/** Значение атрибута: экраны в порядке брейкпоинтов страницы, без повторов; нет экранов — ''. */
export function swipeAttrValue(screens: string[], breakpoints: Screen[]): string {
  const chosen = new Set(screens)
  return breakpoints
    .filter((bp) => chosen.has(bp.id))
    .map((bp) => bp.id)
    .join(',')
}
