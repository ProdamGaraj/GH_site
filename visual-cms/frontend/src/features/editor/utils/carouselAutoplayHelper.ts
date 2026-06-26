import type { BlockNode } from '@/shared/types'

/**
 * Атрибуты автопрокрутки на корне карусели (читает CarouselRuntime):
 *   data-carousel-autoplay="<ms>" — интервал автолистания в мс (0/нет = выкл);
 *   data-carousel-loop="false"    — отключить зацикленность (по умолчанию рантайм = true).
 */
export const AUTOPLAY_ATTR = 'data-carousel-autoplay'
export const LOOP_ATTR = 'data-carousel-loop'
export const DEFAULT_DELAY_MS = 5000
export const MIN_SECONDS = 0.5

/** Текущий интервал автоплея в мс (0, если не задан/невалиден/≤0). */
export function readAutoplayMs(node: BlockNode): number {
  const raw = node.attributes?.[AUTOPLAY_ATTR]
  const n = raw ? parseInt(raw, 10) : 0
  return Number.isFinite(n) && n > 0 ? n : 0
}
